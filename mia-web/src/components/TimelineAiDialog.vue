<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import MiaMarkdown from '@/components/MiaMarkdown.vue'
import { formatFetchError } from '@/api/client'
import {
  fetchAiStatus,
  postAiChat,
  type AiChatMessage,
  type AiStatus,
} from '@/api/ai'
import { buildTimelineAiQuestion } from '@/utils/timelineAiQuestion'
import type { TimelineItem } from '@/utils/timeline'
import { miaConfirmState } from '@/composables/useMiaConfirm'

const props = defineProps<{
  /** 是否显示 */
  open: boolean
  /** 当前要分析的时间线条目 */
  item: TimelineItem | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const status = ref<AiStatus | null>(null)
const messages = ref<AiChatMessage[]>([])
const chatId = ref<string | null>(null)
const input = ref('')
const sending = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
/** 作废进行中的旧请求（切换条目 / 关闭） */
let requestSeq = 0

/** 关闭弹框（打断进行中的请求） */
function close() {
  requestSeq += 1
  sending.value = false
  emit('update:open', false)
}

/** 滚到底部 */
async function scrollBottom() {
  await nextTick()
  const el = listRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

/** 拉取 AI 是否可用 */
async function loadStatus() {
  try {
    status.value = await fetchAiStatus()
  } catch (e) {
    error.value = formatFetchError(e)
  }
}

/**
 * 对某条记录发起首问（自动）或追问
 */
async function ask(content: string) {
  const trimmed = content.trim()
  if (!trimmed || sending.value) {
    return
  }
  if (!status.value?.enabled) {
    error.value = '后端未配置 MIA_AI_API_KEY（DeepSeek）'
    return
  }

  error.value = ''
  messages.value.push({ role: 'user', content: trimmed })
  sending.value = true
  const seq = ++requestSeq
  await scrollBottom()

  try {
    const res = await postAiChat({
      messages: messages.value,
      includeStats: true,
      days: 60,
      chatId: chatId.value ?? undefined,
    })
    if (seq !== requestSeq) {
      return
    }
    messages.value.push({ role: 'assistant', content: res.reply })
    if (res.chatId) {
      chatId.value = res.chatId
    }
  } catch (e) {
    if (seq !== requestSeq) {
      return
    }
    error.value = formatFetchError(e)
    messages.value.pop()
  } finally {
    if (seq === requestSeq) {
      sending.value = false
      await scrollBottom()
    }
  }
}

/** 发送追问 */
async function sendFollowUp() {
  const content = input.value.trim()
  if (!content) {
    return
  }
  input.value = ''
  await ask(content)
}

/** Ctrl+Enter 发送追问 */
function onKeydownInput(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void sendFollowUp()
  }
}

/** Esc 关闭 */
function onKeydown(e: KeyboardEvent) {
  if (!props.open) {
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
  () => [props.open, props.item?.id] as const,
  async ([open, id]) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (!open || !id || !props.item) {
      return
    }
    requestSeq += 1
    messages.value = []
    chatId.value = null
    input.value = ''
    error.value = ''
    sending.value = false
    if (!status.value) {
      await loadStatus()
    }
    await ask(buildTimelineAiQuestion(props.item))
  },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void loadStatus()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && item"
      class="timeline-ai-mask"
      role="presentation"
      @click.self="close"
    >
      <div
        class="timeline-ai mia-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-ai-title"
        @click.stop
      >
        <div class="timeline-ai__head">
          <div>
            <h2 id="timeline-ai-title" class="timeline-ai__title">AI 分析</h2>
            <p class="timeline-ai__sub">
              结合档案与近期事实解读这条记录（可追问）
            </p>
          </div>
          <button
            type="button"
            class="mia-btn"
            @click="close"
          >
            关闭
          </button>
        </div>

        <div ref="listRef" class="timeline-ai__chat">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="bubble"
            :class="m.role === 'user' ? 'bubble--user' : 'bubble--bot'"
          >
            <div class="bubble__role">
              {{ m.role === 'user' ? '我' : 'Mia 助手' }}
            </div>
            <pre v-if="m.role === 'user'" class="bubble__text">{{ m.content }}</pre>
            <MiaMarkdown v-else class="bubble__text" :source="m.content" />
          </div>
          <div
            v-if="sending"
            class="bubble bubble--bot bubble--thinking"
            aria-live="polite"
          >
            <div class="bubble__role">Mia 助手</div>
            <div class="thinking">
              <span class="thinking__label">思考中</span>
              <span class="thinking__dots" aria-hidden="true">
                <i class="thinking__dot" />
                <i class="thinking__dot" />
                <i class="thinking__dot" />
              </span>
            </div>
          </div>
        </div>

        <p v-if="error" class="timeline-ai__err">{{ error }}</p>

        <div class="timeline-ai__composer">
          <textarea
            v-model="input"
            class="mia-input timeline-ai__input"
            rows="2"
            placeholder="继续追问…"
            :disabled="sending"
            @keydown="onKeydownInput"
          />
          <button
            type="button"
            class="mia-btn mia-btn--primary"
            :disabled="sending || !input.trim()"
            @click="sendFollowUp"
          >
            {{ sending ? '发送中…' : '发送' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.timeline-ai-mask {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(74, 63, 56, 0.38);
  animation: timeline-ai-fade 0.18s var(--ease-soft);
}

.timeline-ai {
  width: min(560px, 100%);
  max-height: min(86dvh, 720px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 14px;
  background: var(--c-cream-2);
  box-shadow: var(--shadow-pop);
}

.timeline-ai__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.timeline-ai__title {
  margin: 0 0 4px;
  font-size: var(--fs-xl);
  color: var(--c-ink);
}

.timeline-ai__sub {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.timeline-ai__chat {
  flex: 1;
  min-height: 180px;
  max-height: 48dvh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 2px;
}

.bubble {
  max-width: 95%;
  padding: 10px 12px;
  border: var(--stroke-light);
  border-radius: var(--r-md);
}

.bubble__role {
  margin-bottom: 4px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-ink-2);
}

.bubble__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--c-ink);
}

.bubble--user {
  align-self: flex-end;
  background: var(--c-sky-soft);
  border-color: var(--c-sky);
}

.bubble--bot {
  align-self: flex-start;
  background: var(--c-grape-soft);
  border-color: var(--c-grape);
}

.bubble--thinking {
  animation: thinking-bubble-in 0.35s var(--ease-bounce) both;
}

.thinking {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 1.55em;
}

.thinking__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
  animation: thinking-label-pulse 1.6s ease-in-out infinite;
}

.thinking__dots {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.thinking__dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-grape);
  animation: thinking-dot-bounce 1.05s var(--ease-bounce) infinite;
}

.thinking__dot:nth-child(2) {
  animation-delay: 0.14s;
}

.thinking__dot:nth-child(3) {
  animation-delay: 0.28s;
}

.timeline-ai__err {
  margin: 0;
  color: var(--c-coral);
  font-size: var(--fs-sm);
}

.timeline-ai__composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-ai__input {
  width: 100%;
  resize: vertical;
  min-height: 56px;
}

@keyframes timeline-ai-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes thinking-bubble-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes thinking-label-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@keyframes thinking-dot-bounce {
  0%,
  70%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.45;
  }
  35% {
    transform: translateY(-5px) scale(1.08);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bubble--thinking,
  .thinking__label,
  .thinking__dot {
    animation: none;
  }
}
</style>
