import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import multipart from '@fastify/multipart'
import { loadDotEnv } from './load-env'
import { AppModule } from './app.module'

/** 启动 NestJS（Fastify 适配器），仅监听本机供 Nginx 反代 */
async function bootstrap() {
  loadDotEnv()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  // 上传用 Fastify multipart（图片 20MB / 视频 100MB；视频可再带一张封面）
  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024,
      files: 2,
    },
  })

  app.setGlobalPrefix('api')
  app.enableCors({ origin: true })

  const port = Number(process.env.MIA_PORT ?? '3000')
  const host = process.env.MIA_HOST ?? '127.0.0.1'

  // 只绑 127.0.0.1，避免绕过 Nginx 裸奔公网
  await app.listen(port, host)
  console.log(`Mia API listening on http://${host}:${port}/api`)
}

bootstrap()
