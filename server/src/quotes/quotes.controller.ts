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
import type { QuoteInput } from '../types/event'
import { QuotesService } from './quotes.service'

/** 语录 REST 接口（全局前缀 api → /api/quotes） */
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  /** 幂等创建 */
  @Post()
  create(@Body() body: QuoteInput) {
    const data = this.quotesService.create(body)
    return { ok: true, data }
  }

  /**
   * 列表：默认按月龄分组；?random=1 返回随机一条（精灵气泡）
   */
  @Get()
  list(@Query('random') random?: string) {
    if (random === '1' || random === 'true') {
      const data = this.quotesService.randomOne()
      return { ok: true, data }
    }
    const data = this.quotesService.listGrouped()
    return { ok: true, data }
  }

  /** 按 id 取单条 */
  @Get(':id')
  getOne(@Param('id') id: string) {
    const data = this.quotesService.findById(id)
    if (!data) {
      return { ok: false, error: '语录不存在' }
    }
    return { ok: true, data }
  }

  /** 补充上下文 / 解读 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<QuoteInput>) {
    const data = this.quotesService.update(id, body)
    if (!data) {
      return { ok: false, error: '语录不存在' }
    }
    return { ok: true, data }
  }

  /** 删除语录 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    const removed = this.quotesService.remove(id)
    if (!removed) {
      return { ok: false, error: '语录不存在' }
    }
    return { ok: true, data: { id } }
  }
}
