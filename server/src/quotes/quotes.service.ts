import { Injectable } from '@nestjs/common'
import { DbService } from '../db/db.service'
import { PhotosService } from '../photos/photos.service'
import type { QuoteInput, QuoteRecord, QuoteRow } from '../types/event'
import { BIRTH_DATE, chinaDayKey, monthAge } from '../utils/date'
import { mapQuoteRow } from '../utils/mappers'

/** 按月龄分组后的语录块 */
export interface QuoteMonthGroup {
  monthAge: number
  items: QuoteRecord[]
}

/** 语录表读写服务 */
@Injectable()
export class QuotesService {
  /** 首页「今日一句」最少条数 */
  static readonly MIN_FOR_DAILY = 20

  constructor(
    private readonly dbService: DbService,
    private readonly photosService: PhotosService,
  ) {}

  /** 幂等创建；创建后尝试按时间自动配图 */
  create(input: QuoteInput): QuoteRecord {
    const now = new Date().toISOString()
    const saidAt = input.saidAt || now
    const age = input.monthAge ?? monthAge(BIRTH_DATE, saidAt)

    this.dbService.db
      .prepare(
        `INSERT OR IGNORE INTO quotes (
          id, content, context, note, said_at, month_age, photo_id, created_at, updated_at
        ) VALUES (
          @id, @content, @context, @note, @said_at, @month_age, @photo_id, @created_at, @updated_at
        )`,
      )
      .run({
        id: input.id,
        content: input.content,
        context: input.context ?? null,
        note: input.note ?? null,
        said_at: saidAt,
        month_age: age,
        photo_id: input.photoId ?? null,
        created_at: now,
        updated_at: null,
      })

    if (!input.photoId) {
      this.photosService.attachNearestPhoto(input.id, saidAt)
    }

    return this.findById(input.id) as QuoteRecord
  }

  /** 按月龄降序分组返回 */
  listGrouped(): QuoteMonthGroup[] {
    const rows = this.dbService.db
      .prepare(
        'SELECT * FROM quotes ORDER BY month_age DESC, said_at DESC',
      )
      .all() as QuoteRow[]

    const map = new Map<number, QuoteRecord[]>()
    for (const row of rows) {
      const item = mapQuoteRow(row)
      const list = map.get(item.monthAge) ?? []
      list.push(item)
      map.set(item.monthAge, list)
    }

    return Array.from(map.entries()).map(([age, items]) => ({
      monthAge: age,
      items,
    }))
  }

  /** 随机取一条，表空则返回 null */
  randomOne(): QuoteRecord | null {
    const row = this.dbService.db
      .prepare('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1')
      .get() as QuoteRow | undefined
    return row ? mapQuoteRow(row) : null
  }

  /**
   * 今日一句：条数 ≥20 时按东八区日期稳定选一条，同一天内不变
   */
  dailyOne(): QuoteRecord | null {
    const count = this.count()
    if (count < QuotesService.MIN_FOR_DAILY) {
      return null
    }

    const rows = this.dbService.db
      .prepare('SELECT * FROM quotes ORDER BY said_at ASC, id ASC')
      .all() as QuoteRow[]

    const dayKey = chinaDayKey()
    let hash = 0
    for (let i = 0; i < dayKey.length; i++) {
      hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0
    }
    const index = hash % rows.length
    return mapQuoteRow(rows[index])
  }

  /**
   * 模糊搜索原话 / 上下文 / 感受
   */
  search(term: string): QuoteRecord[] {
    const q = term.trim()
    if (!q) {
      return []
    }
    const safe = q.replace(/[%_]/g, '')
    const like = `%${safe}%`
    const rows = this.dbService.db
      .prepare(
        `SELECT * FROM quotes
         WHERE content LIKE @like
            OR context LIKE @like
            OR note LIKE @like
         ORDER BY said_at DESC`,
      )
      .all({ like }) as QuoteRow[]
    return rows.map(mapQuoteRow)
  }

  /** 按主键查询 */
  findById(id: string): QuoteRecord | null {
    const row = this.dbService.db
      .prepare('SELECT * FROM quotes WHERE id = ?')
      .get(id) as QuoteRow | undefined
    return row ? mapQuoteRow(row) : null
  }

  /** 部分更新 */
  update(id: string, patch: Partial<QuoteInput>): QuoteRecord | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }

    const saidAt = patch.saidAt ?? existing.saidAt
    const next: QuoteRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      saidAt,
      monthAge: patch.monthAge ?? monthAge(BIRTH_DATE, saidAt),
      updatedAt: new Date().toISOString(),
    }

    this.dbService.db
      .prepare(
        `UPDATE quotes SET
          content = @content,
          context = @context,
          note = @note,
          said_at = @said_at,
          month_age = @month_age,
          photo_id = @photo_id,
          updated_at = @updated_at
        WHERE id = @id`,
      )
      .run({
        id,
        content: next.content,
        context: next.context ?? null,
        note: next.note ?? null,
        said_at: next.saidAt,
        month_age: next.monthAge,
        photo_id: next.photoId ?? null,
        updated_at: next.updatedAt,
      })

    return this.findById(id)
  }

  /** 删除语录 */
  remove(id: string): boolean {
    const result = this.dbService.db
      .prepare('DELETE FROM quotes WHERE id = ?')
      .run(id)
    return result.changes > 0
  }

  /** 当前语录总数（种子数据用） */
  count(): number {
    const row = this.dbService.db
      .prepare('SELECT COUNT(*) AS c FROM quotes')
      .get() as { c: number }
    return row.c
  }
}
