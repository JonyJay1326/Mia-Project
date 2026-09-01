import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { loadAuthConfig } from './auth.config'

/** 登录成功返回 */
export interface AuthSession {
  token: string
  username: string
  expiresAt: string
}

/** 令牌载荷 */
interface TokenPayload {
  sub: string
  exp: number
}

/**
 * 登录校验与令牌签发
 */
@Injectable()
export class AuthService {
  /** 读取配置 */
  getConfig() {
    return loadAuthConfig()
  }

  /** 是否已启用登录 */
  isEnabled(): boolean {
    return loadAuthConfig().enabled
  }

  /**
   * 校验账号密码并签发令牌
   */
  login(username: string, password: string): AuthSession {
    const cfg = loadAuthConfig()
    if (!cfg.enabled) {
      throw new ServiceUnavailableException(
        '服务端未配置登录密码（MIA_AUTH_PASSWORD）',
      )
    }

    const userOk = this.safeEqual(username.trim(), cfg.username)
    const passOk = this.safeEqual(password, cfg.password)
    if (!userOk || !passOk) {
      throw new UnauthorizedException('账号或密码不正确')
    }

    const expiresAt = new Date(Date.now() + cfg.tokenTtlMs).toISOString()
    const token = this.signToken(cfg.username, cfg.tokenTtlMs, cfg.secret)
    return { token, username: cfg.username, expiresAt }
  }

  /**
   * 校验 Bearer 令牌；无效则抛 401
   */
  verifyToken(token: string | undefined | null): string {
    const cfg = loadAuthConfig()
    if (!cfg.enabled) {
      return cfg.username
    }
    if (!token?.trim()) {
      throw new UnauthorizedException('请先登录')
    }
    const username = this.parseToken(token.trim(), cfg.secret)
    if (!username) {
      throw new UnauthorizedException('登录已过期，请重新登录')
    }
    return username
  }

  /** 当前登录态摘要（给前端刷新用） */
  me(token: string | undefined | null) {
    const cfg = loadAuthConfig()
    if (!cfg.enabled) {
      return { username: cfg.username, expiresAt: null }
    }
    const username = this.verifyToken(token)
    const payload = this.decodePayload(token!.trim(), cfg.secret)
    return {
      username,
      expiresAt: payload ? new Date(payload.exp).toISOString() : null,
    }
  }

  /**
   * 恒定时间比较字符串，降低时序攻击风险
   */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      return false
    }
    return timingSafeEqual(bufA, bufB)
  }

  /**
   * 签发 HMAC 令牌：base64url(payload).base64url(sig)
   */
  private signToken(sub: string, ttlMs: number, secret: string): string {
    const payload: TokenPayload = {
      sub,
      exp: Date.now() + ttlMs,
    }
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = createHmac('sha256', secret).update(body).digest('base64url')
    return `${body}.${sig}`
  }

  /**
   * 解析并验签；成功返回用户名
   */
  private parseToken(token: string, secret: string): string | null {
    const payload = this.decodePayload(token, secret)
    if (!payload) {
      return null
    }
    if (payload.exp <= Date.now()) {
      return null
    }
    return payload.sub
  }

  /**
   * 解码并验签 payload
   */
  private decodePayload(token: string, secret: string): TokenPayload | null {
    const parts = token.split('.')
    if (parts.length !== 2) {
      return null
    }
    const [body, sig] = parts
    const expected = createHmac('sha256', secret).update(body).digest('base64url')
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null
    }
    try {
      const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload
      if (!json.sub || typeof json.exp !== 'number') {
        return null
      }
      return json
    } catch {
      return null
    }
  }
}
