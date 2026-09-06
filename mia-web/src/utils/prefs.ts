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

const ALLOWED_CAREGIVERS = new Set<CaregiverType>(['mom', 'dad'])
const ALLOWED_LOCATIONS = new Set<LocationType>([
  'home',
  'outdoor',
  'mall',
  'grandparents',
  'taoshudi',
  'tongtong',
  'school',
  'other',
])

/** 校正偏好，避免旧爷奶等无效选项残留 */
function normalizePrefs(prefs: LastPrefs): LastPrefs {
  return {
    caregiver: ALLOWED_CAREGIVERS.has(prefs.caregiver)
      ? prefs.caregiver
      : DEFAULT_PREFS.caregiver,
    location: ALLOWED_LOCATIONS.has(prefs.location)
      ? prefs.location
      : DEFAULT_PREFS.location,
  }
}

/** 读取上次记录人 / 地点 */
export function loadLastPrefs(): LastPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return { ...DEFAULT_PREFS }
    }
    return normalizePrefs({
      ...DEFAULT_PREFS,
      ...(JSON.parse(raw) as LastPrefs),
    })
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** 保存上次记录人 / 地点 */
export function saveLastPrefs(prefs: LastPrefs) {
  localStorage.setItem(KEY, JSON.stringify(normalizePrefs(prefs)))
}
