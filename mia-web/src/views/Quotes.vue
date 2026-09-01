<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteQuote,
  fetchQuotesGrouped,
  type QuoteMonthGroup,
} from '@/api/events'
import { photoAssetUrl } from '@/api/photos'
import type { QuoteRecord } from '@/types/event'
import { useMiaConfirm } from '@/composables/useMiaConfirm'
import { formatMonthAge } from '@/utils/date'
import { dayKey } from '@/utils/timeline'

const router = useRouter()
const { confirm } = useMiaConfirm()
const loading = ref(false)
const groups = ref<QuoteMonthGroup[]>([])
const toast = ref('')
const removingId = ref<string | null>(null)

/** 短暂提示 */
function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) {
      toast.value = ''
    }
  }, 1800)
}

/** 加载按月龄分组的语录 */
async function load() {
  loading.value = true
  try {
    groups.value = await fetchQuotesGrouped()
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

/** 去录入 */
function goRecord() {
  void router.push({ name: 'quote-record' })
}

/** 日期短显 MM-DD */
function shortDate(iso: string) {
  const key = dayKey(iso)
  return key.slice(5)
}

/** 语录配图缩略图地址 */
function quoteThumb(photoId: string | null | undefined) {
  if (!photoId) {
    return null
  }
  return photoAssetUrl(`/photos/${photoId}/file?v=thumb`)
}

/**
 * 删除一条语录（二次确认）
 */
async function removeQuote(item: QuoteRecord) {
  const preview =
    item.content.length > 24 ? `${item.content.slice(0, 24)}…` : item.content
  const ok = await confirm({
    title: '删除这条渺言妙语？',
    message: `删除后不可恢复。\n\n「${preview}」`,
    confirmText: '删除',
    cancelText: '再想想',
    danger: true,
  })
  if (!ok) {
    return
  }
  removingId.value = item.id
  try {
    await deleteQuote(item.id)
    groups.value = groups.value
      .map((g) => ({
        ...g,
        items: g.items.filter((q) => q.id !== item.id),
      }))
      .filter((g) => g.items.length > 0)
    showToast('已删除')
  } catch (err) {
    console.error(err)
    showToast('删除失败')
  } finally {
    removingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <div>
        <h1 class="page__title">💬 渺言妙语</h1>
        <p class="page__desc">按月龄看她的认知发展史</p>
      </div>
      <button type="button" class="mia-btn mia-btn--primary" @click="goRecord">
        记一句
      </button>
    </header>

    <div v-if="loading" class="mia-empty">
      <span class="mia-empty__emoji">⏳</span>
      <p class="mia-empty__text">加载中…</p>
    </div>

    <div v-else-if="!groups.length" class="mia-empty">
      <span class="mia-empty__emoji">🫧</span>
      <p class="mia-empty__text">还没有语录，她下一句好玩的话就记下来吧</p>
      <button type="button" class="mia-btn mia-btn--honey" @click="goRecord">
        开始记录
      </button>
    </div>

    <section
      v-for="group in groups"
      :key="group.monthAge"
      class="month-block"
    >
      <h2 class="month-block__title">
        {{ formatMonthAge(group.monthAge) }}
        <span class="month-block__count">· {{ group.items.length }} 条</span>
      </h2>

      <article
        v-for="item in group.items"
        :key="item.id"
        class="mia-card quote-card"
      >
        <img
          v-if="quoteThumb(item.photoId)"
          class="quote-card__photo"
          :src="quoteThumb(item.photoId)!"
          alt=""
          loading="lazy"
        />
        <div class="quote-card__head">
          <p class="quote-card__content">「{{ item.content }}」</p>
          <button
            type="button"
            class="quote-card__delete"
            :disabled="removingId === item.id"
            :aria-label="`删除语录：${item.content}`"
            @click.stop="removeQuote(item)"
          >
            删除
          </button>
        </div>
        <p v-if="item.note" class="quote-card__note">我的感受：{{ item.note }}</p>
        <p class="quote-card__meta">
          {{ shortDate(item.saidAt) }}
          <template v-if="item.context"> · {{ item.context }}</template>
        </p>
      </article>
    </section>

    <div v-if="toast" class="page__toast" role="status">{{ toast }}</div>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px 16px 48px;
  position: relative;
}

.page__hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
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

.month-block {
  margin-bottom: 28px;
}

.month-block__title {
  margin: 0 0 12px;
  font-size: var(--fs-lg);
  color: var(--c-ink);
}

.month-block__count {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-ink-2);
}

.quote-card {
  margin-bottom: 12px;
  border-color: var(--c-grape);
  background: var(--c-grape-soft);
  overflow: hidden;
}

.quote-card__photo {
  display: block;
  width: calc(100% + 32px);
  max-height: 220px;
  margin: -16px -16px 12px;
  object-fit: cover;
  background: var(--c-cream-3);
}

.quote-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.quote-card__content {
  flex: 1;
  margin: 0 0 10px;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.45;
}

.quote-card__delete {
  flex-shrink: 0;
  margin-top: 2px;
  padding: 4px 10px;
  border: var(--stroke-light);
  border-radius: var(--r-pill);
  background: var(--c-cream-2);
  color: var(--c-ink-2);
  font-size: var(--fs-xs);
  cursor: pointer;
  line-height: 1.4;
}

.quote-card__delete:hover:not(:disabled) {
  color: var(--c-coral);
  border-color: var(--c-coral);
}

.quote-card__delete:disabled {
  opacity: 0.55;
  cursor: wait;
}

.quote-card__note {
  margin: 0 0 8px;
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
}

.quote-card__meta {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  text-align: right;
}

.page__toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  z-index: 80;
  transform: translateX(-50%);
  padding: 10px 18px;
  border: var(--stroke);
  border-radius: var(--r-pill);
  background: var(--c-cream);
  box-shadow: var(--shadow-sticker);
  font-size: var(--fs-sm);
  color: var(--c-ink);
}

@media (min-width: 768px) {
  .page__toast {
    bottom: 32px;
  }
}
</style>
