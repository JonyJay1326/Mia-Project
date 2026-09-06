/** 技能领域 */
export type SkillDomain =
  | 'gross'
  | 'fine'
  | 'language'
  | 'cognition'
  | 'selfcare'
  | 'social'
  | 'other'

/** 掌握状态 */
export type SkillStatus = 'emerging' | 'done' | 'todo'

/** 带状态的技能 */
export interface SkillItem {
  id: string
  domain: SkillDomain
  label: string
  emoji: string
  typicalFrom?: number | null
  typicalTo?: number | null
  sortOrder: number
  status: SkillStatus
  markedAt?: string | null
  note?: string | null
  monthAgeWhenMarked?: number | null
  /** 用户添加的自定义技能 */
  isCustom?: boolean
}

/** 按领域分组 */
export interface SkillDomainGroup {
  domain: SkillDomain
  label: string
  emoji: string
  items: SkillItem[]
  doneCount: number
  total: number
}
