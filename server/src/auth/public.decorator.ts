import { SetMetadata } from '@nestjs/common'

/** 标记接口无需登录 */
export const IS_PUBLIC_KEY = 'isPublic'

/**
 * 跳过鉴权（登录、健康检查等）
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
