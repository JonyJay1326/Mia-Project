<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { miaConfirmState } from '@/composables/useMiaConfirm'

const props = withDefaults(
  defineProps<{
    /** 是否显示 */
    open: boolean
    /** 标题 */
    title: string
    /** 顶部 emoji */
    emoji?: string
    /** 确认按钮文案 */
    confirmText?: string
    /** 取消按钮文案 */
    cancelText?: string
    /** 提交中 */
    loading?: boolean
    /** 禁用确认 */
    confirmDisabled?: boolean
  }>(),
  {
    emoji: '✨',
    confirmText: '确定',
    cancelText: '取消',
    loading: false,
    confirmDisabled: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

/** 关闭弹框 */
function close() {
  emit('update:open', false)
  emit('cancel')
}

/** 确认 */
function onConfirm() {
  if (props.loading || props.confirmDisabled) {
    return
  }
  emit('confirm')
}

/**
 * Esc 关闭
 */
function onKeydown(e: KeyboardEvent) {
  if (!props.open || props.loading) {
    return
  }
  if (miaConfirmState.open) {
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="mia-form-mask"
      role="presentation"
      @click.self="close"
    >
      <div
        class="mia-form-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'mia-form-title'"
      >
        <div class="mia-form-dialog__emoji" aria-hidden="true">{{ emoji }}</div>
        <h2 id="mia-form-title" class="mia-form-dialog__title">{{ title }}</h2>
        <div class="mia-form-dialog__body">
          <slot />
        </div>
        <div class="mia-form-dialog__actions">
          <button
            type="button"
            class="mia-btn"
            :disabled="loading"
            @click="close"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="mia-btn mia-btn--primary"
            :disabled="loading || confirmDisabled"
            @click="onConfirm"
          >
            {{ loading ? '处理中…' : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mia-form-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(74, 63, 56, 0.38);
  animation: mia-form-fade 0.18s var(--ease-soft);
}

.mia-form-dialog {
  width: min(400px, 100%);
  padding: 22px 20px 18px;
  text-align: center;
  border: var(--stroke);
  border-radius: var(--r-lg);
  background: var(--c-cream-2);
  box-shadow: var(--shadow-pop);
}

.mia-form-dialog__emoji {
  font-size: 36px;
  line-height: 1;
  margin-bottom: 10px;
}

.mia-form-dialog__title {
  margin: 0 0 14px;
  font-size: var(--fs-xl);
  color: var(--c-ink);
}

.mia-form-dialog__body {
  text-align: left;
  margin-bottom: 18px;
}

.mia-form-dialog__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.mia-form-dialog__actions :deep(.mia-btn) {
  min-width: 96px;
}

@keyframes mia-form-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
