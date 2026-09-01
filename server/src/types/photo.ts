/** 相册照片实体（API 返回） */
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
  /** 缩略图 URL（相对 API） */
  thumbUrl: string
  /** 原图 URL（相对 API） */
  fileUrl: string
}

/** photos 表行 */
export interface PhotoRow {
  id: string
  taken_at: string
  uploaded_at: string
  original_name: string | null
  mime: string
  size_bytes: number
  width: number | null
  height: number | null
  month_age: number | null
  note: string | null
  created_at: string
}
