import {
  caregiverLabel,
  locationLabel,
  TRIGGER_CHIPS,
} from '@/config/chips'
import { getTypeChipStyle } from '@/utils/typeChip'
import type { TimelineItem } from '@/utils/timeline'

/** 枚举值转中文标签 */
function labelOf(
  list: { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((x) => x.value === value)?.label ?? value ?? '—'
}

/**
 * 把时间线条目拼成 AI 咨询首问（服务端仍会附带档案 + 近期事实）
 */
export function buildTimelineAiQuestion(item: TimelineItem): string {
  const typeLabel = getTypeChipStyle(item.type).label
  const lines = [
    '请结合档案与近期系统事实，简短分析下面这条成长记录。',
    '要求：给 2–4 条可执行建议；标明依据（档案或统计）；不做性格标签与医学诊断；不要写回数据库。',
    '',
    `【类型】${typeLabel}`,
    `【时间】${item.at}`,
  ]

  if (item.kind === 'quote' && item.quote) {
    const q = item.quote
    lines.push(`【原话】「${q.content}」`)
    if (q.context) {
      lines.push(`【情境】${q.context}`)
    }
    if (q.note) {
      lines.push(`【备注】${q.note}`)
    }
  } else if (item.event) {
    const ev = item.event
    lines.push(`【摘要】${ev.summary || '（无摘要）'}`)
    const chips = (ev.chips ?? []).filter(Boolean)
    if (chips.length) {
      lines.push(`【标签】${chips.join('、')}`)
    }
    lines.push(`【地点】${locationLabel(ev.location)}`)
    lines.push(`【记录人】${caregiverLabel(ev.caregiver)}`)
    if (ev.trigger) {
      lines.push(`【触发】${labelOf(TRIGGER_CHIPS, ev.trigger)}`)
    }
    if (ev.intensity != null) {
      lines.push(`【强度】${ev.intensity}/5`)
    }
    if (ev.durationMin != null) {
      lines.push(`【时长】${ev.durationMin} 分钟`)
    }
    const coping = (ev.coping ?? []).filter(Boolean)
    if (coping.length) {
      lines.push(`【应对】${coping.join('、')}`)
    }
    if (ev.outcome) {
      lines.push(`【结果】${ev.outcome}`)
    }
    if (ev.napped === 1 || ev.napped === 0) {
      lines.push(`【午睡】${ev.napped === 1 ? '是' : '否'}`)
    }
  } else {
    lines.push(`【摘要】${item.title}`)
  }

  return lines.join('\n')
}
