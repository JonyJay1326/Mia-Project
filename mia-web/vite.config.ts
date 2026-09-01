import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { VitePWA } from 'vite-plugin-pwa'

/** Vite 构建配置：Vue + Element Plus 按需引入 + PWA（默认关闭 SW） */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        // 阶段一无域名无 HTTPS，默认不注册 Service Worker
        disable: env.VITE_ENABLE_SW !== 'true',
        manifest: {
          name: 'Mia 的成长中心',
          short_name: 'Mia',
          description: '记录 Mia 的每一天',
          theme_color: '#e8736b',
          background_color: '#fffbf0',
          display: 'standalone',
          orientation: 'any',
          start_url: '/record',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'api', networkTimeoutSeconds: 3 },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
