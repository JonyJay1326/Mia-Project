<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import MiaMarkdown from '@/components/MiaMarkdown.vue'
import { formatFetchError } from '@/api/client'
import {
  deleteAiChat,
  fetchAiChat,
  fetchAiChats,
  fetchAiStatus,
  postAiChat,
  type AiChatMessage,
  type AiChatSummary,
  type AiStatus,
} from '@/api/ai'
import { useMiaConfirm } from '@/composables/useMiaConfirm'

const { confirm } = useMiaConfirm()
const status = ref<AiStatus | null>(null)
const messages = ref<AiChatMessage[]>([])
const chatId = ref<string | null>(null)
const input = ref('')
const sending = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
/** 输入框是否展开（聚焦时单行→多行） */
const inputFocused = ref(false)

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyItems = ref<AiChatSummary[]>([])
const historyError = ref('')

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
      chatId: chatId.value ?? undefined,
    })
    messages.value.push({ role: 'assistant', content: res.reply })
    if (res.chatId) {
      chatId.value = res.chatId
    }
  } catch (e) {
    error.value = formatFetchError(e)
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

/** 新开对话（不删历史） */
function startNewChat() {
  messages.value = []
  chatId.value = null
  error.value = ''
  historyOpen.value = false
}

/** 打开历史面板并刷新列表 */
async function openHistory() {
  historyOpen.value = true
  historyError.value = ''
  historyLoading.value = true
  try {
    historyItems.value = await fetchAiChats()
  } catch (e) {
    historyError.value = formatFetchError(e)
  } finally {
    historyLoading.value = false
  }
}

/** 关闭历史面板 */
function closeHistory() {
  historyOpen.value = false
}

/** 加载某条历史到当前对话 */
async function loadHistoryItem(item: AiChatSummary) {
  try {
    const detail = await fetchAiChat(item.id)
    messages.value = detail.messages
    chatId.value = detail.id
    error.value = ''
    historyOpen.value = false
    await scrollBottom()
  } catch (e) {
    historyError.value = formatFetchError(e)
  }
}

/** 删除一条历史 */
async function removeHistoryItem(item: AiChatSummary) {
  const ok = await confirm({
    title: '删除这条咨询？',
    message: `删除后不可恢复。\n\n「${item.title}」`,
    confirmText: '删除',
    cancelText: '再想想',
    danger: true,
  })
  if (!ok) {
    return
  }
  try {
    await deleteAiChat(item.id)
    historyItems.value = historyItems.value.filter((h) => h.id !== item.id)
    if (chatId.value === item.id) {
      startNewChat()
      historyOpen.value = true
    }
  } catch (e) {
    historyError.value = formatFetchError(e)
  }
}

/** 格式化更新时间 */
function formatUpdated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
      <div class="page__actions">
        <button type="button" class="mia-btn" @click="openHistory">历史</button>
        <button
          v-if="messages.length || chatId"
          type="button"
          class="mia-btn"
          @click="startNewChat"
        >
          新对话
        </button>
      </div>
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
      <div v-if="sending" class="bubble bubble--bot bubble--thinking" aria-live="polite">
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

    <div
      v-if="historyOpen"
      class="history-mask"
      @click.self="closeHistory"
    >
      <aside class="history mia-card" @click.stop>
        <div class="history__head">
          <h2 class="history__title">咨询历史</h2>
          <button type="button" class="mia-btn" @click="closeHistory">关闭</button>
        </div>
        <p v-if="historyLoading" class="history__status">加载中…</p>
        <p v-else-if="historyError" class="history__status history__status--err">
          {{ historyError }}
        </p>
        <p v-else-if="!historyItems.length" class="history__status">
          还没有保存的对话。发一条咨询后会出现在这里。
        </p>
        <ul v-else class="history__list">
          <li
            v-for="item in historyItems"
            :key="item.id"
            class="history__item"
            :class="{ 'is-active': chatId === item.id }"
          >
            <button
              type="button"
              class="history__main"
              @click="loadHistoryItem(item)"
            >
              <span class="history__item-title">{{ item.title }}</span>
              <span class="history__item-meta">
                {{ formatUpdated(item.updatedAt) }}
                · {{ item.messageCount }} 条
              </span>
            </button>
            <button
              type="button"
              class="history__delete"
              aria-label="删除"
              @click="removeHistoryItem(item)"
            >
              删除
            </button>
          </li>
        </ul>
      </aside>
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

.page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  font-size: var(--fs-base);
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
  background: color-mix(in srgb, var(--c-grape) 75%, var(--c-honey));
}

.thinking__dot:nth-child(3) {
  animation-delay: 0.28s;
  background: color-mix(in srgb, var(--c-grape) 70%, var(--c-mint));
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
    transform: translateY(-7px) scale(1.15);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bubble--thinking,
  .thinking__label,
  .thinking__dot {
    animation: none;
  }

  .thinking__label {
    opacity: 0.85;
  }

  .thinking__dot {
    opacity: 0.7;
  }
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

.history-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(61, 43, 31, 0.28);
  display: flex;
  justify-content: flex-end;
}

.history {
  width: min(100%, 380px);
  height: 100%;
  margin: 0;
  border-radius: 0;
  border-right: none;
  display: flex;
  flex-direction: column;
  padding: 18px 16px;
  overflow: hidden;
}

.history__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.history__title {
  margin: 0;
  font-size: var(--fs-lg);
}

.history__status {
  margin: 12px 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.history__status--err {
  color: var(--c-coral);
  font-weight: 700;
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history__item {
  display: flex;
  gap: 6px;
  align-items: stretch;
  border: var(--stroke-light);
  border-radius: var(--r-md);
  background: var(--c-cream-2);
  overflow: hidden;
}

.history__item.is-active {
  border-color: var(--c-grape);
  background: var(--c-grape-soft);
}

.history__main {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.history__item-title {
  display: block;
  font-weight: 700;
  font-size: var(--fs-sm);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history__item-meta {
  display: block;
  margin-top: 4px;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

.history__delete {
  flex-shrink: 0;
  padding: 0 12px;
  border: 0;
  border-left: var(--stroke-light);
  background: transparent;
  color: var(--c-ink-2);
  font-size: var(--fs-xs);
  cursor: pointer;
}

.history__delete:hover {
  color: var(--c-coral);
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
