<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import {
  miaConfirmState,
  settleMiaConfirm,
} from '@/composables/useMiaConfirm'

/**
 * Esc 取消
 */
function onKeydown(e: KeyboardEvent) {
  if (!miaConfirmState.open) {
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    settleMiaConfirm(false)
  }
}

watch(
  () => miaConfirmState.open,
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
      v-if="miaConfirmState.open"
      class="mia-confirm-mask"
      role="presentation"
      @click.self="settleMiaConfirm(false)"
    >
      <div
        class="mia-confirm"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="'mia-confirm-title'"
        :aria-describedby="'mia-confirm-msg'"
      >
        <div class="mia-confirm__emoji" aria-hidden="true">🗑️</div>
        <h2 id="mia-confirm-title" class="mia-confirm__title">
          {{ miaConfirmState.title }}
        </h2>
        <p id="mia-confirm-msg" class="mia-confirm__msg">
          {{ miaConfirmState.message }}
        </p>
        <div class="mia-confirm__actions">
          <button
            type="button"
            class="mia-btn"
            @click="settleMiaConfirm(false)"
          >
            {{ miaConfirmState.cancelText }}
          </button>
          <button
            type="button"
            class="mia-btn"
            :class="
              miaConfirmState.danger
                ? 'mia-confirm__ok--danger'
                : 'mia-btn--primary'
            "
            @click="settleMiaConfirm(true)"
          >
            {{ miaConfirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mia-confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(74, 63, 56, 0.38);
  animation: mia-confirm-fade 0.18s var(--ease-soft);
}

.mia-confirm {
  width: min(360px, 100%);
  padding: 22px 20px 18px;
  text-align: center;
  border: var(--stroke);
  border-radius: var(--r-lg);
  background: var(--c-cream-2);
  box-shadow: var(--shadow-pop);
}

.mia-confirm__emoji {
  font-size: 36px;
  line-height: 1;
  margin-bottom: 10px;
}

.mia-confirm__title {
  margin: 0 0 10px;
  font-size: var(--fs-xl);
  color: var(--c-ink);
}

.mia-confirm__msg {
  margin: 0 0 20px;
  font-size: var(--fs-base);
  color: var(--c-ink-2);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.mia-confirm__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.mia-confirm__actions :deep(.mia-btn) {
  min-width: 96px;
}

.mia-confirm__ok--danger {
  background: var(--c-coral);
  color: #fff;
  border-color: var(--stroke-color);
}

@keyframes mia-confirm-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
