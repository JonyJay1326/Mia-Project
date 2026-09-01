import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import {
  CreateSkillInput,
  MarkSkillInput,
  SkillsService,
} from './skills.service'

/** 技能地图接口 */
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * 按领域分组的技能地图
   * GET /api/skills
   */
  @Get()
  list() {
    return { ok: true, data: this.skillsService.listGrouped() }
  }

  /**
   * 新建自定义技能（可 AI 分类）
   * POST /api/skills
   */
  @Post()
  async create(@Body() body: CreateSkillInput) {
    const data = await this.skillsService.createCustom(body)
    return { ok: true, data }
  }

  /**
   * 更新掌握状态（todo / emerging / done）
   * PUT /api/skills/:id/mark
   */
  @Put(':id/mark')
  mark(@Param('id') id: string, @Body() body: MarkSkillInput) {
    const data = this.skillsService.mark(id, body)
    return { ok: true, data }
  }
}
