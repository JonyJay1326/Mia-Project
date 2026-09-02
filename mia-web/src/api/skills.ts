import { request } from '@/api/client'
import type { SkillDomain, SkillDomainGroup, SkillItem, SkillStatus } from '@/types/skill'

/** 拉取技能地图 */
export function fetchSkills() {
  return request<SkillDomainGroup[]>('/skills')
}

/** AI 预览分类（不写库） */
export function suggestSkillMeta(label: string) {
  return request<{ domain: SkillDomain; emoji: string; label: string }>(
    '/ai/skill-suggest',
    {
      method: 'POST',
      body: JSON.stringify({ label }),
    },
  )
}

/** 新建自定义技能 */
export function createSkill(body: {
  label: string
  useAi?: boolean
  domain?: SkillDomain
  emoji?: string
  status?: Exclude<SkillStatus, 'todo'>
  markedAt?: string
  note?: string | null
}) {
  return request<SkillItem>('/skills', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * 更新技能状态
 * @param status todo 表示清除标记
 */
export function markSkill(
  id: string,
  body: { status: SkillStatus; markedAt?: string; note?: string | null },
) {
  return request<SkillItem>(`/skills/${id}/mark`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/** 更新技能备注 */
export function updateSkillNote(id: string, note: string | null) {
  return request<SkillItem>(`/skills/${id}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  })
}

/** 删除自定义技能 */
export function deleteSkill(id: string) {
  return request<{ id: string }>(`/skills/${id}`, { method: 'DELETE' })
}
