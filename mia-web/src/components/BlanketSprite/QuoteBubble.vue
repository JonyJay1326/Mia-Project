<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import type { QuoteRecord } from '@/types/event'
import { formatMonthAge } from '@/utils/date'

const props = defineProps<{
  /** 是否显示气泡 */
  open: boolean
  /** 当前语录 */
  quote: QuoteRecord | null
}>()

const emit = defineEmits<{
  close: []
}>()

let closeTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_CLOSE_MS = 5600

/** 启动自动关闭计时 */
function armClose() {
  if (closeTimer) {
    clearTimeout(closeTimer)
  }
  closeTimer = setTimeout(() => emit('close'), AUTO_CLOSE_MS)
}

watch(
  () => [props.open, props.quote?.id] as const,
  ([open]) => {
    if (open) {
      armClose()
    } else if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  },
)

/** 悬停气泡时不自动消失 */
function onEnter() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

/** 离开气泡后重新计时 */
function onLeave() {
  if (props.open) {
    armClose()
  }
}

/** 手动关闭 */
function onCloseClick(e: MouseEvent) {
  e.stopPropagation()
  emit('close')
}

onUnmounted(() => {
  if (closeTimer) {
    clearTimeout(closeTimer)
  }
})
</script>

<template>
  <Transition name="bubble">
    <div
      v-if="open && quote"
      class="bubble"
      role="dialog"
      aria-label="渺言妙语"
      @mouseenter="onEnter"
      @mouseleave="onLeave"
      @click.stop
    >
      <button
        type="button"
        class="bubble__close"
        aria-label="关闭"
        @click="onCloseClick"
      >
        ×
      </button>
      <p class="bubble__label">渺言妙语</p>
      <p class="bubble__text">「{{ quote.content }}」</p>
      <p v-if="quote.note" class="bubble__note">{{ quote.note }}</p>
      <div class="bubble__foot">
        <span class="bubble__meta">{{ formatMonthAge(quote.monthAge) }}</span>
        <span v-if="quote.context" class="bubble__ctx">{{ quote.context }}</span>
      </div>
      <span class="bubble__tail" aria-hidden="true" />
    </div>
  </Transition>
</template>

<style scoped>
.bubble {
  position: absolute;
  right: 8px;
  bottom: calc(100% + 14px);
  width: min(260px, 72vw);
  padding: 14px 16px 12px;
  border: var(--stroke);
  border-radius: 18px 18px 6px 18px;
  background: linear-gradient(165deg, #fffefb 0%, var(--c-grape-soft) 100%);
  box-shadow: var(--shadow-pop);
  z-index: 2;
  text-align: left;
}

.bubble__close {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--c-ink-3);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.bubble__close:hover {
  color: var(--c-ink);
  background: rgb(255 255 255 / 55%);
}

.bubble__label {
  margin: 0 20px 6px 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--c-grape);
}

.bubble__text {
  margin: 0 0 8px;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.45;
}

.bubble__note {
  margin: 0 0 10px;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  background: rgb(255 253 248 / 70%);
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
  line-height: 1.4;
}

.bubble__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  justify-content: space-between;
}

.bubble__meta {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-ink-2);
}

.bubble__ctx {
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 小三角：描边 + 填充对齐糖果风 */
.bubble__tail {
  position: absolute;
  right: 36px;
  bottom: -9px;
  width: 14px;
  height: 14px;
  background: var(--c-grape-soft);
  border-right: var(--stroke);
  border-bottom: var(--stroke);
  transform: rotate(45deg);
  box-shadow: 2px 2px 0 #e0cdb8;
}

.bubble-enter-active,
.bubble-leave-active {
  transition:
    opacity 0.24s var(--ease-soft),
    transform 0.28s var(--ease-bounce);
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.94);
}
</style>
