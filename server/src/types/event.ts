/** 事件类型（语录单独建表，不在此枚举） */
export type EventType =
  | 'meltdown'
  | 'skill'
  | 'daily'
  | 'emotion'
  | 'sleep'
  | 'diet'
  | 'social'
  | 'medical'

/** 历史类型（仅兼容已有数据） */
export type LegacyEventType = 'health' | 'question'

/** 时间线展示用类型（含语录） */
export type TimelineItemType = EventType | LegacyEventType | 'quote'

/** 地点 */
export type LocationType =
  | 'home'
  | 'outdoor'
  | 'mall'
  | 'grandparents'
  | 'taoshudi'
  | 'tongtong'
  | 'school'
  | 'other'

/** 触发原因 */
export type TriggerType =
  | 'refused'
  | 'interrupted'
  | 'order'
  | 'dressed'
  | 'food'
  | 'share'
  | 'bedtime'
  | 'unknown'

/** 照护人（录入仅用爸妈；爷奶仅兼容旧数据） */
export type CaregiverType = 'mom' | 'dad' | 'grandma' | 'grandpa'

/** 创建 / 更新事件的请求体（camelCase，与前端一致） */
export interface EventInput {
  id: string
  happenedAt: string
  type: EventType | LegacyEventType
  summary?: string | null
  chips?: string[]
  location?: LocationType | null
  trigger?: TriggerType | null
  intensity?: number | null
  durationMin?: number | null
  coping?: string[]
  outcome?: string | null
  caregiver: CaregiverType
  napped?: 0 | 1 | null
  /** 关联相册媒体（照片或短视频） */
  photoId?: string | null
  monthAge?: number
}

/** 事件实体（API 返回） */
export interface EventRecord extends EventInput {
  monthAge: number
  createdAt: string
  updatedAt?: string | null
}

/** 创建 / 更新语录的请求体 */
export interface QuoteInput {
  id: string
  content: string
  context?: string | null
  note?: string | null
  saidAt: string
  monthAge?: number
  photoId?: string | null
}

/** 语录实体（API 返回） */
export interface QuoteRecord extends QuoteInput {
  monthAge: number
  createdAt: string
  updatedAt?: string | null
}

/** 统一 API 响应 */
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

/** SQLite events 表行（snake_case） */
export interface EventRow {
  id: string
  happened_at: string
  type: string
  summary: string | null
  chips: string | null
  location: string | null
  trigger: string | null
  intensity: number | null
  duration_min: number | null
  coping: string | null
  outcome: string | null
  caregiver: string | null
  napped: number | null
  month_age: number | null
  photo_id: string | null
  created_at: string
  updated_at: string | null
}

/** SQLite quotes 表行（snake_case） */
export interface QuoteRow {
  id: string
  content: string
  context: string | null
  note: string | null
  said_at: string
  month_age: number
  photo_id: string | null
  created_at: string
  updated_at: string | null
}
