import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import {
  CreateSkillInput,
  MarkSkillInput,
  SkillsService,
  UpdateNoteInput,
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

  /**
   * 更新备注（无标记时默认记为刚出现）
   * PATCH /api/skills/:id/note
   */
  @Patch(':id/note')
  updateNote(@Param('id') id: string, @Body() body: UpdateNoteInput) {
    const data = this.skillsService.updateNote(id, body.note ?? null)
    return { ok: true, data }
  }

  /**
   * 删除自定义技能（目录项不可删）
   * DELETE /api/skills/:id
   */
  @Delete(':id')
  removeCustom(@Param('id') id: string) {
    const data = this.skillsService.removeCustom(id)
    return { ok: true, data }
  }
}
