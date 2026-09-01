import { Injectable } from '@nestjs/common'
import { DbService } from '../db/db.service'
import type { EventRow } from '../types/event'
import type {
  CountItem,
  CopingItem,
  MeltdownAnalytics,
  WeekBucket,
} from '../types/analytics'
import { mapEventRow } from '../utils/mappers'

const TRIGGER_LABELS: Record<string, string> = {
  refused: '要求被拒',
  interrupted: '被打断',
  order: '顺序被打乱',
  dressed: '穿衣',
  food: '吃饭',
  share: '分享/抢玩具',
  bedtime: '睡前',
  unknown: '不明',
}

const LOCATION_LABELS: Record<string, string> = {
  home: '家里',
  outdoor: '户外',
  mall: '商场',
  grandparents: '爷奶家',
  other: '其他',
}

const CAREGIVER_LABELS: Record<string, string> = {
  mom: '妈妈',
  dad: '爸爸',
  grandma: '奶奶',
  grandpa: '爷爷',
}

/** 崩溃分析聚合服务 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly dbService: DbService) {}

  /**
   * 聚合指定天数内的崩溃事件统计
   * @param days 回溯天数，默认 60，上限 365
   */
  getMeltdownAnalytics(days = 60): MeltdownAnalytics {
    const safeDays = Math.min(Math.max(Math.floor(days) || 60, 1), 365)
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (safeDays - 1))
    const sinceIso = since.toISOString()

    const rows = this.dbService.db
      .prepare(
        `SELECT * FROM events
         WHERE type = 'meltdown' AND happened_at >= ?
         ORDER BY happened_at ASC`,
      )
      .all(sinceIso) as EventRow[]

    const events = rows.map(mapEventRow)
    const sampleSize = events.length

    let intensitySum = 0
    let intensityCount = 0
    let durationSum = 0
    let durationCount = 0
    const chipMap = new Map<string, number>()
    const triggerMap = new Map<string, number>()
    const locationMap = new Map<string, number>()
    const caregiverMap = new Map<string, number>()
    const copingMap = new Map<string, number>()
    const napped = { nappedYes: 0, nappedNo: 0, nappedUnknown: 0 }
    const weekMap = new Map<string, number>()
    const hourSlotMap = new Map<string, number>()
    const weekdayMap = new Map<string, number>([
      ['1', 0],
      ['2', 0],
      ['3', 0],
      ['4', 0],
      ['5', 0],
      ['6', 0],
      ['0', 0],
    ])

    for (const ev of events) {
      if (typeof ev.intensity === 'number') {
        intensitySum += ev.intensity
        intensityCount += 1
      }
      if (typeof ev.durationMin === 'number') {
        durationSum += ev.durationMin
        durationCount += 1
      }

      for (const chip of ev.chips ?? []) {
        const key = chip.trim()
        if (!key) continue
        chipMap.set(key, (chipMap.get(key) ?? 0) + 1)
      }

      const triggerKey = ev.trigger ?? 'unknown'
      triggerMap.set(triggerKey, (triggerMap.get(triggerKey) ?? 0) + 1)

      const locationKey = ev.location ?? 'other'
      locationMap.set(locationKey, (locationMap.get(locationKey) ?? 0) + 1)

      const caregiverKey = ev.caregiver || 'mom'
      caregiverMap.set(caregiverKey, (caregiverMap.get(caregiverKey) ?? 0) + 1)

      for (const coping of ev.coping ?? []) {
        const key = coping.trim()
        if (!key) continue
        copingMap.set(key, (copingMap.get(key) ?? 0) + 1)
      }

      if (ev.napped === 1) napped.nappedYes += 1
      else if (ev.napped === 0) napped.nappedNo += 1
      else napped.nappedUnknown += 1

      const weekStart = mondayOf(ev.happenedAt)
      weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + 1)

      const when = new Date(ev.happenedAt)
      const slot = hourSlotOf(when.getHours())
      hourSlotMap.set(slot.key, (hourSlotMap.get(slot.key) ?? 0) + 1)

      const wd = String(when.getDay())
      weekdayMap.set(wd, (weekdayMap.get(wd) ?? 0) + 1)
    }

    return {
      days: safeDays,
      sampleSize,
      canConclude: sampleSize >= 5,
      intensityCount,
      avgIntensity:
        intensityCount > 0
          ? Math.round((intensitySum / intensityCount) * 10) / 10
          : null,
      durationCount,
      avgDurationMin:
        durationCount > 0
          ? Math.round((durationSum / durationCount) * 10) / 10
          : null,
      byWeek: fillWeekBuckets(since, weekMap),
      byChip: toRanked(chipMap),
      byTrigger: toRanked(triggerMap, TRIGGER_LABELS),
      byLocation: toRanked(locationMap, LOCATION_LABELS),
      byCaregiver: toRanked(caregiverMap, CAREGIVER_LABELS),
      byCoping: toCopingRanked(copingMap),
      byNapped: napped,
      byHour: HOUR_SLOTS.map((slot) => ({
        key: slot.key,
        label: slot.label,
        count: hourSlotMap.get(slot.key) ?? 0,
      })).filter((item) => item.count > 0),
      byWeekday: WEEKDAY_ORDER.map((key) => ({
        key,
        label: WEEKDAY_LABELS[key],
        count: weekdayMap.get(key) ?? 0,
      })),
    }
  }
}

