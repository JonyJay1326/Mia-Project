import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { EventRecord } from '@/types/event'

/** 事件列表与提交状态 */
export const useEventsStore = defineStore('events', () => {
  const items = ref<EventRecord[]>([])
  const loading = ref(false)
  const selectedId = ref<string | null>(null)

  /** 设置选中的时间线条目 */
  function selectEvent(id: string | null) {
    selectedId.value = id
  }

  /** 重置列表（后续接 API） */
  function reset() {
    items.value = []
    selectedId.value = null
  }

  return { items, loading, selectedId, selectEvent, reset }
})
