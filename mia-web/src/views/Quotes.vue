<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import QuoteEditDialog from '@/components/QuoteEditDialog.vue'
import {
  deleteQuote,
  fetchQuotesGrouped,
  searchQuotes,
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

/** 搜索 */
const searchQuery = ref('')
/** 请求进行中 */
const searching = ref(false)
/** 等待 debounce 或请求中（尚未展示本次结果） */
const searchPending = ref(false)
/** 当前 searchResults 对应的搜索词 */
const searchSettledQuery = ref('')
const searchResults = ref<QuoteRecord[]>([])
let searchTimer = 0
let searchSeq = 0

/** 搜索中状态至少展示时长（毫秒） */
const SEARCH_MIN_SPIN_MS = 300

/** 当前输入的有效搜索词 */
const trimmedQuery = computed(() => searchQuery.value.trim())

/** 是否处于搜索模式（有输入） */
const isSearching = computed(() => trimmedQuery.value.length > 0)

/** 本次搜索是否已结束且与输入一致 */
const searchSettled = computed(
  () =>
    !searchPending.value &&
    !searching.value &&
    searchSettledQuery.value === trimmedQuery.value,
)

/** 是否应展示「搜索中」 */
const showSearchLoading = computed(
  () => isSearching.value && (searchPending.value || searching.value),
)

/** 编辑弹框 */
const editOpen = ref(false)
const editTarget = ref<QuoteRecord | null>(null)

const totalCount = computed(() =>
  groups.value.reduce((sum, g) => sum + g.items.length, 0),
)

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

/** 等待剩余时间，保证「搜索中」至少显示 SEARCH_MIN_SPIN_MS */
function waitSearchMinDisplay(startedAt: number) {
  const remaining = SEARCH_MIN_SPIN_MS - (Date.now() - startedAt)
  if (remaining <= 0) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining)
  })
}

/** 执行搜索 */
async function runSearch(q: string) {
  const seq = searchSeq
  searching.value = true
  const startedAt = Date.now()
  try {
    const results = await searchQuotes(q)
    if (seq !== searchSeq) {
      return
    }
    searchResults.value = results
    searchSettledQuery.value = q
  } catch (err) {
    if (seq !== searchSeq) {
      return
    }
    console.error(err)
    searchResults.value = []
    searchSettledQuery.value = q
    showToast('搜索失败')
  } finally {
    if (seq !== searchSeq) {
      return
    }
    await waitSearchMinDisplay(startedAt)
    if (seq === searchSeq) {
      searching.value = false
      searchPending.value = false
    }
  }
}

/** 搜索词变化：debounce；任意变化先作废进行中的请求 */
watch(searchQuery, (text) => {
  window.clearTimeout(searchTimer)
  searchSeq += 1
  const q = text.trim()
  if (!q) {
    searchResults.value = []
    searchSettledQuery.value = ''
    searching.value = false
    searchPending.value = false
    return
  }
  searchPending.value = true
  searchTimer = window.setTimeout(() => {
    void runSearch(q)
  }, 320)
})

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

/** 打开编辑弹框 */
function openEdit(item: QuoteRecord) {
  editTarget.value = item
  editOpen.value = true
}

/**
 * 编辑保存后更新分组列表（月龄可能变化）
 */
