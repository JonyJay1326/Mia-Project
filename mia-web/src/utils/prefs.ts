import type { CaregiverType, LocationType } from '@/types/event'

const KEY = 'mia-last-prefs'

/** 记住的默认值 */
export interface LastPrefs {
  caregiver: CaregiverType
  location: LocationType
}

const DEFAULT_PREFS: LastPrefs = {
  caregiver: 'mom',
  location: 'home',
}

/** 读取上次记录人 / 地点 */
export function loadLastPrefs(): LastPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return { ...DEFAULT_PREFS }
    }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as LastPrefs) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** 保存上次记录人 / 地点 */
export function saveLastPrefs(prefs: LastPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}
