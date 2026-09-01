import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthService } from './auth.service'
import { IS_PUBLIC_KEY } from './public.decorator'

/**
 * 全局鉴权：除 @Public 外均需 Bearer 令牌
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  /** 校验请求是否携带有效登录态 */
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    if (!this.authService.isEnabled()) {
      return true
    }

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
    const header = req.headers.authorization ?? req.headers.Authorization
    const token = this.extractBearer(header)
    try {
      this.authService.verifyToken(token)
      return true
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e
      }
      throw new UnauthorizedException('请先登录')
    }
  }

  /**
   * 从 Authorization 头取出 Bearer 令牌
   */
  private extractBearer(header?: string): string | undefined {
    if (!header) {
      return undefined
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim())
    return match?.[1]
  }
}
