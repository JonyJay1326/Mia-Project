/** 登录相关配置 */
export interface AuthConfig {
  enabled: boolean
  username: string
  password: string
  secret: string
  /** 令牌有效期（毫秒） */
  tokenTtlMs: number
}

/**
 * 从环境变量读取登录配置；未配密码则视为关闭鉴权（仅本地开发）
 */
export function loadAuthConfig(): AuthConfig {
  const username = process.env.MIA_AUTH_USERNAME?.trim() || 'mia'
  const password = process.env.MIA_AUTH_PASSWORD?.trim() ?? ''
  const secret =
    process.env.MIA_AUTH_SECRET?.trim() ||
    process.env.MIA_AUTH_PASSWORD?.trim() ||
    'mia-dev-secret-change-me'
  const days = Number(process.env.MIA_AUTH_TOKEN_DAYS ?? '30')
  const tokenTtlMs = Number.isFinite(days) && days > 0 ? days * 86400_000 : 30 * 86400_000

  return {
    enabled: password.length > 0,
    username,
    password,
    secret,
    tokenTtlMs,
  }
}
