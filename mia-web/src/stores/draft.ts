import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '@/api/client'
import { canUseIdb, idbDelete, idbGetAll, idbPut } from '@/utils/idb'

/** 离线草稿条目 */
export interface DraftItem {
  id: string
  kind: 'event' | 'quote'
  payload: unknown
  createdAt: string
}

/**
 * 离线草稿队列：失败存本地，启动 / 联网时重放
 */
export const useDraftStore = defineStore('draft', () => {
  const pending = ref<DraftItem[]>([])
  const syncing = ref(false)
  const lastError = ref<string | null>(null)

  /** 待同步条数 */
  function pendingCount() {
    return pending.value.length
  }

  /** 从 IndexedDB 灌入内存列表 */
  async function hydrate() {
    if (!canUseIdb()) {
      lastError.value = '当前浏览器无法使用本地草稿（可能是隐私模式）'
      return
    }
    pending.value = await idbGetAll<DraftItem>()
  }

  /** 追加一条草稿并持久化 */
  async function enqueue(item: DraftItem) {
    if (!canUseIdb()) {
      throw new Error('IndexedDB 不可用，无法存本地草稿')
    }
    await idbPut(item)
    pending.value = [...pending.value.filter((d) => d.id !== item.id), item]
  }

  /**
   * 按顺序重放草稿；遇失败即停，下次再试
   */
  async function flush() {
    if (syncing.value || !navigator.onLine) {
      return
    }
    syncing.value = true
    lastError.value = null
    try {
      await hydrate()
      for (const draft of [...pending.value]) {
        try {
          const path = draft.kind === 'event' ? '/events' : '/quotes'
          await request(path, {
            method: 'POST',
            body: JSON.stringify(draft.payload),
          })
          await idbDelete(draft.id)
          pending.value = pending.value.filter((d) => d.id !== draft.id)
        } catch (err) {
          lastError.value = err instanceof Error ? err.message : '同步失败'
          break
        }
      }
    } finally {
      syncing.value = false
    }
  }

  return {
    pending,
    syncing,
    lastError,
    pendingCount,
    hydrate,
    enqueue,
    flush,
  }
})