/** 时段定义（本地小时） */
const HOUR_SLOTS = [
  { key: 'dawn', label: '凌晨 0–6', from: 0, to: 6 },
  { key: 'morning', label: '上午 6–11', from: 6, to: 11 },
  { key: 'noon', label: '中午 11–14', from: 11, to: 14 },
  { key: 'afternoon', label: '下午 14–17', from: 14, to: 17 },
  { key: 'evening', label: '傍晚 17–20', from: 17, to: 20 },
  { key: 'night', label: '晚上 20–24', from: 20, to: 24 },
] as const

const WEEKDAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const

const WEEKDAY_LABELS: Record<string, string> = {
  '1': '周一',
  '2': '周二',
  '3': '周三',
  '4': '周四',
  '5': '周五',
  '6': '周六',
  '0': '周日',
}

/**
 * 将小时映射到时段
 */
function hourSlotOf(hour: number): (typeof HOUR_SLOTS)[number] {
  for (const slot of HOUR_SLOTS) {
    if (hour >= slot.from && hour < slot.to) {
      return slot
    }
  }
  return HOUR_SLOTS[HOUR_SLOTS.length - 1]
}

/**
 * 取 ISO 日期所在周的周一（本地时区，YYYY-MM-DD）
 */
function mondayOf(iso: string): string {
  const d = new Date(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + diff)
  return formatYmd(d)
}

/**
 * 从窗口起点起按周填满桶，无数据的周 count=0
 */
function fillWeekBuckets(
  since: Date,
  weekMap: Map<string, number>,
): WeekBucket[] {
  const start = new Date(since)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets: WeekBucket[] = []

  for (let cur = new Date(start); cur <= today; cur.setDate(cur.getDate() + 7)) {
    const weekStart = formatYmd(cur)
    const end = new Date(cur)
    end.setDate(end.getDate() + 6)
    buckets.push({
      weekStart,
      label: `${formatMd(cur)}–${formatMd(end)}`,
      count: weekMap.get(weekStart) ?? 0,
    })
  }

  return buckets
}

/**
 * Map 转降序排行，可选中文标签
 */
function toRanked(
  map: Map<string, number>,
  labels?: Record<string, string>,
): CountItem[] {
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: labels?.[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'))
}

/**
 * 应对方式排行
 */
function toCopingRanked(map: Map<string, number>): CopingItem[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'zh'))
}

/** 格式化为 YYYY-MM-DD */
function formatYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 格式化为 M/D */
function formatMd(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
