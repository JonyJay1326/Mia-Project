import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QuoteRecord } from '@/types/event'

/** 按月龄分组后的语录块 */
export interface QuoteMonthGroup {
  monthAge: number
  items: QuoteRecord[]
}

/** 语录列表与随机缓存（精灵气泡用） */
export const useQuotesStore = defineStore('quotes', () => {
  const groups = ref<QuoteMonthGroup[]>([])
  const randomPool = ref<QuoteRecord[]>([])
  const loading = ref(false)

  /** 清空语录状态 */
  function reset() {
    groups.value = []
    randomPool.value = []
  }

  return { groups, randomPool, loading, reset }
})
