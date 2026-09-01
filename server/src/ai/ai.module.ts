import { Module } from '@nestjs/common'
import { AnalyticsModule } from '../analytics/analytics.module'
import { SkillsModule } from '../skills/skills.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

/** 阶段三：AI 咨询（OpenAI 兼容，密钥仅服务端） */
@Module({
  imports: [AnalyticsModule, SkillsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
