import { getAuthHeaders, handleUnauthorized, request } from '@/api/client'
import type { PhotoRecord } from '@/types/photo'
import { isVideoMime } from '@/types/photo'
import { captureVideoPoster } from '@/utils/captureVideoPoster'

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
 * 上传一张照片或视频（multipart：file；视频可附带 thumb 封面）
 */
export async function uploadPhoto(file: File): Promise<PhotoRecord> {
  const form = new FormData()
  form.append('file', file)

  if (isVideoMime(file.type)) {
    try {
      const poster = await captureVideoPoster(file)
      const ext = poster.type.includes('webp') ? 'webp' : 'jpg'
      form.append('thumb', poster, `poster.${ext}`)
    } catch (e) {
      console.warn('视频封面截取失败，将使用占位图', e)
    }
  }

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
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean
    data?: PhotoRecord
    error?: string
    message?: string | string[]
  } | null
  if (!res.ok) {
    const msg = Array.isArray(json?.message)
      ? json.message.join('；')
      : json?.message || json?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  if (!json?.ok || !json.data) {
    throw new Error(json?.error ?? '上传失败')
  }
  return json.data
}

/**
 * 单条媒体元数据
 */
export function fetchPhoto(id: string) {
  return request<PhotoRecord>(`/photos/${id}`)
}

/**
 * 删除照片
 */
export function deletePhoto(id: string) {
  return request<void>(`/photos/${id}`, { method: 'DELETE' })
}
