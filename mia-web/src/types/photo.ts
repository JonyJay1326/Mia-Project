/** 相册照片实体 */
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
