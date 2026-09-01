import type {
  CaregiverType,
  EventRecord,
  EventRow,
  EventType,
  LocationType,
  QuoteRecord,
  QuoteRow,
  TriggerType,
} from '../types/event'
import { parseJsonArray } from '../utils/date'

/** 将 events 表行映射为前端驼峰对象 */
export function mapEventRow(row: EventRow): EventRecord {
  return {
    id: row.id,
    happenedAt: row.happened_at,
    type: row.type as EventType,
    summary: row.summary ?? '',
    chips: parseJsonArray(row.chips),
    location: (row.location as LocationType | null) ?? null,
    trigger: (row.trigger as TriggerType | null) ?? null,
    intensity: row.intensity,
    durationMin: row.duration_min,
    coping: parseJsonArray(row.coping),
    outcome: row.outcome,
    caregiver: (row.caregiver as CaregiverType) ?? 'mom',
    napped: (row.napped as 0 | 1 | null) ?? null,
    monthAge: row.month_age ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 将 quotes 表行映射为前端驼峰对象 */
export function mapQuoteRow(row: QuoteRow): QuoteRecord {
  return {
    id: row.id,
    content: row.content,
    context: row.context,
    note: row.note,
    saidAt: row.said_at,
    monthAge: row.month_age,
    photoId: row.photo_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
