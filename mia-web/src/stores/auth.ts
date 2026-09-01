import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchAuthMe,
  fetchAuthStatus,
  postLogin,
  type AuthSession,
} from '@/api/auth'
import { AUTH_TOKEN_KEY, formatFetchError } from '@/api/client'

/**
 * 登录态：令牌持久化在 localStorage
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const username = ref('')
  const authEnabled = ref(true)
  const usernameHint = ref<string | null>(null)
  const ready = ref(false)
  const loading = ref(false)

  /** 是否视为已登录 */
  const isLoggedIn = computed(() => {
    if (!authEnabled.value) {
      return true
    }
    return Boolean(token.value)
  })

  /**
   * 启动时恢复令牌并校验
   */
  async function hydrate() {
    loading.value = true
    try {
      const status = await fetchAuthStatus()
      authEnabled.value = status.enabled
      usernameHint.value = status.usernameHint

      if (!status.enabled) {
        token.value = null
        username.value = status.usernameHint ?? 'mia'
        return
      }

      const saved = localStorage.getItem(AUTH_TOKEN_KEY)
      if (!saved) {
        token.value = null
        username.value = ''
        return
      }

      token.value = saved
      const me = await fetchAuthMe()
      username.value = me.username
    } catch {
      token.value = null
      username.value = ''
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY)
      } catch {
        /* ignore */
      }
    } finally {
      ready.value = true
      loading.value = false
    }
  }

  /**
   * 提交登录表单
   */
  async function login(inputUsername: string, password: string): Promise<AuthSession> {
    loading.value = true
    try {
      const session = await postLogin({
        username: inputUsername.trim(),
        password,
      })
      token.value = session.token
      username.value = session.username
      localStorage.setItem(AUTH_TOKEN_KEY, session.token)
      authEnabled.value = true
      return session
    } finally {
      loading.value = false
    }
  }

  /** 退出登录 */
  function logout() {
    token.value = null
    username.value = ''
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    } catch {
      /* ignore */
    }
  }

  return {
    token,
    username,
    authEnabled,
    usernameHint,
    ready,
    loading,
    isLoggedIn,
    hydrate,
    login,
    logout,
  }
})

/** 供非组件代码读取登录错误文案 */
export { formatFetchError }
