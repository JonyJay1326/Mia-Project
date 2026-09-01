import type { CaregiverType, EventType, LocationType, TriggerType } from '@/types/event'

/** 场景卡片预填字段 */
export type ScenePreset = {
  type: EventType
  location?: LocationType
  trigger?: TriggerType
  caregiver?: CaregiverType
}

/** 场景卡片定义 */
export interface Scene {
  id: string
  label: string
  /** 用 emoji，不用 Element Plus 图标 */
  icon: string
  preset: ScenePreset
  /** 初始排序权重，越小越靠前；实际展示还会叠加上使用次数 */
  order: number
  /** 使用次数，本地持久化后按此降序 */
  count: number
  /** 是否用户自定义（可删除） */
  custom?: boolean
}

/** 默认 8 张场景（基于 Mia 档案高发场景） */
export const DEFAULT_SCENES: Scene[] = [
  {
    id: 'mall-want',
    label: '商场要买',
    icon: '🛒',
    preset: { type: 'meltdown', location: 'mall', trigger: 'refused' },
    order: 1,
    count: 0,
  },
  {
    id: 'no-gohome',
    label: '不想回家',
    icon: '🚶',
    preset: { type: 'meltdown', location: 'outdoor', trigger: 'interrupted' },
    order: 2,
    count: 0,
  },
  {
    id: 'order-broken',
    label: '顺序被打乱',
    icon: '🔀',
    preset: { type: 'meltdown', trigger: 'order' },
    order: 3,
    count: 0,
  },
  {
    id: 'dress-food',
    label: '吃饭穿衣',
    icon: '🍚',
    preset: { type: 'meltdown', trigger: 'dressed' },
    order: 4,
    count: 0,
  },
  {
    id: 'sleep-fight',
    label: '睡前闹',
    icon: '🌙',
    preset: { type: 'meltdown', location: 'home', trigger: 'bedtime' },
    order: 5,
    count: 0,
  },
  {
    id: 'new-skill',
    label: '新技能',
    icon: '🌱',
    preset: { type: 'skill' },
    order: 6,
    count: 0,
  },
  {
    id: 'health',
    label: '身体',
    icon: '💊',
    preset: { type: 'health' },
    order: 7,
    count: 0,
  },
  {
    id: 'question',
    label: '想问',
    icon: '❓',
    preset: { type: 'question' },
    order: 8,
    count: 0,
  },
]

const STORAGE_KEY = 'mia-scenes-v1'

/** 场景本地持久化结构 */
interface ScenesStorage {
  scenes: Scene[]
  /** 用户拖拽后的 id 顺序；有则优先于 count 排序 */
  orderIds?: string[]
}

/** 从 localStorage 读取场景配置，无则返回默认 8 张 */
export function loadScenes(): Scene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return structuredClone(DEFAULT_SCENES)
    }
    const parsed = JSON.parse(raw) as ScenesStorage
    if (!parsed.scenes?.length) {
      return structuredClone(DEFAULT_SCENES)
    }
    return parsed.scenes
  } catch {
    return structuredClone(DEFAULT_SCENES)
  }
}

/** 读取用户拖拽顺序 */
export function loadSceneOrderIds(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as ScenesStorage
    return parsed.orderIds ?? null
  } catch {
    return null
  }
}

/** 持久化场景列表与可选顺序 */
export function saveScenes(scenes: Scene[], orderIds?: string[]) {
  const payload: ScenesStorage = { scenes, orderIds }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/**
 * 展示排序：若有手动拖拽顺序则按之；否则按 count 降序，相同则按 order 升序
 */
export function sortScenesForDisplay(
  scenes: Scene[],
  orderIds: string[] | null,
): Scene[] {
  if (orderIds?.length) {
    const map = new Map(scenes.map((s) => [s.id, s]))
    const ordered: Scene[] = []
    for (const id of orderIds) {
      const hit = map.get(id)
      if (hit) {
        ordered.push(hit)
        map.delete(id)
      }
    }
    // 新增但未进 orderIds 的，追加到末尾
    for (const rest of map.values()) {
      ordered.push(rest)
    }
    return ordered
  }

  return [...scenes].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return a.order - b.order
  })
}
