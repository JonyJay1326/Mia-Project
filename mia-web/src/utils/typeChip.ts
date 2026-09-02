import type { TimelineItemType } from '@/types/event'
import { getCustomType } from '@/config/customTypes'

/** 类型胶囊的视觉配置 */
export interface TypeChipStyle {
  label: string
  icon: string
  color: string
  bg: string
}

/** 各类型对应的标签、emoji、配色 */
export const TYPE_CHIP_MAP: Record<string, TypeChipStyle> = {
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
  daily: {
    label: '日常',
    icon: '📒',
    color: '#c4a574',
    bg: '#f3eadc',
  },
  emotion: {
    label: '情绪',
    icon: '🫧',
    color: '#e8a87c',
    bg: '#f8e6d8',
  },
  diet: {
    label: '吃喝拉撒睡',
    icon: '🥣',
    color: '#d4896a',
    bg: '#f5e0d6',
  },
  social: {
    label: '社交',
    icon: '👋',
    color: '#7eb8b2',
    bg: '#dceeed',
  },
  medical: {
    label: '医疗',
    icon: '💊',
    color: '#6b8fd6',
    bg: '#dde6f5',
  },
  highlight: {
    label: '高光',
    icon: '✨',
    color: '#e8b84a',
    bg: '#fbf0d6',
  },
  quote: {
    label: '语录',
    icon: '💬',
    color: '#a98bc4',
    bg: '#ede5f3',
  },
  // 历史数据兼容
  sleep: {
    label: '睡眠',
    icon: '🌙',
    color: '#6ba3d6',
    bg: '#dceaf5',
  },
  health: {
    label: '健康',
    icon: '🌙',
    color: '#6ba3d6',
    bg: '#dceaf5',
  },
  question: {
    label: '想问',
    icon: '❓',
    color: '#f5c45e',
    bg: '#fbf0d6',
  },
}

/** 自定义类型默认配色 */
const CUSTOM_TYPE_STYLE = {
  color: '#96867a',
  bg: '#f3eadc',
}

/**
 * 按事件类型取胶囊样式；自定义类型读本地元数据
 */
export function getTypeChipStyle(type: TimelineItemType | string): TypeChipStyle {
  const builtin = TYPE_CHIP_MAP[type]
  if (builtin) {
    return builtin
  }
  const custom = getCustomType(type)
  if (custom) {
    return {
      label: custom.label,
      icon: custom.icon,
      ...CUSTOM_TYPE_STYLE,
    }
  }
  return {
    label: type.startsWith('c_') ? type.slice(2) : type,
    icon: '⭐',
    ...CUSTOM_TYPE_STYLE,
  }
}
