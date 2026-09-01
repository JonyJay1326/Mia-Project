import { Module } from '@nestjs/common'
import { QuotesController } from './quotes.controller'
import { QuotesService } from './quotes.service'
import { PhotosModule } from '../photos/photos.module'

/** 语录 CRUD 模块 */
@Module({
  imports: [PhotosModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
