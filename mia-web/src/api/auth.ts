import { request } from '@/api/client'

/** 登录配置状态 */
export interface AuthStatus {
  enabled: boolean
  usernameHint: string | null
}

/** 登录成功响应 */
export interface AuthSession {
  token: string
  username: string
  expiresAt: string
}

/** 当前用户摘要 */
export interface AuthMe {
  username: string
  expiresAt: string | null
}

/** 查询是否启用登录 */
export function fetchAuthStatus() {
  return request<AuthStatus>('/auth/status')
}

/** 账号密码登录 */
export function postLogin(body: { username: string; password: string }) {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 校验当前令牌是否仍有效 */
export function fetchAuthMe() {
  return request<AuthMe>('/auth/me')
}
