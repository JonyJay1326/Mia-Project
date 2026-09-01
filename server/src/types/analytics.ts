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

/** 应对方式出现次数（outcome 为自由文本，仅统计出现频次） */
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

/** 崩溃分析汇总 */
export interface MeltdownAnalytics {
  /** 统计窗口天数 */
  days: number
  /** 样本数 */
  sampleSize: number
  /** 样本是否足够下结论（≥5） */
  canConclude: boolean
  /** 有强度值的条数 */
  intensityCount: number
  /** 平均强度（1–5），无数据为 null */
  avgIntensity: number | null
  /** 有时长的条数 */
  durationCount: number
  /** 平均时长（分钟），无数据为 null */
  avgDurationMin: number | null
  /** 按周计数（旧→新） */
  byWeek: WeekBucket[]
  /** 触发 chip 排行 */
  byChip: CountItem[]
  /** 触发原因排行 */
  byTrigger: CountItem[]
  /** 地点排行 */
  byLocation: CountItem[]
  /** 照护人排行 */
  byCaregiver: CountItem[]
  /** 应对方式排行 */
  byCoping: CopingItem[]
  /** 午睡对照 */
  byNapped: NappedCompare
  /** 按时段（本地小时 0–23，仅非 0 或全部 24 槽） */
  byHour: CountItem[]
  /** 按星期（周一→周日） */
  byWeekday: CountItem[]
}
