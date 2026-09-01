import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import type { EventInput } from '../types/event'
import { EventsService } from './events.service'

/** 事件 REST 接口（全局前缀 api → /api/events） */
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** 幂等创建：相同 id 已存在则忽略 */
  @Post()
  create(@Body() body: EventInput) {
    const data = this.eventsService.create(body)
    return { ok: true, data }
  }

  /** 时间线分页：按 happened_at 倒序 */
  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('type') type?: string,
  ) {
    const data = this.eventsService.list({
      limit: limit ? Number(limit) : 50,
      before,
      type,
    })
    return { ok: true, data }
  }

  /** 按 id 取单条 */
  @Get(':id')
  getOne(@Param('id') id: string) {
    const data = this.eventsService.findById(id)
    if (!data) {
      return { ok: false, error: '事件不存在' }
    }
    return { ok: true, data }
  }

  /** 补充 / 修改详情 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<EventInput>) {
    const data = this.eventsService.update(id, body)
    if (!data) {
      return { ok: false, error: '事件不存在' }
    }
    return { ok: true, data }
  }

  /** 删除事件 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    const removed = this.eventsService.remove(id)
    if (!removed) {
      return { ok: false, error: '事件不存在' }
    }
    return { ok: true, data: { id } }
  }
}
