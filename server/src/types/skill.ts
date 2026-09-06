/** 技能领域 */
export type SkillDomain =
  | 'gross'
  | 'fine'
  | 'language'
  | 'cognition'
  | 'selfcare'
  | 'social'
  | 'other'

/** 掌握状态：无记录=未观察 */
export type SkillStatus = 'emerging' | 'done'

/** 技能目录项 */
export interface SkillDef {
  id: string
  domain: SkillDomain
  label: string
  emoji: string
  /** 常见出现月龄下限（提示用，可空） */
  typicalFrom?: number | null
  /** 常见出现月龄上限（提示用，可空） */
  typicalTo?: number | null
  sortOrder: number
}

/** 用户标记 */
export interface SkillMark {
  skillId: string
  status: SkillStatus
  markedAt: string
  note?: string | null
  updatedAt?: string | null
}

/** 带状态的技能（API 返回） */
export interface SkillItem extends SkillDef {
  status: SkillStatus | 'todo'
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
