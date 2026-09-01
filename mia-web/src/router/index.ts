import { createRouter, createWebHistory } from 'vue-router'
import { setUnauthorizedHandler } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

/**
 * 路由表：录入 / 语录 / 时间线
 * 具体页面在后续任务填充
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { title: '登录', public: true, layout: 'blank' },
    },
    {
      path: '/',
      redirect: '/record',
    },
    {
      path: '/record',
      name: 'record',
      component: () => import('@/views/Record.vue'),
      meta: { title: '快速记录' },
    },
    {
      path: '/quotes',
      name: 'quotes',
      component: () => import('@/views/Quotes.vue'),
      meta: { title: '渺言妙语' },
    },
    {
      path: '/quotes/new',
      name: 'quote-record',
      component: () => import('@/views/QuoteRecord.vue'),
      meta: { title: '记语录' },
    },
    {
      path: '/timeline',
      name: 'timeline',
      component: () => import('@/views/Timeline.vue'),
      meta: { title: '时间线' },
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: () => import('@/views/Analysis.vue'),
      meta: { title: '分析' },
    },
    {
      path: '/album',
      name: 'album',
      component: () => import('@/views/Album.vue'),
      meta: { title: '相册' },
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('@/views/Skills.vue'),
      meta: { title: '技能地图' },
    },
    {
      path: '/consult',
      name: 'consult',
      component: () => import('@/views/Consult.vue'),
      meta: { title: 'AI 咨询' },
    },
  ],
})

/** API 401 时跳回登录页 */
setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.logout()
  const redirect = router.currentRoute.value.fullPath
  if (router.currentRoute.value.name === 'login') {
    return
  }
  void router.replace({
    name: 'login',
    query: redirect && redirect !== '/' ? { redirect } : undefined,
  })
})

/** 未登录时拦截；已登录访问 /login 则进首页 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.hydrate()
  }

  if (to.meta.public) {
    if (to.name === 'login' && auth.isLoggedIn) {
      return { name: 'record' }
    }
    return true
  }

  if (!auth.isLoggedIn) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

/** 根据路由 meta 更新页面标题 */
router.afterEach((to) => {
  const pageTitle = (to.meta.title as string | undefined) ?? 'Mia 的成长中心'
  document.title = `${pageTitle} · Mia 的成长中心`
})

export default router
