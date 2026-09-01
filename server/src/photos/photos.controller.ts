import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { MultipartFile } from '@fastify/multipart'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { PhotosService } from './photos.service'
import { Public } from '../auth/public.decorator'

/** 带 multipart.file() 的 Fastify 请求 */
type MultipartRequest = FastifyRequest & {
  file: () => Promise<MultipartFile | undefined>
}

/** 相册接口 */
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /**
   * 上传照片（multipart 字段名 file）
   * POST /api/photos
   */
  @Post()
  async upload(@Req() req: MultipartRequest) {
    const file = await req.file()
    if (!file) {
      return { ok: false, error: '请选择图片文件（字段名 file）' }
    }
    const buffer = await file.toBuffer()
    const data = await this.photosService.createFromUpload({
      buffer,
      filename: file.filename,
      mimetype: file.mimetype,
    })
    return { ok: true, data }
  }

  /**
   * 列表
   * GET /api/photos?limit=48&before=<iso>
   */
  @Get()
  list(@Query('limit') limit?: string, @Query('before') before?: string) {
    const parsed = limit ? Number(limit) : 48
    const data = this.photosService.list({
      limit: Number.isFinite(parsed) ? parsed : 48,
      before,
    })
    return { ok: true, data }
  }

  /**
   * 取文件流（img 标签无法带 Bearer，故公开；UUID 不易猜测）
   * GET /api/photos/:id/file?v=thumb|original
   */
  @Public()
  @Get(':id/file')
  streamFile(
    @Param('id') id: string,
    @Query('v') variant: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const v = variant === 'original' ? 'original' : 'thumb'
    const file = this.photosService.openFile(id, v)
    reply.header('Content-Type', file.mime)
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(file.stream)
  }

  /**
   * 单条元数据
   * GET /api/photos/:id
   */
  @Get(':id')
  one(@Param('id') id: string) {
    const data = this.photosService.findById(id)
    if (!data) {
      return { ok: false, error: '照片不存在' }
    }
    return { ok: true, data }
  }

  /**
   * 删除
   * DELETE /api/photos/:id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    const ok = this.photosService.remove(id)
    if (!ok) {
      return { ok: false, error: '照片不存在' }
    }
    return { ok: true }
  }
}
