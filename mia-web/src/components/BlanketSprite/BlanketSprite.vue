<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SpriteImage from './SpriteImage.vue'
import QuoteBubble from './QuoteBubble.vue'
import { useSpriteState } from '@/composables/useSpriteState'
import { request } from '@/api/client'
import type { QuoteRecord } from '@/types/event'

const {
  state,
  playing,
  targetState,
  paintEpoch,
  canClick,
  playClickTransition,
  onPlayEnd,
} = useSpriteState()

const expanded = ref(true)
const hovered = ref(false)
const bubbleOpen = ref(false)
const currentQuote = ref<QuoteRecord | null>(null)
const pool = ref<QuoteRecord[]>([])
const lastId = ref<string | null>(null)
const hasQuotes = ref(true)
const pendingBubble = ref(false)
async function prefetch() {
  try {
    const list: QuoteRecord[] = []
    for (let i = 0; i < 5; i++) {
      const one = await request<QuoteRecord | null>('/quotes?random=1')
      if (!one) {
        break
      }
      if (!list.some((q) => q.id === one.id)) {
        list.push(one)
      }
    }
    pool.value = list
    hasQuotes.value = list.length > 0
  } catch {
    hasQuotes.value = false
  }
}

/** 从池中取下一条，尽量不重复 */
function nextQuote(): QuoteRecord | null {
  if (!pool.value.length) {
    return null
  }
  const candidates = pool.value.filter((q) => q.id !== lastId.value)
  const pick = (candidates.length ? candidates : pool.value)[
    Math.floor(Math.random() * (candidates.length || pool.value.length))
  ]
  lastId.value = pick.id
  return pick
}

/** 打开气泡 */
function openBubble() {
  currentQuote.value = nextQuote()
  bubbleOpen.value = Boolean(currentQuote.value)
}

/**
 * 点击：播到下一态后弹语录
 */
async function onClick() {
  if (!expanded.value) {
    expanded.value = true
    return
  }

  if (hasQuotes.value && pool.value.length < 2) {
    await prefetch()
  }

  if (!canClick()) {
    if (hasQuotes.value) {
      openBubble()
    }
    return
  }

  pendingBubble.value = hasQuotes.value
  const started = playClickTransition()
  if (!started) {
    pendingBubble.value = false
    if (hasQuotes.value) {
      openBubble()
    }
  }
}

/** 视频切态结束 */
function handlePlayEnd() {
  onPlayEnd()
  if (pendingBubble.value) {
    openBubble()
    pendingBubble.value = false
  }
}

/** 关闭气泡 */
function closeBubble() {
  bubbleOpen.value = false
}

onMounted(() => {
  void prefetch()
})
</script>

<template>
  <div class="sprite">
    <button
      v-if="!expanded"
      type="button"
      class="sprite__fab"
      aria-label="打开毯子精灵"
      @click="expanded = true"
    >
      🩵
    </button>

    <div
      v-else
      class="sprite__body"
      @click="onClick"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <QuoteBubble
        :open="bubbleOpen && hasQuotes"
        :quote="currentQuote"
        @close="closeBubble"
      />
      <SpriteImage
        :state="state"
        :playing="playing"
        :target-state="targetState"
        :paint-epoch="paintEpoch"
        :hovered="hovered"
        @play-end="handlePlayEnd"
      />
      <button
        type="button"
        class="sprite__minimize"
        aria-label="收起"
        @click.stop="expanded = false"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.sprite {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 60;
}

.sprite__fab {
  width: 48px;
  height: 48px;
  border: var(--stroke);
  border-radius: var(--r-pill);
  background: var(--c-sky-soft);
  box-shadow: var(--shadow-sticker);
  cursor: pointer;
  font-size: 22px;
}

.sprite__body {
  position: relative;
  cursor: pointer;
}

.sprite__minimize {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 22px;
  height: 22px;
  border: var(--stroke-light);
  border-radius: var(--r-pill);
  background: var(--c-cream-2);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: none;
}

@media (max-width: 767px) {
  .sprite__minimize {
    display: grid;
    place-items: center;
  }
}
</style>
