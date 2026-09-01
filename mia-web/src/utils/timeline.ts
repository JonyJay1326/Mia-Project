import type { EventRecord, QuoteRecord, TimelineItemType } from '@/types/event'

/** 时间线合并后的条目 */
export interface TimelineItem {
  id: string
  kind: 'event' | 'quote'
  type: TimelineItemType
  at: string
  title: string
  event?: EventRecord
  quote?: QuoteRecord
}

/**
 * 将事件与语录按时间倒序归并
 */
export function mergeTimeline(
  events: EventRecord[],
  quotes: QuoteRecord[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events.map((event) => ({
      id: event.id,
      kind: 'event' as const,
      type: event.type as TimelineItemType,
      at: event.happenedAt,
      title: event.summary || '（无摘要）',
      event,
    })),
    ...quotes.map((quote) => ({
      id: quote.id,
      kind: 'quote' as const,
      type: 'quote' as const,
      at: quote.saidAt,
      title: quote.content,
      quote,
    })),
  ]

  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )
}

/** 取 ISO 时间的本地日期键 YYYY-MM-DD */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 取月份键 YYYY-MM */
export function monthKey(iso: string): string {
  return dayKey(iso).slice(0, 7)
}

/** 格式化时间为 HH:mm */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 崩溃强度小圆点 */
export function intensityDots(n: number | null | undefined): string {
  if (!n || n < 1) {
    return ''
  }
  const filled = Math.min(5, Math.max(1, n))
  return `${'●'.repeat(filled)}${'○'.repeat(5 - filled)}`
}
