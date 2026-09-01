<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EventItem from '@/components/EventItem.vue'
import TypeChip from '@/components/TypeChip.vue'
import EventMediaAttach from '@/components/EventMediaAttach.vue'
import { deleteEvent, deleteQuote, fetchEvents, fetchQuotesGrouped, patchEvent } from '@/api/events'
import { photoAssetUrl } from '@/api/photos'
import type { EventRecord, QuoteRecord, TimelineItemType } from '@/types/event'
import { formatMonthAge, monthAge, BIRTH_DATE } from '@/utils/date'
import {
  dayKey,
  formatTime,
  intensityDots,
  mergeTimeline,
  monthKey,
  type TimelineItem,
} from '@/utils/timeline'
import { TRIGGER_CHIPS, caregiverLabel, locationLabel } from '@/config/chips'
import { useEventsStore } from '@/stores/events'
import { useMiaConfirm } from '@/composables/useMiaConfirm'

type FilterType = 'all' | TimelineItemType

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'meltdown', label: '崩溃' },
  { value: 'quote', label: '语录' },
  { value: 'skill', label: '技能' },
  { value: 'daily', label: '日常' },
  { value: 'emotion', label: '情绪' },
  { value: 'sleep', label: '睡眠' },
  { value: 'diet', label: '饮食' },
  { value: 'social', label: '社交' },
  { value: 'medical', label: '医疗' },
]

const router = useRouter()
const eventsStore = useEventsStore()
const { confirm } = useMiaConfirm()
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const eventRows = ref<EventRecord[]>([])
const quoteRows = ref<QuoteRecord[]>([])
const items = ref<TimelineItem[]>([])
const filter = ref<FilterType>('all')
const activeMonth = ref<string | null>(null)
const drawerOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const removingId = ref<string | null>(null)

/** 按筛选过滤后的列表 */
const filtered = computed(() => {
  if (filter.value === 'all') {
    return items.value
  }
  return items.value.filter((i) => i.type === filter.value)
})

/** 月份 → 日期 → 条目 */
const monthGroups = computed(() => {
  const map = new Map<string, Map<string, TimelineItem[]>>()
  for (const item of filtered.value) {
    const mk = monthKey(item.at)
    const dk = dayKey(item.at)
    if (!map.has(mk)) {
      map.set(mk, new Map())
    }
    const days = map.get(mk)!
    if (!days.has(dk)) {
      days.set(dk, [])
    }
    days.get(dk)!.push(item)
  }
  return Array.from(map.entries()).map(([month, days]) => ({
    month,
    days: Array.from(days.entries()).map(([day, list]) => ({
      day,
      count: list.length,
      list,
    })),
  }))
})

/** 当前展示的月份块（未选手动月份则全部） */
const visibleGroups = computed(() => {
  if (!activeMonth.value) {
    return monthGroups.value
  }
  return monthGroups.value.filter((g) => g.month === activeMonth.value)
})

/** 当前选中条目 */
const selected = computed(() =>
  items.value.find((i) => i.id === eventsStore.selectedId) ?? null,
)

/** 编辑中的事件草稿 */
const editForm = ref<Partial<EventRecord>>({})

/** 用当前事件/语录重算合并时间线 */
function rebuildItems() {
  items.value = mergeTimeline(eventRows.value, quoteRows.value)
  eventsStore.items = eventRows.value
}

