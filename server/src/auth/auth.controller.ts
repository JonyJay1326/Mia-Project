import { Body, Controller, Get, Headers, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { Public } from './public.decorator'

/** 登录相关接口 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 是否启用登录（不泄露密码）
   * GET /api/auth/status
   */
  @Public()
  @Get('status')
  status() {
    const cfg = this.authService.getConfig()
    return {
      ok: true,
      data: {
        enabled: cfg.enabled,
        usernameHint: cfg.enabled ? cfg.username : null,
      },
    }
  }

  /**
   * 账号密码登录
   * POST /api/auth/login
   */
  @Public()
  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    const data = this.authService.login(body?.username ?? '', body?.password ?? '')
    return { ok: true, data }
  }

  /**
   * 校验当前令牌
   * GET /api/auth/me
   */
  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '')
    const data = this.authService.me(token)
    return { ok: true, data }
  }
}
