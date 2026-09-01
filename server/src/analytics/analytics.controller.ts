import { Controller, Get, Query } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'

/** 分析接口 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 崩溃统计：默认近 60 天
   * GET /api/analytics/meltdown?days=60
   */
  @Get('meltdown')
  getMeltdown(@Query('days') days?: string) {
    const parsed = days ? Number(days) : 60
    const data = this.analyticsService.getMeltdownAnalytics(
      Number.isFinite(parsed) ? parsed : 60,
    )
    return { ok: true, data }
  }
}
