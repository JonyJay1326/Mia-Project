import { Controller, Get } from '@nestjs/common'
import { Public } from './auth/public.decorator'

/** 健康检查：确认服务与进程存活 */
@Controller('health')
export class HealthController {
  /** 返回存活状态 */
  @Public()
  @Get()
  check() {
    return { ok: true, data: { status: 'up', at: new Date().toISOString() } }
  }
}