function onQuoteSaved(updated: QuoteRecord) {
  groups.value = groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((q) => q.id !== updated.id),
    }))
    .filter((g) => g.items.length > 0)

  const group = groups.value.find((g) => g.monthAge === updated.monthAge)
  if (group) {
    group.items.push(updated)
    group.items.sort((a, b) => b.saidAt.localeCompare(a.saidAt))
  } else {
    groups.value.push({
      monthAge: updated.monthAge,
      items: [updated],
    })
    groups.value.sort((a, b) => b.monthAge - a.monthAge)
  }

  if (isSearching.value) {
    const idx = searchResults.value.findIndex((q) => q.id === updated.id)
    if (idx >= 0) {
      searchResults.value[idx] = updated
    }
  }

  showToast('已保存')
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
    searchResults.value = searchResults.value.filter((q) => q.id !== item.id)
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

    <div v-if="totalCount > 0 || isSearching" class="search-bar">
      <input
        v-model="searchQuery"
        class="mia-input search-bar__input"
        type="search"
        placeholder="搜索原话、上下文或感受…"
        autocomplete="off"
      />
      <p v-if="searchSettled && searchResults.length > 0" class="search-bar__hint">
        找到 {{ searchResults.length }} 条
      </p>
    </div>

    <div v-if="loading" class="mia-empty">
      <span class="mia-empty__emoji">⏳</span>
      <p class="mia-empty__text">加载中…</p>
    </div>

    <div v-else-if="!groups.length && !isSearching" class="mia-empty">
      <span class="mia-empty__emoji">🫧</span>
      <p class="mia-empty__text">还没有语录，她下一句好玩的话就记下来吧</p>
      <button type="button" class="mia-btn mia-btn--honey" @click="goRecord">
        开始记录
      </button>
    </div>

    <template v-else-if="isSearching">
      <div v-if="showSearchLoading" class="mia-empty">
        <span class="mia-empty__emoji">🔍</span>
        <p class="mia-empty__text">搜索中…</p>
      </div>
      <div
        v-else-if="searchSettled && !searchResults.length"
        class="mia-empty"
      >
        <span class="mia-empty__emoji">🫧</span>
        <p class="mia-empty__text">没找到匹配的语录</p>
      </div>
      <section v-else-if="searchSettled && searchResults.length" class="search-results">
        <article
          v-for="item in searchResults"
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
            <div class="quote-card__actions">
              <button
                type="button"
                class="quote-card__action"
                @click="openEdit(item)"
              >
                编辑
              </button>
              <button
                type="button"
                class="quote-card__action quote-card__action--danger"
                :disabled="removingId === item.id"
                @click="removeQuote(item)"
              >
                删除
              </button>
            </div>
          </div>
          <p class="quote-card__age">{{ formatMonthAge(item.monthAge) }}</p>
          <p v-if="item.note" class="quote-card__note">我的感受：{{ item.note }}</p>
          <p class="quote-card__meta">
            {{ shortDate(item.saidAt) }}
            <template v-if="item.context"> · {{ item.context }}</template>
          </p>
        </article>
      </section>
    </template>

    <section
      v-for="group in groups"
      v-else
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
          <div class="quote-card__actions">
            <button
              type="button"
              class="quote-card__action"
              @click="openEdit(item)"
            >
              编辑
            </button>
            <button
              type="button"
              class="quote-card__action quote-card__action--danger"
              :disabled="removingId === item.id"
              @click="removeQuote(item)"
            >
              删除
            </button>
          </div>
        </div>
        <p v-if="item.note" class="quote-card__note">我的感受：{{ item.note }}</p>
        <p class="quote-card__meta">
          {{ shortDate(item.saidAt) }}
          <template v-if="item.context"> · {{ item.context }}</template>
        </p>
      </article>
    </section>

    <QuoteEditDialog
      v-model:open="editOpen"
      :quote="editTarget"
      @saved="onQuoteSaved"
      @error="showToast"
    />

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
  margin-bottom: 16px;
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

.search-bar {
  margin-bottom: 20px;
}

.search-bar__input {
  width: 100%;
}

.search-bar__hint {
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.search-results .quote-card {
  margin-bottom: 0;
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

.quote-card__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  margin-top: 2px;
}

.quote-card__action {
  padding: 4px 10px;
  border: var(--stroke-light);
  border-radius: var(--r-pill);
  background: var(--c-cream-2);
  color: var(--c-ink-2);
  font-size: var(--fs-xs);
  cursor: pointer;
  line-height: 1.4;
}

.quote-card__action:hover:not(:disabled) {
  color: var(--c-ink);
  border-color: var(--stroke-color);
}

.quote-card__action--danger:hover:not(:disabled) {
  color: var(--c-coral);
  border-color: var(--c-coral);
}

.quote-card__action:disabled {
  opacity: 0.55;
  cursor: wait;
}

.quote-card__age {
  margin: -4px 0 8px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-ink-2);
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
