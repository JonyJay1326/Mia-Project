<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatFetchError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

/** 初始化登录态 */
onMounted(async () => {
  if (!authStore.ready) {
    await authStore.hydrate()
  }
  if (authStore.isLoggedIn) {
    await redirectAfterLogin()
  }
})

/** 登录成功后跳转 */
async function redirectAfterLogin() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/record'
  await router.replace(redirect)
}

/** 提交登录 */
async function onSubmit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  submitting.value = true
  try {
    await authStore.login(username.value, password.value)
    password.value = ''
    await redirectAfterLogin()
  } catch (e) {
    error.value = formatFetchError(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card mia-card">
      <div class="login-card__hero">
        <span class="login-card__emoji" aria-hidden="true">🍬</span>
        <h1 class="login-card__title">Mia 的成长中心</h1>
        <p class="login-card__desc">登录后继续记录与浏览</p>
      </div>

      <form class="login-form" @submit.prevent="onSubmit">
        <label class="login-field">
          <span class="login-field__label">账号</span>
          <input
            v-model="username"
            class="mia-input"
            type="text"
            name="username"
            autocomplete="username"
            placeholder="家长账号"
            :disabled="submitting"
          />
        </label>

        <label class="login-field">
          <span class="login-field__label">密码</span>
          <input
            v-model="password"
            class="mia-input"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            :disabled="submitting"
          />
        </label>

        <p v-if="error" class="login-form__error">{{ error }}</p>

        <button
          type="submit"
          class="mia-btn mia-btn--primary login-form__submit"
          :disabled="submitting"
        >
          {{ submitting ? '登录中…' : '进入' }}
        </button>
      </form>

      <p class="login-foot">仅供家庭使用 · 请妥善保管密码</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background:
    radial-gradient(circle at 20% 18%, rgba(255, 214, 170, 0.45), transparent 42%),
    radial-gradient(circle at 82% 76%, rgba(168, 218, 220, 0.35), transparent 40%),
    var(--c-cream);
}

.login-card {
  width: min(400px, 100%);
  padding: 28px 24px 22px;
  animation: loginIn 0.42s var(--ease-bounce) both;
}

.login-card__hero {
  text-align: center;
  margin-bottom: 22px;
}

.login-card__emoji {
  display: block;
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
}

.login-card__title {
  margin: 0 0 6px;
  font-size: var(--fs-title);
}

.login-card__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-field__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.login-form__error {
  margin: 0;
  padding: 8px 12px;
  border: 2px solid var(--c-coral);
  border-radius: var(--r-md);
  background: var(--c-coral-soft);
  color: var(--c-ink);
  font-size: var(--fs-sm);
  font-weight: 600;
}

.login-form__submit {
  width: 100%;
  margin-top: 4px;
}

.login-foot {
  margin: 18px 0 0;
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

@keyframes loginIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
