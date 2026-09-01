import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

/** 帮助面板是否打开（供 App 绑定） */
export const hotkeyHelpOpen = ref(false)

/**
 * 电脑端快捷键：N 快速记录、B 补录、Q 语录、T 时间线、A 分析、? 帮助
 * 输入框聚焦时不触发单键快捷键；带 Ctrl/Meta/Alt 时不抢系统快捷键
 */
export function useHotkeys() {
  const router = useRouter()

  /** 当前焦点是否在可输入元素上 */
  function isTypingTarget(el: EventTarget | null) {
    if (!(el instanceof HTMLElement)) {
      return false
    }
    const tag = el.tagName
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      el.isContentEditable
    )
  }

  /** 全局按键处理 */
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && hotkeyHelpOpen.value) {
      hotkeyHelpOpen.value = false
      return
    }

    if (e.key === '?' && !isTypingTarget(e.target)) {
      e.preventDefault()
      hotkeyHelpOpen.value = true
      return
    }

    // 不拦截复制粘贴等系统组合键（如 Ctrl+C）
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return
    }

    if (isTypingTarget(e.target)) {
      return
    }

    const key = e.key.toLowerCase()
    if (key === 'q') {
      e.preventDefault()
      void router.push({ name: 'quote-record' })
      return
    }
    if (key === 'n') {
      e.preventDefault()
      void router.push({ name: 'record' })
      return
    }
    if (key === 'b') {
      e.preventDefault()
      void router.push({ name: 'record', query: { backfill: '1' } })
      return
    }
    if (key === 't') {
      e.preventDefault()
      void router.push({ name: 'timeline' })
      return
    }
    if (key === 'a') {
      e.preventDefault()
      void router.push({ name: 'analysis' })
      return
    }
    if (key === 'p') {
      e.preventDefault()
      void router.push({ name: 'album' })
      return
    }
    if (key === 's') {
      e.preventDefault()
      void router.push({ name: 'skills' })
      return
    }
    if (key === 'i') {
      e.preventDefault()
      void router.push({ name: 'consult' })
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
