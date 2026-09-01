import { getAuthHeaders, handleUnauthorized, request } from '@/api/client'
import type { PhotoRecord } from '@/types/photo'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

/**
 * 把相对 API 路径拼成可请求的完整 URL
 */
export function photoAssetUrl(path: string): string {
  if (path.startsWith('http')) {
    return path
  }
  const base = BASE.replace(/\/$/, '')
  const rel = path.startsWith('/') ? path : `/${path}`
  return `${base}${rel}`
}

/**
 * 分页拉取相册
 */
export function fetchPhotos(params?: { limit?: number; before?: string }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.before) q.set('before', params.before)
  const qs = q.toString()
  return request<PhotoRecord[]>(`/photos${qs ? `?${qs}` : ''}`)
}

/**
 * 上传一张照片（multipart 字段名 file）
 */
export async function uploadPhoto(file: File): Promise<PhotoRecord> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${BASE}/photos`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: form,
  })
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('登录已过期，请重新登录')
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    ok: boolean
    data?: PhotoRecord
    error?: string
  }
  if (!json.ok || !json.data) {
    throw new Error(json.error ?? '上传失败')
  }
  return json.data
}

/**
 * 删除照片
 */
export function deletePhoto(id: string) {
  return request<void>(`/photos/${id}`, { method: 'DELETE' })
}
