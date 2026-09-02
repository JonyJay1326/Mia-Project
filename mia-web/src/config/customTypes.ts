/** 自定义事件类型元数据（AI 生成，本地持久化） */
export interface CustomTypeMeta {
  key: string
  label: string
  icon: string
  chips: string[]
}

const STORAGE_KEY = 'mia-custom-types'

/** 读取全部自定义类型 */
export function loadCustomTypes(): Record<string, CustomTypeMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, CustomTypeMeta>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** 写入全部自定义类型 */
function saveCustomTypes(map: Record<string, CustomTypeMeta>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/** 登记 / 更新自定义类型 */
export function upsertCustomType(meta: CustomTypeMeta) {
  const map = loadCustomTypes()
  map[meta.key] = {
    key: meta.key,
    label: meta.label.trim().slice(0, 12) || '自定义',
    icon: meta.icon || '⭐',
    chips: (meta.chips ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 8),
  }
  saveCustomTypes(map)
}

/** 按 key 取自定义类型 */
export function getCustomType(key: string): CustomTypeMeta | null {
  return loadCustomTypes()[key] ?? null
}

/** 删除自定义类型元数据 */
export function removeCustomType(key: string) {
  const map = loadCustomTypes()
  if (!(key in map)) {
    return
  }
  delete map[key]
  saveCustomTypes(map)
}
