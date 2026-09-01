import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import './styles/tokens.css'
import './styles/element-override.css'
import './styles/base.css'

/**
 * 等路由守卫完成鉴权后再挂载，避免刷新时先闪主界面
 */
async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
