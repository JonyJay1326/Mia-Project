import { request } from '@/api/client'
import type { EventRecord, QuoteRecord } from '@/types/event'

/** 拉取事件列表 */
export function fetchEvents(params?: {
  limit?: number
  before?: string
  type?: string
}) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.before) q.set('before', params.before)
  if (params?.type) q.set('type', params.type)
  const qs = q.toString()
  return request<EventRecord[]>(`/events${qs ? `?${qs}` : ''}`)
}

/** 按 id 取事件 */
export function fetchEvent(id: string) {
  return request<EventRecord>(`/events/${id}`)
}

/** 更新事件 */
export function patchEvent(id: string, body: Partial<EventRecord>) {
  return request<EventRecord>(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** 删除事件 */
export function deleteEvent(id: string) {
  return request<{ id: string }>(`/events/${id}`, { method: 'DELETE' })
}

/** 删除语录 */
export function deleteQuote(id: string) {
  return request<{ id: string }>(`/quotes/${id}`, { method: 'DELETE' })
}

/** 语录按月龄分组 */
export interface QuoteMonthGroup {
  monthAge: number
  items: QuoteRecord[]
}

/** 拉取语录分组列表 */
export function fetchQuotesGrouped() {
  return request<QuoteMonthGroup[]>('/quotes')
}

/** 今日一句（不足 20 条时返回 null） */
export function fetchDailyQuote() {
  return request<QuoteRecord | null>('/quotes?daily=1')
}

/** 搜索语录 */
export function searchQuotes(q: string) {
  return request<QuoteRecord[]>(`/quotes?q=${encodeURIComponent(q)}`)
}

/** 更新语录（context / note / saidAt） */
export function updateQuote(
  id: string,
  body: {
    context?: string | null
    note?: string | null
    saidAt?: string
  },
) {
  return request<QuoteRecord>(`/quotes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** 创建语录 */
export function createQuote(body: unknown) {
  return request<QuoteRecord>('/quotes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
