<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { createQuote } from '@/api/events'
import { useDraftStore } from '@/stores/draft'
import { BIRTH_DATE, monthAge } from '@/utils/date'

const draftStore = useDraftStore()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showExtra = ref(false)
const saving = ref(false)
const toast = ref('')

const form = reactive({
  content: '',
  context: '',
  note: '',
})

/** 聚焦原话输入框 */
async function focusInput() {
  await nextTick()
  textareaRef.value?.focus()
}

/** 轻提示 */
function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) {
      toast.value = ''
    }
  }, 2000)
}

/** 清空并保持录入态 */
async function resetForm() {
  form.content = ''
  form.context = ''
  form.note = ''
  showExtra.value = false
  await focusInput()
}

/**
 * 保存语录；失败进离线队列
 */
async function submit() {
  const content = form.content.trim()
  if (!content) {
    showToast('先写下她说的原话')
    return
  }

  saving.value = true
  const saidAt = new Date().toISOString()
  const payload = {
    id: crypto.randomUUID(),
    content,
    context: form.context.trim() || null,
    note: form.note.trim() || null,
    saidAt,
    monthAge: monthAge(BIRTH_DATE, saidAt),
  }

  try {
    await createQuote(payload)
    showToast('已记下 💬')
    await resetForm()
  } catch (err) {
    console.error(err)
    try {
      await draftStore.enqueue({
        id: payload.id,
        kind: 'quote',
        payload,
        createdAt: new Date().toISOString(),
      })
      showToast('已存本地，联网后自动同步')
      await resetForm()
    } catch {
      showToast('保存失败，请稍后再试')
    }
  } finally {
    saving.value = false
  }
}

/** Ctrl/Cmd + Enter 保存 */
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void submit()
  }
}

onMounted(() => {
  void focusInput()
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <h1 class="page__title">💬 渺言妙语</h1>
      <p class="page__desc">原话逐字记 · 一个字都不要加工</p>
    </header>

    <section class="form mia-card">
      <label class="form__label" for="quote-content">她说：</label>
      <textarea
        id="quote-content"
        ref="textareaRef"
        v-model="form.content"
        class="mia-input form__textarea"
        rows="4"
        placeholder="把原话写在这里…"
        @keydown="onKeydown"
      />

      <button
        type="button"
        class="form__extra-toggle"
        @click="showExtra = !showExtra"
      >
        {{ showExtra ? '收起上下文和解读' : '▸ 上下文和我的解读（选填）' }}
      </button>

      <div v-if="showExtra" class="form__extra">
        <label class="form__label">上下文</label>
        <input
          v-model="form.context"
          class="mia-input"
          type="text"
          placeholder="在哪 / 在干嘛 / 看到什么"
        />
        <label class="form__label">我的感受</label>
        <input
          v-model="form.note"
          class="mia-input"
          type="text"
          placeholder="为什么觉得特别"
        />
      </div>

      <div class="form__actions">
        <button
          type="button"
          class="mia-btn mia-btn--primary"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? '保存中…' : '保存 ⌘↵' }}
        </button>
      </div>
    </section>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.page__hero {
  margin-bottom: 20px;
}

.page__title {
  margin: 0 0 8px;
  font-size: var(--fs-title);
}

.page__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.form__textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.5;
}

.form__extra-toggle {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--c-ink-2);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.form__extra {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form__actions {
  display: flex;
  justify-content: flex-end;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 88px;
  transform: translateX(-50%);
  z-index: 80;
  padding: 10px 18px;
  border: var(--stroke);
  border-radius: var(--r-pill);
  background: var(--c-grape-soft);
  color: var(--c-ink);
  font-weight: 700;
  box-shadow: var(--shadow-sticker);
}

@media (min-width: 768px) {
  .toast {
    bottom: 32px;
  }
}
</style>
