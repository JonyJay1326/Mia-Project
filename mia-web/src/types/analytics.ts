/** 带计数的排行项 */
export interface CountItem {
  key: string
  label: string
  count: number
}

/** 按周趋势点 */
export interface WeekBucket {
  weekStart: string
  label: string
  count: number
}

/** 应对方式出现次数 */
export interface CopingItem {
  key: string
  count: number
}

/** 午睡对照 */
export interface NappedCompare {
  nappedYes: number
  nappedNo: number
  nappedUnknown: number
}

/** 崩溃分析汇总（与后端一致） */
export interface MeltdownAnalytics {
  days: number
  sampleSize: number
  canConclude: boolean
  intensityCount: number
  avgIntensity: number | null
  durationCount: number
  avgDurationMin: number | null
  byWeek: WeekBucket[]
  byChip: CountItem[]
  byTrigger: CountItem[]
  byLocation: CountItem[]
  byCaregiver: CountItem[]
  byCoping: CopingItem[]
  byNapped: NappedCompare
  byHour: CountItem[]
  byWeekday: CountItem[]
}
