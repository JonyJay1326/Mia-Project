<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useDraftFlush } from '@/composables/useDraftFlush'
import { hotkeyHelpOpen, useHotkeys } from '@/composables/useHotkeys'
import { useAuthStore } from '@/stores/auth'
import MiaConfirmDialog from '@/components/MiaConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()

/** 电脑侧边栏导航（含阶段二分析） */
const desktopNav = [
  { to: '/record', label: '快速记录', icon: '⚡' },
  { to: '/quotes', label: '渺言妙语', icon: '💬' },
  { to: '/timeline', label: '时间线', icon: '📅' },
  { to: '/analysis', label: '分析', icon: '📊' },
  { to: '/album', label: '相册', icon: '📷' },
  { to: '/skills', label: '技能', icon: '🌱' },
  { to: '/consult', label: 'AI 咨询', icon: '🤖' },
] as const

/** 手机底栏：只保留录入相关三页 */
const mobileNav = [
  { to: '/record', label: '快速记录', icon: '⚡' },
  { to: '/quotes', label: '渺言妙语', icon: '💬' },
  { to: '/timeline', label: '时间线', icon: '📅' },
] as const

const route = useRoute()
const draftStore = useDraftFlush()
useHotkeys()

/** 当前路由是否匹配某导航 */
function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

/** 侧边栏品牌副标题 */
const brandSub = computed(() => '成长记录')

/** 登录页等全屏布局，不显示壳层导航 */
const isBlankLayout = computed(() => route.meta.layout === 'blank')

/** 退出登录 */
function logout() {
  authStore.logout()
  void router.replace({ name: 'login' })
}

/** 关闭快捷键帮助 */
function closeHelp() {
  hotkeyHelpOpen.value = false
}

/**
 * 电脑端主内容区单独滚动：换页时滚回顶部
 */
watch(
  () => route.fullPath,
  async () => {
    await nextTick()
    const main = document.querySelector('.shell__main')
    if (main instanceof HTMLElement) {
      main.scrollTop = 0
    }
    window.scrollTo(0, 0)
  },
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div v-if="!authStore.ready" class="app-boot" aria-hidden="true" />

    <RouterView v-else-if="isBlankLayout" />

    <div v-else-if="authStore.isLoggedIn" class="shell">
      <aside class="shell__sidebar">
        <div class="shell__brand">
          <span class="shell__brand-emoji" aria-hidden="true">🍬</span>
          <div>
            <div class="shell__brand-name">Mia</div>
            <div class="shell__brand-sub">{{ brandSub }}</div>
          </div>
        </div>
        <nav class="shell__nav" aria-label="主导航">
          <RouterLink
            v-for="item in desktopNav"
            :key="item.to"
            :to="item.to"
            class="shell__nav-item"
            :class="{ 'is-active': isActive(item.to) }"
          >
            <span class="shell__nav-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
        <p v-if="draftStore.pending.length" class="shell__draft">
          📦 待同步 {{ draftStore.pending.length }} 条
        </p>
        <button
          v-if="authStore.authEnabled"
          type="button"
          class="shell__logout mia-btn"
          @click="logout"
        >
          退出登录
        </button>
      </aside>

      <main class="shell__main">
        <RouterView />
      </main>

      <nav class="shell__tabbar" aria-label="手机导航">
        <RouterLink
          v-for="item in mobileNav"
          :key="item.to"
          :to="item.to"
          class="shell__tab"
          :class="{ 'is-active': isActive(item.to) }"
        >
          <span class="shell__tab-icon">{{ item.icon }}</span>
          <span class="shell__tab-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div
        v-if="hotkeyHelpOpen"
        class="help-mask"
        @click.self="closeHelp"
      >
        <div class="mia-card help-panel" role="dialog" aria-label="快捷键帮助">
          <h2 class="help-panel__title">⌨️ 快捷键</h2>
          <ul class="help-panel__list">
            <li><kbd>N</kbd> 快速记录</li>
            <li><kbd>B</kbd> 补录</li>
            <li><kbd>Q</kbd> 记语录</li>
            <li><kbd>T</kbd> 时间线</li>
            <li><kbd>A</kbd> 分析</li>
            <li><kbd>P</kbd> 相册</li>
            <li><kbd>S</kbd> 技能地图</li>
            <li><kbd>I</kbd> AI 咨询</li>
            <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 保存</li>
            <li><kbd>?</kbd> 打开帮助</li>
            <li><kbd>Esc</kbd> 关闭</li>
          </ul>
          <button type="button" class="mia-btn mia-btn--primary" @click="closeHelp">
            知道了
          </button>
          <button
            v-if="authStore.authEnabled"
            type="button"
            class="mia-btn help-panel__logout"
            @click="logout(); closeHelp()"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>

    <MiaConfirmDialog />
  </el-config-provider>
</template>

<style scoped>
.app-boot {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-cream);
}

