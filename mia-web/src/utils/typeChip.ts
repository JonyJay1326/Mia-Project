import type { TimelineItemType } from '@/types/event'

/** 类型胶囊的视觉配置 */
export interface TypeChipStyle {
  label: string
  icon: string
  color: string
  bg: string
}

/** 各类型对应的标签、emoji、配色 */
export const TYPE_CHIP_MAP: Record<TimelineItemType, TypeChipStyle> = {
  meltdown: {
    label: '崩溃',
    icon: '🍭',
    color: '#e8736b',
    bg: '#fadbd8',
  },
  skill: {
    label: '技能',
    icon: '🌱',
    color: '#7fc8a9',
    bg: '#d6efe3',
  },
  health: {
    label: '健康',
    icon: '🌙',
    color: '#6ba3d6',
    bg: '#dceaf5',
  },
  question: {
    label: '疑问',
    icon: '❓',
    color: '#f5c45e',
    bg: '#fbf0d6',
  },
  quote: {
    label: '语录',
    icon: '💬',
    color: '#a98bc4',
    bg: '#ede5f3',
  },
}

/**
 * 按事件类型取胶囊样式，未知类型回退为疑问样式
 */
export function getTypeChipStyle(type: TimelineItemType): TypeChipStyle {
  return TYPE_CHIP_MAP[type] ?? TYPE_CHIP_MAP.question
}
