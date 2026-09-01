import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { createReadStream, existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import exifr from 'exifr'
import { DbService } from '../db/db.service'
import { BIRTH_DATE, monthAge } from '../utils/date'
import type { PhotoRecord, PhotoRow } from '../types/photo'
import {
  ensurePhotoDirs,
  extFromMime,
  mapPhotoRow,
  originalPath,
  thumbPath,
} from './photo-paths'

/** 列表查询参数 */
interface ListParams {
  limit: number
  before?: string
}

/** 上传处理结果所需的原始缓冲 */
export interface IncomingPhoto {
  buffer: Buffer
  filename?: string
  mimetype: string
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

/** 相册读写：上传、缩略图、列表、删除、语录配图 */
@Injectable()
export class PhotosService implements OnModuleInit {
  constructor(private readonly dbService: DbService) {}

  /** 启动时确保目录存在 */
  onModuleInit() {
    ensurePhotoDirs()
  }

  /**
   * 上传一张照片：落盘原图 + 生成缩略图 + 写库 + 尝试配语录
   */
  async createFromUpload(file: IncomingPhoto): Promise<PhotoRecord> {
    const mime = (file.mimetype || '').toLowerCase()
    if (!ALLOWED_MIME.has(mime) && mime !== 'image/jpg') {
      throw new BadRequestException('仅支持 JPG / PNG / WebP / GIF')
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('空文件')
    }
    if (file.buffer.length > 20 * 1024 * 1024) {
      throw new BadRequestException('单张不超过 20MB')
    }

    const id = randomUUID()
    const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime
    const ext = extFromMime(normalizedMime)
    const now = new Date().toISOString()

    const takenAt = await readTakenAt(file.buffer, now)
    const image = sharp(file.buffer, { failOn: 'none' })
    const meta = await image.metadata()
    const width = meta.width ?? null
    const height = meta.height ?? null

    writeFileSync(originalPath(id, ext), file.buffer)

    await sharp(file.buffer, { failOn: 'none' })
      .rotate()
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbPath(id))

    this.dbService.db
      .prepare(
        `INSERT INTO photos (
          id, taken_at, uploaded_at, original_name, mime, size_bytes,
          width, height, month_age, note, created_at
        ) VALUES (
          @id, @taken_at, @uploaded_at, @original_name, @mime, @size_bytes,
          @width, @height, @month_age, @note, @created_at
        )`,
      )
      .run({
        id,
        taken_at: takenAt,
        uploaded_at: now,
        original_name: file.filename ?? null,
        mime: normalizedMime,
        size_bytes: file.buffer.length,
        width,
        height,
        month_age: monthAge(BIRTH_DATE, takenAt),
        note: null,
        created_at: now,
      })

    this.linkQuotesNear(id, takenAt)

    return this.findById(id) as PhotoRecord
  }

  /** 分页列表（按拍摄时间倒序） */
  list(params: ListParams): PhotoRecord[] {
    const limit = Math.min(Math.max(params.limit || 48, 1), 100)
    const binds: Record<string, string | number> = { limit }
    let where = ''
    if (params.before) {
      where = 'WHERE taken_at < @before'
      binds.before = params.before
    }
    const rows = this.dbService.db
      .prepare(
        `SELECT * FROM photos ${where} ORDER BY taken_at DESC LIMIT @limit`,
      )
      .all(binds) as PhotoRow[]
    return rows.map(mapPhotoRow)
  }

  /** 按 id 查询 */
  findById(id: string): PhotoRecord | null {
    const row = this.dbService.db
      .prepare('SELECT * FROM photos WHERE id = ?')
      .get(id) as PhotoRow | undefined
    return row ? mapPhotoRow(row) : null
  }

  /**
   * 打开文件流（缩略图或原图）
   */
  openFile(id: string, variant: 'thumb' | 'original') {
    const row = this.dbService.db
      .prepare('SELECT * FROM photos WHERE id = ?')
      .get(id) as PhotoRow | undefined
    if (!row) {
      throw new NotFoundException('照片不存在')
    }

    if (variant === 'thumb') {
      const path = thumbPath(id)
      if (!existsSync(path)) {
        throw new NotFoundException('缩略图缺失')
      }
      return {
        stream: createReadStream(path),
        mime: 'image/webp',
        filename: `${id}.webp`,
      }
    }

    const ext = extFromMime(row.mime)
    const path = originalPath(id, ext)
    if (!existsSync(path)) {
      throw new NotFoundException('原图缺失')
    }
    return {
      stream: createReadStream(path),
      mime: row.mime,
      filename: row.original_name || `${id}${ext}`,
    }
  }

  /** 删除照片并清除语录上的关联 */
  remove(id: string): boolean {
    const row = this.dbService.db
      .prepare('SELECT * FROM photos WHERE id = ?')
      .get(id) as PhotoRow | undefined
    if (!row) {
      return false
    }

    this.dbService.db
      .prepare('UPDATE quotes SET photo_id = NULL WHERE photo_id = ?')
      .run(id)
    this.dbService.db.prepare('DELETE FROM photos WHERE id = ?').run(id)

    const ext = extFromMime(row.mime)
    safeUnlink(originalPath(id, ext))
    safeUnlink(thumbPath(id))
    return true
  }

  /**
   * 把拍摄时间 ±30 分钟内、尚未配图的语录挂上 photo_id
   */
  linkQuotesNear(photoId: string, takenAtIso: string) {
    const taken = new Date(takenAtIso).getTime()
    if (Number.isNaN(taken)) {
      return
    }
    const from = new Date(taken - 30 * 60 * 1000).toISOString()
    const to = new Date(taken + 30 * 60 * 1000).toISOString()

    this.dbService.db
      .prepare(
        `UPDATE quotes
         SET photo_id = @photo_id, updated_at = @updated_at
         WHERE photo_id IS NULL
           AND said_at >= @from
           AND said_at <= @to`,
      )
      .run({
        photo_id: photoId,
        updated_at: new Date().toISOString(),
        from,
        to,
      })
  }

  /**
   * 语录写入后：找 ±30 分钟内最近一张照片挂上
   */
  attachNearestPhoto(quoteId: string, saidAtIso: string) {
    const said = new Date(saidAtIso).getTime()
    if (Number.isNaN(said)) {
      return
    }
    const from = new Date(said - 30 * 60 * 1000).toISOString()
    const to = new Date(said + 30 * 60 * 1000).toISOString()

    const candidates = this.dbService.db
      .prepare(
        `SELECT id, taken_at FROM photos
         WHERE taken_at >= ? AND taken_at <= ?`,
      )
      .all(from, to) as { id: string; taken_at: string }[]

    if (!candidates.length) {
      return
    }

    let best = candidates[0]
    let bestDiff = Math.abs(new Date(best.taken_at).getTime() - said)
    for (const c of candidates.slice(1)) {
      const diff = Math.abs(new Date(c.taken_at).getTime() - said)
      if (diff < bestDiff) {
        best = c
        bestDiff = diff
      }
    }

    this.dbService.db
      .prepare(
        `UPDATE quotes SET photo_id = ?, updated_at = ?
         WHERE id = ? AND photo_id IS NULL`,
      )
      .run(best.id, new Date().toISOString(), quoteId)
  }
}

/**
 * 从 EXIF 读拍摄时间，失败则用 fallback
 */
async function readTakenAt(buffer: Buffer, fallbackIso: string): Promise<string> {
  try {
    const exif = await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    })
    const raw =
      exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate ?? null
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return raw.toISOString()
    }
  } catch {
    // EXIF 缺失时用上传时间
  }
  return fallbackIso
}

/** 忽略删除失败 */
function safeUnlink(path: string) {
  try {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  } catch {
    // 忽略
  }
}