.shell {
  min-height: 100vh;
  display: flex;
  background: var(--c-cream);
}

.shell__sidebar {
  display: none;
  width: 220px;
  flex-shrink: 0;
  padding: 24px 16px;
  border-right: var(--stroke);
  background: var(--c-cream-2);
}

.shell__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
  padding: 0 8px;
}

.shell__brand-emoji {
  font-size: 28px;
  line-height: 1;
}

.shell__brand-name {
  font-size: var(--fs-xl);
  font-weight: 800;
  color: var(--c-ink);
  line-height: 1.1;
}

.shell__brand-sub {
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.shell__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shell__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 2px solid transparent;
  border-radius: var(--r-lg);
  color: var(--c-ink);
  font-weight: 600;
  transition:
    background var(--dur) var(--ease-soft),
    border-color var(--dur) var(--ease-soft),
    transform var(--dur) var(--ease-bounce);
}

.shell__nav-item:hover {
  background: var(--c-cream-3);
  transform: translateX(2px);
}

.shell__nav-item.is-active {
  border-color: var(--stroke-color);
  background: var(--c-coral-soft);
  box-shadow: var(--shadow-sticker);
}

.shell__nav-icon {
  font-size: var(--fs-lg);
}

.shell__soon {
  margin: 24px 8px 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

.shell__draft {
  margin: 12px 8px 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-coral);
}

.shell__logout {
  margin: auto 8px 0;
  width: calc(100% - 16px);
  font-size: var(--fs-sm);
}

.help-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 63, 56, 0.35);
  padding: 16px;
}

.help-panel {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-panel__title {
  margin: 0;
  font-size: var(--fs-xl);
}

.help-panel__list {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--c-ink);
}

.help-panel__list kbd {
  display: inline-block;
  min-width: 1.5em;
  padding: 2px 6px;
  margin-right: 4px;
  border: var(--stroke-light);
  border-radius: 6px;
  background: var(--c-cream);
  font-size: 12px;
  font-weight: 700;
}

.help-panel__logout {
  width: 100%;
}

.shell__main {
  flex: 1;
  min-width: 0;
  padding-bottom: 72px;
  scrollbar-gutter: stable;
}

.shell__tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  border-top: var(--stroke);
  background: var(--c-cream-2);
  box-shadow: 0 -2px 0 #e0cdb8;
}

.shell__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: var(--r-md);
  color: var(--c-ink-2);
  font-weight: 600;
  font-size: 11px;
}

.shell__tab.is-active {
  color: var(--c-ink);
  background: var(--c-coral-soft);
}

.shell__tab-icon {
  font-size: 20px;
  line-height: 1;
}

/* 平板同电脑：≥768 显示侧边栏，隐藏底栏；右侧主区单独滚动 */
@media (min-width: 768px) {
  .shell {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .shell__sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .shell__main {
    height: 100%;
    overflow-y: auto;
    padding-bottom: 0;
    overscroll-behavior: contain;
  }

  .shell__tabbar {
    display: none;
  }
}
</style>
