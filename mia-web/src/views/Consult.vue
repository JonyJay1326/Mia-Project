<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import MiaMarkdown from '@/components/MiaMarkdown.vue'
import {
  fetchAiStatus,
  postAiChat,
  type AiChatMessage,
  type AiStatus,
} from '@/api/ai'

const status = ref<AiStatus | null>(null)
const messages = ref<AiChatMessage[]>([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
/** 输入框是否展开（聚焦时单行→多行） */
const inputFocused = ref(false)

/** 提问模板（与档案一致） */
const templates = [
  {
    label: '当下崩溃怎么应对',
    text: `【发生了什么】（客观描述，不带判断）
【当时状态】前 1–2 小时：睡了多久、什么时候吃的、有无异常
【我做了什么】按先后顺序说
【结果】多久平复，还是升级了
【我想要】当下止住的招`,
  },
  {
    label: '长期怎么改善',
    text: `【发生了什么】最近反复出现的情况（客观描述）
【我想要】长期可执行的小改动，请优先对照档案「已验证清单」`,
  },
]

/** 拉取配置状态 */
async function loadStatus() {
  try {
    status.value = await fetchAiStatus()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法连接 AI 状态接口'
  }
}

/** 填入模板并展开输入框 */
function useTemplate(text: string) {
  input.value = text
  void nextTick(() => inputEl.value?.focus())
}

/** 聚焦输入框 */
function onInputFocus() {
  inputFocused.value = true
}

/** 失焦后收成单行 */
function onInputBlur() {
  inputFocused.value = false
}

/** 滚到底部 */
async function scrollBottom() {
  await nextTick()
  const el = listRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

/** 发送问题 */
async function send() {
  const content = input.value.trim()
  if (!content || sending.value) {
    return
  }
  if (!status.value?.enabled) {
    error.value = '后端未配置 MIA_AI_API_KEY（DeepSeek）'
    return
  }

  error.value = ''
  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  await scrollBottom()

  try {
    const res = await postAiChat({
      messages: messages.value,
      includeStats: true,
      days: 60,
    })
    messages.value.push({ role: 'assistant', content: res.reply })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
    messages.value.pop()
    input.value = content
  } finally {
    sending.value = false
    await scrollBottom()
  }
}

/** Ctrl+Enter 发送 */
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void send()
  }
}

/** 清空对话 */
function clearChat() {
  messages.value = []
  error.value = ''
}

onMounted(() => {
  void loadStatus()
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <div>
        <h1 class="page__title">🤖 AI 咨询</h1>
        <p class="page__desc">
          走 DeepSeek 接口；每次回答都会带上
          <strong>Mia 档案</strong>
          与近期记录事实。
        </p>
      </div>
      <button
        v-if="messages.length"
        type="button"
        class="mia-btn"
        @click="clearChat"
      >
        清空对话
      </button>
    </header>

    <section
      v-if="status"
      class="mia-card status"
      :class="status.enabled ? 'status--ok' : 'status--warn'"
    >
      <p v-if="status.enabled" class="status__text">
        已连接
        <strong>{{ status.model }}</strong>
        · 档案
        {{ status.archiveLoaded ? '已加载' : '未找到，请检查 MIA_ARCHIVE_PATH' }}
      </p>
      <p v-else class="status__text">
        未配置密钥。在
        <code>server/.env</code>
        填入 DeepSeek 的
        <code>MIA_AI_API_KEY</code>
        后重启后端。
      </p>
    </section>

    <div class="templates">
      <button
        v-for="t in templates"
        :key="t.label"
        type="button"
        class="mia-chip"
        @click="useTemplate(t.text)"
      >
        {{ t.label }}
      </button>
    </div>

    <div ref="listRef" class="chat">
      <div v-if="!messages.length" class="chat__empty">
        用下面模板或直接提问。AI 会按档案第三节「已验证清单」优先给建议。
      </div>
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
      <div v-if="sending" class="bubble bubble--bot">
        <div class="bubble__role">Mia 助手</div>
        <p class="bubble__text">思考中…</p>
      </div>
    </div>

    <p v-if="error" class="page__err">{{ error }}</p>

    <div class="composer">
      <textarea
        ref="inputEl"
        v-model="input"
        class="mia-input composer__input"
        :class="{ 'composer__input--expanded': inputFocused }"
        rows="1"
        placeholder="描述发生了什么（客观事实）…"
        :disabled="sending"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="mia-btn mia-btn--primary"
        :disabled="sending || !input.trim()"
        @click="send"
      >
        {{ sending ? '发送中…' : '发送（Ctrl+Enter）' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: calc(100dvh - 72px - env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.page__hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.page__title {
  margin: 0 0 6px;
  font-size: var(--fs-title);
}

.page__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.status {
  padding: 12px 14px;
}

.status--ok {
  background: var(--c-mint-soft);
  border-color: var(--c-mint);
}

.status--warn {
  background: var(--c-honey-soft);
  border-color: var(--c-honey);
}

.status__text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.5;
}

.status__text code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--c-cream);
  border: 1px solid var(--c-cream-3);
}

.templates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat {
  flex: 1 1 auto;
  min-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 12px;
}

.chat__empty {
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
  padding: 24px 8px;
  text-align: center;
  margin: auto 0;
}

.bubble {
  max-width: min(100%, 640px);
  padding: 12px 14px;
  border: var(--stroke);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sticker);
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

.bubble__role {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--c-ink-2);
  margin-bottom: 6px;
}

.bubble__text {
  margin: 0;
  word-break: break-word;
  font-family: inherit;
  font-size: var(--fs-base);
  line-height: 1.55;
  color: var(--c-ink);
}

.bubble__text:not(pre) {
  white-space: normal;
}

pre.bubble__text {
  white-space: pre-wrap;
}

.page__err {
  margin: 0;
  color: var(--c-coral);
  font-weight: 700;
  font-size: var(--fs-sm);
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
  margin-top: auto;
  position: sticky;
  bottom: 0;
  padding-top: 10px;
  padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(transparent, var(--c-cream) 20%);
}

.composer__input {
  resize: none;
  box-sizing: border-box;
  height: 46px;
  min-height: 46px;
  max-height: 46px;
  overflow-y: hidden;
  line-height: 22px;
  padding-block: 11px;
  transition:
    height var(--dur) var(--ease-soft),
    min-height var(--dur) var(--ease-soft),
    max-height var(--dur) var(--ease-soft),
    padding-block var(--dur) var(--ease-soft),
    line-height var(--dur) var(--ease-soft);
}

.composer__input--expanded {
  height: auto;
  min-height: 110px;
  max-height: min(40vh, 320px);
  line-height: 1.5;
  padding-block: 10px;
  overflow-y: auto;
  resize: vertical;
}

@media (min-width: 768px) {
  .page {
    min-height: calc(100dvh - 32px);
    padding-bottom: 16px;
  }

  .composer {
    padding-bottom: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .composer__input {
    transition: none;
  }
}
</style>
