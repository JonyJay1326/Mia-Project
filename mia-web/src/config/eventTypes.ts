import type { EventType, LegacyEventType } from '@/types/event'

/** 默认可新建的事件类型 */
export const BUILTIN_EVENT_TYPES = [
  'meltdown',
  'highlight',
  'skill',
  'daily',
  'emotion',
  'diet',
  'social',
  'medical',
] as const satisfies readonly EventType[]

/** 时间线默认筛选 tab（不含「其他」） */
export const DEFAULT_TIMELINE_FILTER_TYPES = [
  'meltdown',
  'quote',
  'highlight',
  'skill',
  'daily',
  'emotion',
  'diet',
  'social',
  'medical',
] as const

/** 是否内置可新建类型 */
export function isBuiltinEventType(type: string): type is EventType {
  return (BUILTIN_EVENT_TYPES as readonly string[]).includes(type)
}

/** 是否落在时间线默认 tab（其余进「其他」） */
export function isDefaultTimelineFilterType(type: string): boolean {
  return (DEFAULT_TIMELINE_FILTER_TYPES as readonly string[]).includes(type)
}

/** 历史类型 */
export function isLegacyEventType(type: string): type is LegacyEventType {
  return type === 'sleep' || type === 'health' || type === 'question'
}
