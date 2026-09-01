import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { suggestSceneEmoji } from './scene-emoji'
import { classifySkillLabel } from '../skills/skill-classify'
import {
  AiService,
  type ChatRequest,
  type InsightRequest,
} from './ai.service'

/** AI 咨询 / 解读接口 */
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * 配置状态（不泄露 API Key）
   * GET /api/ai/status
   */
  @Get('status')
  status() {
    return { ok: true, data: this.aiService.getStatus() }
  }

  /**
   * 咨询历史列表
   * GET /api/ai/chats
   */
  @Get('chats')
  listChats(@Query('limit') limit?: string) {
    const data = this.aiService.listChats(
      limit ? Number(limit) : undefined,
    )
    return { ok: true, data }
  }

  /**
   * 单条咨询历史
   * GET /api/ai/chats/:id
   */
  @Get('chats/:id')
  getChat(@Param('id') id: string) {
    return { ok: true, data: this.aiService.getChat(id) }
  }

  /**
   * 删除咨询历史
   * DELETE /api/ai/chats/:id
   */
  @Delete('chats/:id')
  removeChat(@Param('id') id: string) {
    return { ok: true, data: this.aiService.removeChat(id) }
  }

  /**
   * 多轮咨询
   * POST /api/ai/chat
   */
  @Post('chat')
  async chat(@Body() body: ChatRequest) {
    const data = await this.aiService.chat(body ?? { messages: [] })
    return { ok: true, data }
  }

  /**
   * 一键解读崩溃统计
   * POST /api/ai/insight
   */
  @Post('insight')
  async insight(@Body() body: InsightRequest) {
    const data = await this.aiService.insight(body ?? {})
    return { ok: true, data }
  }

  /**
   * 技能描述预览：emoji + 领域（不写库）
   * POST /api/ai/skill-suggest
   */
  @Post('skill-suggest')
  async skillSuggest(@Body() body: { label?: string }) {
    const data = await classifySkillLabel(body?.label ?? '')
    return { ok: true, data }
  }

  /**
   * 场景名称预览 emoji（不写库）
   * POST /api/ai/scene-suggest
   */
  @Post('scene-suggest')
  async sceneSuggest(@Body() body: { label?: string }) {
    const data = await suggestSceneEmoji(body?.label ?? '')
    return { ok: true, data }
  }
}
