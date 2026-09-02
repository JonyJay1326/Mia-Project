<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import MiaFormDialog from '@/components/MiaFormDialog.vue'
import MiaDateTimePicker from '@/components/MiaDateTimePicker.vue'
import { formatFetchError } from '@/api/client'
import { updateQuote } from '@/api/events'
import type { QuoteRecord } from '@/types/event'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/utils/date'

const props = defineProps<{
  /** 是否显示 */
  open: boolean
  /** 当前编辑的语录 */
  quote: QuoteRecord | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [quote: QuoteRecord]
  error: [message: string]
}>()

const saving = ref(false)

const form = reactive({
  context: '',
  note: '',
  saidLocal: toDatetimeLocalValue(),
})

/** 打开时回填表单 */
watch(
  () => [props.open, props.quote] as const,
  ([open, quote]) => {
    if (!open || !quote) {
      return
    }
    form.context = quote.context ?? ''
    form.note = quote.note ?? ''
    form.saidLocal = toDatetimeLocalValue(new Date(quote.saidAt))
  },
)

/** 关闭弹框 */
function close() {
  if (saving.value) {
    return
  }
  emit('update:open', false)
}

/** 保存 context / note / 时间 */
async function save() {
  const quote = props.quote
  if (!quote || saving.value) {
    return
  }
  saving.value = true
  try {
    const updated = await updateQuote(quote.id, {
      context: form.context.trim() || null,
      note: form.note.trim() || null,
      saidAt: fromDatetimeLocalValue(form.saidLocal),
    })
    emit('saved', updated)
    emit('update:open', false)
  } catch (e) {
    emit('error', formatFetchError(e))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <MiaFormDialog
    :open="open"
    title="补充语录详情"
    emoji="💬"
    confirm-text="保存"
    :loading="saving"
    @update:open="emit('update:open', $event)"
    @confirm="save"
    @cancel="close"
  >
    <p v-if="quote" class="quote-readonly">「{{ quote.content }}」</p>
    <p class="quote-hint">原话不建议改；可补上下文、感受或纠正说话时间。</p>

    <label class="field">
      <span class="field__label">说话时间</span>
      <MiaDateTimePicker v-model="form.saidLocal" :backfill="true" />
    </label>

    <label class="field">
      <span class="field__label">上下文</span>
      <input
        v-model="form.context"
        class="mia-input"
        type="text"
        maxlength="120"
        placeholder="在哪 / 在干嘛 / 看到什么"
        :disabled="saving"
      />
    </label>

    <label class="field">
      <span class="field__label">我的感受</span>
      <textarea
        v-model="form.note"
        class="mia-input field__textarea"
        rows="3"
        maxlength="200"
        placeholder="为什么觉得特别（选填）"
        :disabled="saving"
      />
    </label>
  </MiaFormDialog>
</template>

<style scoped>
.quote-readonly {
  margin: 0 0 8px;
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.45;
}

.quote-hint {
  margin: 0 0 14px;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  line-height: 1.45;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field:last-child {
  margin-bottom: 0;
}

.field__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.field__textarea {
  min-height: 72px;
  resize: vertical;
  line-height: 1.45;
}
</style>