/** 首次 / 刷新加载 */
async function load() {
  loading.value = true
  hasMore.value = true
  try {
    const [events, quoteGroups] = await Promise.all([
      fetchEvents({ limit: 50 }),
      fetchQuotesGrouped().catch(() => []),
    ])
    eventRows.value = events
    quoteRows.value = quoteGroups.flatMap((g) => g.items)
    hasMore.value = events.length >= 50
    rebuildItems()
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

/** 滚动到底加载更多事件（语录一次拉全） */
async function loadMore() {
  if (loadingMore.value || !hasMore.value || loading.value) {
    return
  }
  const lastEvent = eventRows.value[eventRows.value.length - 1]
  if (!lastEvent) {
    hasMore.value = false
    return
  }
  loadingMore.value = true
  try {
    const more = await fetchEvents({
      limit: 50,
      before: lastEvent.happenedAt,
    })
    if (!more.length) {
      hasMore.value = false
      return
    }
    const seen = new Set(eventRows.value.map((e) => e.id))
    eventRows.value = [
      ...eventRows.value,
      ...more.filter((e) => !seen.has(e.id)),
    ]
    hasMore.value = more.length >= 50
    rebuildItems()
  } catch (err) {
    console.error(err)
  } finally {
    loadingMore.value = false
  }
}

/** 打开详情 */
function openItem(item: TimelineItem) {
  eventsStore.selectEvent(item.id)
  editing.value = false
  if (item.event) {
    editForm.value = {
      ...item.event,
      photoId: item.event.photoId ?? null,
    }
  }
  drawerOpen.value = true
}

/** 关闭抽屉 */
function closeDrawer() {
  drawerOpen.value = false
  editing.value = false
  eventsStore.selectEvent(null)
}

/** 去补录（默认可改时间的录入页） */
function goBackfill() {
  void router.push({ name: 'record', query: { backfill: '1' } })
}

/** 枚举转中文 */
function labelOf(
  list: { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((x) => x.value === value)?.label ?? value ?? '—'
}

/** 日期标题：周日 · 2岁3个月 */
function dayHeading(day: string) {
  const d = new Date(`${day}T12:00:00`)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  const age = formatMonthAge(monthAge(BIRTH_DATE, d.toISOString()))
  return `${day}  周${week} · ${age}`
}

/** 保存事件补丁 */
async function saveEdit() {
  if (!selected.value?.event) {
    return
  }
  saving.value = true
  try {
    await patchEvent(selected.value.id, editForm.value)
    await load()
    editing.value = false
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

/** 删除指定时间线条目（二次确认） */
async function removeItem(item: TimelineItem) {
  const kindLabel = item.kind === 'quote' ? '语录' : '记录'
  const preview =
    item.title.length > 24 ? `${item.title.slice(0, 24)}…` : item.title
  const ok = await confirm({
    title: `删除这条${kindLabel}？`,
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
    if (item.kind === 'event') {
      await deleteEvent(item.id)
    } else {
      await deleteQuote(item.id)
    }
    if (eventsStore.selectedId === item.id) {
      closeDrawer()
    }
    await load()
  } catch (err) {
    console.error(err)
  } finally {
    removingId.value = null
  }
}

/** 删除当前抽屉中选中的事件或语录 */
async function removeSelected() {
  if (!selected.value) {
    return
  }
  await removeItem(selected.value)
}

/** Esc 关闭抽屉 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && drawerOpen.value) {
    closeDrawer()
  }
}

watch(filter, () => {
  activeMonth.value = null
})

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="timeline">
    <header class="timeline__head">
      <div>
        <h1 class="timeline__title">📅 时间线</h1>
        <p class="timeline__desc">按天浏览 · 点条目看详情</p>
      </div>
      <div class="timeline__actions">
        <button type="button" class="mia-btn mia-btn--honey" @click="goBackfill">
          补录
        </button>
        <button type="button" class="mia-btn" :disabled="loading" @click="load">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </header>

    <div class="timeline__filters">
      <button
        v-for="f in FILTERS"
        :key="f.value"
        type="button"
        class="mia-chip"
        :class="{ 'is-active': filter === f.value }"
        @click="filter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="timeline__body">
      <aside class="timeline__nav">
        <button
          type="button"
          class="timeline__nav-item"
          :class="{ 'is-active': !activeMonth }"
          @click="activeMonth = null"
        >
          全部月份
        </button>
        <button
          v-for="g in monthGroups"
          :key="g.month"
          type="button"
          class="timeline__nav-item"
          :class="{ 'is-active': activeMonth === g.month }"
          @click="activeMonth = g.month"
        >
          {{ g.month }}
          <span class="timeline__nav-count">
            {{ g.days.reduce((n, d) => n + d.count, 0) }}
          </span>
        </button>
      </aside>

      <div class="timeline__stream">
        <div v-if="!loading && !visibleGroups.length" class="mia-empty">
          <span class="mia-empty__emoji">📒</span>
          <p class="mia-empty__text">还没有记录哦，去快速记录记一条吧</p>
        </div>

        <section
          v-for="group in visibleGroups"
          :key="group.month"
          class="timeline__month"
        >
          <div
            v-for="day in group.days"
            :key="day.day"
            class="timeline__day"
          >
            <h2 class="timeline__day-title">{{ dayHeading(day.day) }}</h2>
            <div class="timeline__list">
              <EventItem
                v-for="item in day.list"
                :key="item.id"
                :item="item"
                :active="eventsStore.selectedId === item.id"
                :removing="removingId === item.id"
                @select="openItem(item)"
                @remove="removeItem(item)"
              />
            </div>
          </div>
        </section>

        <div v-if="visibleGroups.length" class="timeline__more">
          <button
            v-if="hasMore"
            type="button"
            class="mia-btn"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
          <p v-else class="timeline__end">已经到底啦</p>
        </div>
      </div>
    </div>

    <div
      v-if="drawerOpen"
      class="drawer-mask"
      @click.self="closeDrawer"
    >
      <aside class="drawer mia-card" @click.stop>
        <div class="drawer__head">
          <TypeChip v-if="selected" :type="selected.type" />
          <button type="button" class="mia-btn" @click="closeDrawer">关闭</button>
        </div>

        <template v-if="selected?.kind === 'quote' && selected.quote">
          <p class="drawer__quote">「{{ selected.quote.content }}」</p>
          <p class="drawer__meta">
            {{ formatTime(selected.quote.saidAt) }}
            · {{ formatMonthAge(selected.quote.monthAge) }}
          </p>
          <p v-if="selected.quote.context" class="drawer__note">
            上下文：{{ selected.quote.context }}
          </p>
          <p v-if="selected.quote.note" class="drawer__note">
            我的感受：{{ selected.quote.note }}
          </p>
          <div class="drawer__actions">
            <button type="button" class="mia-btn" @click="removeSelected">删除</button>
          </div>
        </template>

        <template v-else-if="selected?.event">
          <template v-if="!editing">
            <h3 class="drawer__summary">{{ selected.event.summary }}</h3>
            <p class="drawer__meta">
              {{ formatTime(selected.event.happenedAt) }}
              · {{ formatMonthAge(selected.event.monthAge) }}
            </p>
            <ul class="drawer__facts">
              <li>照护：{{ caregiverLabel(selected.event.caregiver) }}</li>
              <li>地点：{{ locationLabel(selected.event.location) }}</li>
              <li v-if="selected.event.trigger">
                触发：{{ labelOf(TRIGGER_CHIPS, selected.event.trigger) }}
              </li>
              <li v-if="selected.event.intensity">
                强度：{{ intensityDots(selected.event.intensity) }}
              </li>
              <li v-if="selected.event.durationMin">
                时长：{{ selected.event.durationMin }} 分钟
              </li>
              <li v-if="selected.event.coping?.length">
                应对：{{ selected.event.coping.join(' · ') }}
              </li>
              <li v-if="selected.event.outcome">结果：{{ selected.event.outcome }}</li>
            </ul>
            <a
              v-if="selected.event.photoId"
              class="drawer__media mia-card"
              :href="photoAssetUrl(`/photos/${selected.event.photoId}/file?v=original`)"
              target="_blank"
              rel="noopener"
              @click.stop
            >
              <img
                class="drawer__media-thumb"
                :src="photoAssetUrl(`/photos/${selected.event.photoId}/file?v=thumb`)"
                alt="附件预览"
              />
              <span class="drawer__media-caption">查看附件</span>
            </a>
            <div class="drawer__actions">
              <button type="button" class="mia-btn mia-btn--primary" @click="editing = true">
                编辑 / 补详情
              </button>
              <button type="button" class="mia-btn" @click="removeSelected">删除</button>
            </div>
          </template>

          <template v-else>
            <label class="drawer__label">摘要</label>
            <input v-model="editForm.summary" class="mia-input" type="text" />
            <template v-if="selected.event.type === 'meltdown'">
              <label class="drawer__label">强度</label>
              <div class="drawer__chips">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="mia-chip"
                  :class="{ 'is-active': editForm.intensity === n }"
                  @click="editForm.intensity = n"
                >
                  {{ n }}
                </button>
              </div>
              <label class="drawer__label">时长（分钟）</label>
              <input
                v-model.number="editForm.durationMin"
                class="mia-input"
                type="number"
                min="0"
              />
            </template>
            <label class="drawer__label">结果</label>
            <input v-model="editForm.outcome" class="mia-input" type="text" />
            <EventMediaAttach v-model:photo-id="editForm.photoId" />
            <div class="drawer__actions">
              <button
                type="button"
                class="mia-btn mia-btn--primary"
                :disabled="saving"
                @click="saveEdit"
              >
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button type="button" class="mia-btn" @click="editing = false">取消</button>
            </div>
          </template>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.timeline__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.timeline__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.timeline__title {
  margin: 0 0 4px;
  font-size: var(--fs-title);
}

.timeline__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.timeline__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.timeline__body {
  display: grid;
  gap: 16px;
}

@media (min-width: 768px) {
  .timeline__body {
    grid-template-columns: 180px 1fr;
    align-items: start;
  }
}

.timeline__nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

@media (min-width: 768px) {
  .timeline__nav {
    flex-direction: column;
    position: sticky;
    top: 16px;
    overflow: visible;
  }
}

.timeline__nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 2px solid transparent;
  border-radius: var(--r-md);
  background: var(--c-cream-2);
  color: var(--c-ink);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.timeline__nav-item.is-active {
  border-color: var(--stroke-color);
  box-shadow: var(--shadow-sticker);
  background: var(--c-sky-soft);
}

.timeline__nav-count {
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.timeline__day-title {
  margin: 8px 0 12px;
  font-size: var(--fs-md);
  color: var(--c-ink);
}

.timeline__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.timeline__more {
  display: flex;
  justify-content: center;
  padding: 8px 0 24px;
}

.timeline__end {
  margin: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(74, 63, 56, 0.35);
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: min(420px, 100%);
  height: 100%;
  margin: 0;
  border-radius: 16px 0 0 16px;
  border-width: 3px;
  overflow: auto;
  padding: 20px;
  animation: drawerIn 0.28s var(--ease-bounce) both;
}

@keyframes drawerIn {
  from {
    transform: translateX(24px);
    opacity: 0.6;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.drawer__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.drawer__summary {
  margin: 0 0 8px;
  font-size: var(--fs-lg);
}

.drawer__quote {
  margin: 0 0 8px;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--c-grape);
  line-height: 1.4;
}

.drawer__meta {
  margin: 0 0 12px;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.drawer__note {
  margin: 0 0 8px;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.drawer__facts {
  margin: 0 0 16px;
  padding-left: 18px;
  color: var(--c-ink);
  line-height: 1.7;
}

.drawer__media {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  margin-bottom: 12px;
  text-decoration: none;
  color: inherit;
}

.drawer__media-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--r-md);
  border: var(--stroke-light);
  background: var(--c-cream-3);
  flex-shrink: 0;
}

.drawer__media-caption {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-sky);
}

.drawer__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.drawer__label {
  display: block;
  margin: 10px 0 6px;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.drawer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

@media (max-width: 767px) {
  .drawer {
    width: 100%;
    border-radius: 16px 16px 0 0;
    margin-top: auto;
    max-height: 88vh;
  }

  .drawer-mask {
    align-items: flex-end;
  }
}
</style>
