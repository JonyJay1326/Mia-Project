import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PhotoRecord, PhotoRow } from '../types/photo'

/** 相册根目录：server/data/photos */
export function photosRootDir(): string {
  return join(process.cwd(), 'data', 'photos')
}

/** 确保原图 / 缩略图目录存在 */
export function ensurePhotoDirs() {
  mkdirSync(join(photosRootDir(), 'original'), { recursive: true })
  mkdirSync(join(photosRootDir(), 'thumb'), { recursive: true })
}

/**
 * 原图磁盘路径（按扩展名）
 */
export function originalPath(id: string, ext: string): string {
  return join(photosRootDir(), 'original', `${id}${ext}`)
}

/**
 * 缩略图磁盘路径（统一 webp）
 */
export function thumbPath(id: string): string {
  return join(photosRootDir(), 'thumb', `${id}.webp`)
}

/**
 * 根据 mime 推断扩展名
 */
export function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/heic' || mime === 'image/heif') return '.heic'
  if (mime === 'video/mp4') return '.mp4'
  if (mime === 'video/webm') return '.webm'
  return '.jpg'
}

/** 是否为支持的视频类型 */
export function isVideoMime(mime: string): boolean {
  const m = mime.toLowerCase()
  return m === 'video/mp4' || m === 'video/webm'
}

/**
 * 行映射为 API 对象
 */
export function mapPhotoRow(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    takenAt: row.taken_at,
    uploadedAt: row.uploaded_at,
    originalName: row.original_name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    monthAge: row.month_age,
    note: row.note,
    createdAt: row.created_at,
    thumbUrl: `/photos/${row.id}/file?v=thumb`,
    fileUrl: `/photos/${row.id}/file?v=original`,
  }
}
