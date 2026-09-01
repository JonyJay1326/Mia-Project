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
import type { FastifyReply, FastifyRequest } from 'fastify'
import { PhotosService } from './photos.service'
import { Public } from '../auth/public.decorator'

/** 带 multipart.parts() 的 Fastify 请求 */
type MultipartRequest = FastifyRequest & {
  parts: () => AsyncIterableIterator<{
    type: string
    fieldname: string
    filename?: string
    mimetype?: string
    toBuffer: () => Promise<Buffer>
  }>
}

/** 相册接口 */
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /**
   * 上传照片或视频（multipart：file 必填；视频可选 thumb 封面）
   * POST /api/photos
   */
  @Post()
  async upload(@Req() req: MultipartRequest) {
    let main:
      | { buffer: Buffer; filename?: string; mimetype: string }
      | undefined
    let thumbBuffer: Buffer | undefined

    for await (const part of req.parts()) {
      if (part.type !== 'file') {
        continue
      }
      const buffer = await part.toBuffer()
      if (part.fieldname === 'thumb') {
        thumbBuffer = buffer
        continue
      }
      if (part.fieldname === 'file' || !main) {
        main = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype || 'application/octet-stream',
        }
      }
    }

    if (!main) {
      return { ok: false, error: '请选择图片或视频文件（字段名 file）' }
    }

    const data = await this.photosService.createFromUpload({
      buffer: main.buffer,
      filename: main.filename,
      mimetype: main.mimetype,
      thumbBuffer,
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
