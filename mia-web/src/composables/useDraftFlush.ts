import { onMounted, onUnmounted } from 'vue'
import { useDraftStore } from '@/stores/draft'

/**
 * 启动时与网络恢复时自动重放离线草稿
 */
export function useDraftFlush() {
  const draftStore = useDraftStore()

  /** 网络恢复回调 */
  function onOnline() {
    void draftStore.flush()
  }

  onMounted(() => {
    void draftStore.hydrate().then(() => draftStore.flush())
    window.addEventListener('online', onOnline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', onOnline)
  })

  return draftStore
}
