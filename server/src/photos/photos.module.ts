import { Module } from '@nestjs/common'
import { PhotosController } from './photos.controller'
import { PhotosService } from './photos.service'

/** 阶段三：相册 */
@Module({
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
