import { request } from '@/api/client'
import type { MeltdownAnalytics } from '@/types/analytics'

/**
 * 拉取崩溃统计分析
 * @param days 回溯天数
 */
export function fetchMeltdownAnalytics(days = 60) {
  return request<MeltdownAnalytics>(`/analytics/meltdown?days=${days}`)
}
