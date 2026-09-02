import type { CaregiverType, LocationType, TriggerType } from '@/types/event'

/** 场景卡片预填字段 */
export type ScenePreset = {
  /** 内置 EventType 或自定义 key（c_xxx） */
  type: string
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
  /** 自定义类型中文名（仅 custom） */
  typeLabel?: string
  /** 自定义场景专属 chips（仅 custom） */
  chips?: string[]
}

/** 默认场景：崩溃 + 高光 + 各类型入口（细节靠 chips） */
export const DEFAULT_SCENES: Scene[] = [
  {
    id: 'meltdown',
    label: '崩溃',
    icon: '🍭',
    preset: { type: 'meltdown' },
    order: 1,
    count: 0,
  },
  {
    id: 'highlight',
    label: '高光时刻',
    icon: '✨',
    preset: { type: 'highlight' },
    order: 2,
    count: 0,
  },
  {
    id: 'new-skill',
    label: '新技能',
    icon: '🌱',
    preset: { type: 'skill' },
    order: 3,
    count: 0,
  },
  {
    id: 'daily',
    label: '日常点滴',
    icon: '📒',
    preset: { type: 'daily' },
    order: 4,
    count: 0,
  },
  {
    id: 'emotion',
    label: '情绪观察',
    icon: '🫧',
    preset: { type: 'emotion' },
    order: 5,
    count: 0,
  },
  {
    id: 'diet',
    label: '吃喝拉撒睡',
    icon: '🥣',
    preset: { type: 'diet' },
    order: 6,
    count: 0,
  },
  {
    id: 'social',
    label: '社交分离',
    icon: '👋',
    preset: { type: 'social' },
    order: 7,
    count: 0,
  },
  {
    id: 'medical',
    label: '医疗',
    icon: '💊',
    preset: { type: 'medical' },
    order: 8,
    count: 0,
  },
]

/** v3：崩溃收成单卡；加载时会同步内置卡名称并剔除已下线的 sleep */
const STORAGE_KEY = 'mia-scenes-v3'

/** 场景本地持久化结构 */
interface ScenesStorage {
  scenes: Scene[]
  /** 用户拖拽后的 id 顺序；有则优先于 count 排序 */
  orderIds?: string[]
}

/** 从 localStorage 读取场景配置，无则返回默认场景 */
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
    return syncBuiltinSceneMeta(parsed.scenes)
  } catch {
    return structuredClone(DEFAULT_SCENES)
  }
}

/**
 * 内置场景以默认表为准：更新文案、补上新增卡、去掉已下线卡（如 sleep）
 * 自定义卡保留
 */
function syncBuiltinSceneMeta(scenes: Scene[]): Scene[] {
  const defaults = new Map(DEFAULT_SCENES.map((s) => [s.id, s]))
  const custom = scenes.filter((s) => s.custom)
  const syncedBuiltin: Scene[] = []
  const seen = new Set<string>()

  for (const scene of scenes) {
    if (scene.custom) {
      continue
    }
    const def = defaults.get(scene.id)
    if (!def) {
      continue
    }
    syncedBuiltin.push({
      ...scene,
      label: def.label,
      icon: def.icon,
      order: def.order,
      preset: { ...def.preset, ...scene.preset, type: def.preset.type },
    })
    seen.add(scene.id)
  }

  for (const def of DEFAULT_SCENES) {
    if (!seen.has(def.id)) {
      syncedBuiltin.push(structuredClone(def))
    }
  }

  return [...syncedBuiltin, ...custom]
}

/** 读取用户拖拽顺序 */
export function loadSceneOrderIds(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as ScenesStorage
    const ids = parsed.orderIds ?? null
    if (!ids) {
      return null
    }
    const allowed = new Set([
      ...DEFAULT_SCENES.map((s) => s.id),
      ...(parsed.scenes ?? []).filter((s) => s.custom).map((s) => s.id),
    ])
    return ids.filter((id) => allowed.has(id))
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
