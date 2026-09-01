import type { SkillDomain } from '@/types/skill'

/** 技能领域选项（与后端 DOMAIN_META 一致） */
export const SKILL_DOMAIN_OPTIONS: {
  value: SkillDomain
  label: string
  emoji: string
}[] = [
  { value: 'gross', label: '大运动', emoji: '🏃' },
  { value: 'fine', label: '精细动作', emoji: '✋' },
  { value: 'language', label: '语言', emoji: '💬' },
  { value: 'cognition', label: '认知专注', emoji: '🧩' },
  { value: 'selfcare', label: '生活自理', emoji: '👟' },
  { value: 'social', label: '社交', emoji: '👫' },
  { value: 'other', label: '其他', emoji: '✨' },
]

/**
 * 领域 key → 展示名
 */
export function skillDomainLabel(domain: SkillDomain): string {
  return SKILL_DOMAIN_OPTIONS.find((d) => d.value === domain)?.label ?? domain
}
