const BASE = import.meta.env.VITE_API_BASE ?? '/api'

/** localStorage 中的令牌键名 */
export const AUTH_TOKEN_KEY = 'mia-auth-token'

/**
 * 读取已保存的登录令牌
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * 组装带 Authorization 的请求头
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) {
    return {}
  }
  return { Authorization: `Bearer ${token}` }
}

/** 401 时跳转登录（避免 client ↔ router 循环依赖） */
let unauthorizedHandler: (() => void) | null = null

/**
 * 注册未授权回调（在 router 初始化后调用）
 */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

/**
 * 清除本地登录态并触发跳转
 */
export function handleUnauthorized() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    /* ignore */
  }
  unauthorizedHandler?.()
}

/**
 * 从 Nest / 业务 JSON 里提取错误文案
 */
function extractErrorMessage(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') {
    return undefined
  }
  const obj = json as { error?: string; message?: string | string[] }
  if (obj.error) {
    return obj.error
  }
  if (Array.isArray(obj.message)) {
    return obj.message.join(' ')
  }
  if (typeof obj.message === 'string') {
    return obj.message
  }
  return undefined
}

/**
 * 统一请求封装：拼接 API 基址并校验 { ok, data, error } 响应
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string; message?: string | string[] }
    | null

  if (res.status === 401 && path !== '/auth/login') {
    handleUnauthorized()
    throw new Error(extractErrorMessage(json) ?? '登录已过期，请重新登录')
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(json) ?? `HTTP ${res.status}`)
  }

  if (!json?.ok) {
    throw new Error(json?.error ?? extractErrorMessage(json) ?? '请求失败')
  }

  return json.data as T
}

/**
 * 把 fetch 网络错误转成更易懂的提示
 */
export function formatFetchError(err: unknown): string {
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return '无法连接后端，请确认 API 已启动'
  }
  return err instanceof Error ? err.message : '请求失败'
}
