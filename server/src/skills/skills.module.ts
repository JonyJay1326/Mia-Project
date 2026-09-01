import { Module } from '@nestjs/common'
import { SkillsController } from './skills.controller'
import { SkillsService } from './skills.service'

/** 阶段三：技能地图 */
@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
