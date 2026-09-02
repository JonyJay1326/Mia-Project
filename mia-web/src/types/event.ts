/** 事件类型（语录单独建表，不在此枚举） */
export type EventType =
  | 'meltdown'
  | 'skill'
  | 'daily'
  | 'emotion'
  | 'diet'
  | 'social'
  | 'medical'
  | 'highlight'

/** 历史类型（仅兼容已有数据展示，不可新建） */
export type LegacyEventType = 'health' | 'question' | 'sleep'

/** 任意事件类型：内置 + 历史 + AI 自定义 key（如 c_toilet） */
export type AnyEventType = EventType | LegacyEventType | (string & {})

/** 时间线展示用类型（含语录与历史 / 自定义） */
export type TimelineItemType = AnyEventType | 'quote'

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

/** 记录人（录入仅用爸妈；爷奶仅兼容旧数据） */
export type CaregiverType = 'mom' | 'dad' | 'grandma' | 'grandpa'

/** 事件草稿 / 实体 */
export interface EventRecord {
  id: string
  happenedAt: string
  type: AnyEventType
  summary: string
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
  monthAge: number
  createdAt: string
  updatedAt?: string | null
}

/** 语录实体 */
export interface QuoteRecord {
  id: string
  content: string
  context?: string | null
  note?: string | null
  saidAt: string
  monthAge: number
  photoId?: string | null
  createdAt: string
  updatedAt?: string | null
}

/** 统一 API 响应 */
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
