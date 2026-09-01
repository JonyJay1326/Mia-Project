import { Module } from '@nestjs/common'
import { DbModule } from './db/db.module'
import { AuthModule } from './auth/auth.module'
import { HealthController } from './health.controller'
import { EventsModule } from './events/events.module'
import { QuotesModule } from './quotes/quotes.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { PhotosModule } from './photos/photos.module'
import { SkillsModule } from './skills/skills.module'
import { AiModule } from './ai/ai.module'
import { SeedService } from './seed/seed.service'

/** 应用根模块 */
@Module({
  imports: [
    DbModule,
    AuthModule,
    EventsModule,
    QuotesModule,
    AnalyticsModule,
    PhotosModule,
    SkillsModule,
    AiModule,
  ],
  controllers: [HealthController],
  providers: [SeedService],
})
export class AppModule {}
