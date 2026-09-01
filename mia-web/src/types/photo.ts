/** 相册媒体实体（照片或短视频） */
export interface PhotoRecord {
  id: string
  takenAt: string
  uploadedAt: string
  originalName?: string | null
  mime: string
  sizeBytes: number
  width?: number | null
  height?: number | null
  monthAge?: number | null
  note?: string | null
  createdAt: string
  thumbUrl: string
  fileUrl: string
}

/** 是否为相册支持的视频 */
export function isVideoMime(mime: string | null | undefined): boolean {
  const m = (mime ?? '').toLowerCase()
  return m === 'video/mp4' || m === 'video/webm'
}

/** 单张图片上限（字节） */
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024

/** 单个视频上限（字节） */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024
