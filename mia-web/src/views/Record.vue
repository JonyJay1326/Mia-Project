<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SceneCards from '@/components/SceneCards.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import TypeChip from '@/components/TypeChip.vue'
import MiaDateTimePicker from '@/components/MiaDateTimePicker.vue'
import EventMediaAttach from '@/components/EventMediaAttach.vue'
import type { Scene } from '@/config/scenes'
import {
  CAREGIVER_CHIPS,
  COPING_CHIPS,
  LOCATION_CHIPS,
  TRIGGER_CHIPS,
} from '@/config/chips'
import type {
  CaregiverType,
  EventRecord,
  LocationType,
  TriggerType,
} from '@/types/event'
import {
  BIRTH_DATE,
  formatMonthAge,
  fromDatetimeLocalValue,
  monthAge,
  toDatetimeLocalValue,
} from '@/utils/date'
import { loadLastPrefs, saveLastPrefs } from '@/utils/prefs'
import { request } from '@/api/client'
import { fetchEvents, fetchDailyQuote } from '@/api/events'
import type { QuoteRecord } from '@/types/event'
import { createSkill } from '@/api/skills'
import { skillDomainLabel } from '@/config/skillDomains'
import { useDraftStore } from '@/stores/draft'
import { createId } from '@/utils/id'
import { dayKey, formatTime } from '@/utils/timeline'

const route = useRoute()
const router = useRouter()
const sceneCardsRef = ref<InstanceType<typeof SceneCards> | null>(null)
const activeSceneId = ref<string | null>(null)
const showExtra = ref(false)
const saving = ref(false)
const toast = ref('')
const recent = ref<EventRecord[]>([])
const dailyQuote = ref<QuoteRecord | null>(null)
const draftStore = useDraftStore()

const prefs = loadLastPrefs()
/** 是否从时间线「补录」进来（强调可改时间） */
const isBackfill = computed(() => route.query.backfill === '1')

const form = reactive({
  happenedLocal: toDatetimeLocalValue(),
  type: 'meltdown' as string,
  summary: '',
  chips: [] as string[],
  location: prefs.location as LocationType | null,
  trigger: null as TriggerType | null,
  caregiver: prefs.caregiver as CaregiverType,
  napped: null as 0 | 1 | null,
  intensity: null as number | null,
  durationMin: null as number | null,
  coping: [] as string[],
  outcome: '',
  photoId: null as string | null,
})

/** 当前月龄展示 */
const ageLabel = computed(() => {
  const age = monthAge(BIRTH_DATE, fromDatetimeLocalValue(form.happenedLocal))
  const years = Math.floor(age / 12)
  const rem = age % 12
  return `${years} 岁 ${rem} 个月`
})

/** 是否崩溃类（展示触发 / 补充详情） */
const isMeltdown = computed(() => form.type === 'meltdown')

/** 是否技能类（保存后同步进技能地图） */
const isSkill = computed(() => form.type === 'skill')

/** 当前场景自带的一句话 chips（自定义卡） */
const activeSceneChips = computed(() => {
  if (!activeSceneId.value) {
    return null
  }
  return sceneCardsRef.value?.getScene(activeSceneId.value)?.chips ?? null
})

/** 拉取最近几条，给手机首页预览 */
async function loadRecent() {
  try {
    recent.value = await fetchEvents({ limit: 5 })
  } catch {
    recent.value = []
  }
}

/** 拉取今日一句（不足 20 条时后端返回 null） */
async function loadDailyQuote() {
  try {
    dailyQuote.value = await fetchDailyQuote()
  } catch {
    dailyQuote.value = null
  }
}

/** 去语录墙 */
function goQuotesWall() {
  void router.push({ name: 'quotes' })
}

/**
 * 选中场景卡片：写入预填字段
 */
function onSelectScene(scene: Scene) {
  activeSceneId.value = scene.id
  form.type = scene.preset.type
  if (scene.preset.location) {
    form.location = scene.preset.location
  }
  if (scene.preset.trigger) {
    form.trigger = scene.preset.trigger
  }
  form.chips = []
  form.summary = ''
  form.coping = []
  form.photoId = null
  showExtra.value = false
}

/** Chip 选中后同步摘要 */
function onPickSummary(text: string) {
  form.summary = text
}

/** 切换应对方式多选 */
function toggleCoping(label: string) {
  const set = new Set(form.coping)
  if (set.has(label)) {
    set.delete(label)
  } else {
    set.add(label)
  }
  form.coping = Array.from(set)
}

/** 轻提示 */
function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) {
      toast.value = ''
    }
  }, 2200)
}

/** 重置为可继续录入的状态 */
function resetAfterSave() {
  form.happenedLocal = toDatetimeLocalValue()
  form.summary = ''
  form.chips = []
  form.trigger = null
  form.intensity = null
  form.durationMin = null
  form.coping = []
  form.outcome = ''
  form.napped = null
  form.photoId = null
  showExtra.value = false
  activeSceneId.value = null
  void loadRecent()
}

/** 去记语录 */
function goQuotes() {
  void router.push({ name: 'quote-record' })
}

/**
 * 场景卡片被删：若正在编辑该场景则回到选卡态
 */
function onSceneRemoved(id: string) {
  if (activeSceneId.value === id) {
    activeSceneId.value = null
  }
}

/**
 * 新技能记录成功后，AI 分类并写入技能地图
 */
async function syncSkillToMap(summary: string, happenedAt: string) {
  try {
    const created = await createSkill({
      label: summary,
      useAi: true,
      status: 'emerging',
      markedAt: happenedAt,
    })
    showToast(
      `已加入技能地图 · ${skillDomainLabel(created.domain)} ${created.emoji}`,
    )
  } catch (e) {
    console.error(e)
    showToast('已记录（技能地图同步失败）')
  }
}

/**
 * 提交事件到后端；失败则写入离线草稿队列
 */
async function submit() {
  if (!form.summary.trim()) {
    showToast('写一句发生了什么再保存哦')
    return
  }
  if (!form.caregiver) {
    showToast('选一下记录人')
    return
  }

  saving.value = true
  const happenedAt = fromDatetimeLocalValue(form.happenedLocal)
  const summaryText = form.summary.trim()
  const eventType = form.type
  const payload = {
    id: createId(),
    happenedAt,
    type: eventType,
    summary: summaryText,
    chips: form.chips,
    location: form.location,
    trigger: form.trigger,
    intensity: form.intensity,
    durationMin: form.durationMin,
    coping: form.coping,
    outcome: form.outcome || null,
    caregiver: form.caregiver,
    napped: isSkill.value ? null : form.napped,
    photoId: form.photoId,
    monthAge: monthAge(BIRTH_DATE, happenedAt),
  }

  try {
    await request('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (form.location) {
      saveLastPrefs({ caregiver: form.caregiver, location: form.location })
    } else {
      saveLastPrefs({ caregiver: form.caregiver, location: prefs.location })
    }

    if (activeSceneId.value) {
      sceneCardsRef.value?.bumpCount(activeSceneId.value)
    }

    if (eventType === 'skill') {
      await syncSkillToMap(summaryText, happenedAt)
    } else {
      showToast('已记录 ✨')
    }
    resetAfterSave()
  } catch (err) {
    console.error(err)
    try {
      await draftStore.enqueue({
        id: payload.id,
        kind: 'event',
        payload,
        createdAt: new Date().toISOString(),
      })
      showToast('已存本地，联网后自动同步')
      resetAfterSave()
    } catch {
      showToast('保存失败，请稍后再试')
    }
  } finally {
    saving.value = false
  }
}

/** Ctrl/Cmd + Enter 保存 */
function onSaveHotkey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void submit()
  }
}

onMounted(() => {
  void loadRecent()
  void loadDailyQuote()
  window.addEventListener('keydown', onSaveHotkey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onSaveHotkey)
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <p class="page__eyebrow">现在 · {{ ageLabel }}</p>
      <h1 class="page__title">{{ isBackfill ? '📝 补录' : '⚡ 快速记录' }}</h1>
      <p class="page__desc">
        {{ isBackfill ? '改好时间再选场景保存' : '点一张场景卡片 → 选一句话 → 保存' }}
      </p>
    </header>

    <button
      v-if="dailyQuote && !activeSceneId"
      type="button"
      class="mia-card daily-quote"
      @click="goQuotesWall"
    >
      <p class="daily-quote__eyebrow">
        今日一句 · {{ formatMonthAge(dailyQuote.monthAge) }}
      </p>
      <p class="daily-quote__content">「{{ dailyQuote.content }}」</p>
      <p v-if="dailyQuote.context" class="daily-quote__meta">{{ dailyQuote.context }}</p>
    </button>

    <button
      v-if="!activeSceneId"
      type="button"
      class="mia-card quote-cta mobile-only"
      @click="goQuotes"
    >
      <span class="quote-cta__emoji">💬</span>
      <span>
        <strong>渺言妙语</strong>
        <small>她说了好玩的话？马上记</small>
      </span>
    </button>

    <SceneCards
      ref="sceneCardsRef"
      :active-id="activeSceneId"
      @select="onSelectScene"
      @removed="onSceneRemoved"
    />

    <section v-if="activeSceneId" class="form mia-card">
      <div class="form__row form__row--between">
        <TypeChip :type="form.type" />
        <MiaDateTimePicker
          v-model="form.happenedLocal"
          :backfill="isBackfill"
        />
      </div>

      <div class="form__block">
        <h3 class="form__label">一句话</h3>
        <p v-if="isSkill" class="form__hint">
          保存后会自动加入技能地图（AI 选 emoji 和分类）
        </p>
        <ChipGroup
          v-model="form.chips"
          :type="form.type"
          :options="activeSceneChips"
          @pick="onPickSummary"
        />
        <input
          v-model="form.summary"
          class="mia-input form__summary"
          type="text"
          placeholder="也可以自己写…"
        />
      </div>

      <div class="form__block">
        <h3 class="form__label">记录人</h3>
        <div class="form__chips">
          <button
            v-for="item in CAREGIVER_CHIPS"
            :key="item.value"
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.caregiver === item.value }"
            @click="form.caregiver = item.value as CaregiverType"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="form__block">
        <h3 class="form__label">地点</h3>
        <div class="form__chips">
          <button
            v-for="item in LOCATION_CHIPS"
            :key="item.value"
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.location === item.value }"
            @click="form.location = item.value as LocationType"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="isMeltdown" class="form__block">
        <h3 class="form__label">触发</h3>
        <div class="form__chips">
          <button
            v-for="item in TRIGGER_CHIPS"
            :key="item.value"
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.trigger === item.value }"
            @click="form.trigger = item.value as TriggerType"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="!isSkill" class="form__block">
        <h3 class="form__label">今天午睡了吗</h3>
        <div class="form__chips">
          <button
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.napped === 1 }"
            @click="form.napped = 1"
          >
            睡了
          </button>
          <button
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.napped === 0 }"
            @click="form.napped = 0"
          >
            没睡
          </button>
          <button
            type="button"
            class="mia-chip"
            :class="{ 'is-active': form.napped === null }"
            @click="form.napped = null"
          >
            不清楚
          </button>
        </div>
      </div>

      <button
        type="button"
        class="form__extra-toggle"
        @click="showExtra = !showExtra"
      >
        {{ showExtra ? '收起补充详情' : '▸ 补充详情（可稍后）' }}
      </button>

      <div v-if="showExtra" class="form__extra">
        <template v-if="isMeltdown">
          <label class="form__label">强度 1–5</label>
          <div class="form__chips">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="mia-chip"
              :class="{ 'is-active': form.intensity === n }"
              @click="form.intensity = n"
            >
              {{ n }}
            </button>
          </div>
          <label class="form__label">时长（分钟）</label>
          <input
            v-model.number="form.durationMin"
            class="mia-input"
            type="number"
            min="0"
            placeholder="大概几分钟"
          />
          <label class="form__label">应对方式</label>
          <div class="form__chips">
            <button
              v-for="label in COPING_CHIPS"
              :key="label"
              type="button"
              class="mia-chip"
              :class="{ 'is-active': form.coping.includes(label) }"
              @click="toggleCoping(label)"
            >
              {{ label }}
            </button>
          </div>
          <label class="form__label">结果</label>
          <input
            v-model="form.outcome"
            class="mia-input"
            type="text"
            placeholder="后来怎样了"
          />
        </template>
        <EventMediaAttach v-model:photo-id="form.photoId" />
      </div>

      <div class="form__actions">
        <button
          type="button"
          class="mia-btn mia-btn--primary"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </section>

    <p v-if="!activeSceneId" class="page__hint">先点上面一张卡片开始记～</p>

    <section v-if="!activeSceneId && recent.length" class="recent">
      <h2 class="recent__title">最近记录</h2>
      <button
        v-for="item in recent"
        :key="item.id"
        type="button"
        class="mia-card recent__item"
        @click="router.push({ name: 'timeline' })"
      >
        <TypeChip :type="item.type" />
        <div class="recent__body">
          <p class="recent__summary">{{ item.summary }}</p>
          <p class="recent__meta">
            {{ dayKey(item.happenedAt).slice(5) }} {{ formatTime(item.happenedAt) }}
          </p>
        </div>
      </button>
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

.page__eyebrow {
  margin: 0 0 4px;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  font-weight: 600;
}

.page__title {
  margin: 0 0 8px;
  font-size: var(--fs-title);
  color: var(--c-ink);
}

.page__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}

.page__hint {
  margin-top: 20px;
  color: var(--c-ink-2);
  text-align: center;
}

.quote-cta {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  background: var(--c-grape-soft);
  border-color: var(--c-grape);
}

.quote-cta__emoji {
  font-size: 28px;
  line-height: 1;
}

.quote-cta strong {
  display: block;
  font-size: var(--fs-md);
}

.quote-cta small {
  color: var(--c-ink-2);
  font-size: var(--fs-xs);
}

.daily-quote {
  width: 100%;
  display: block;
  margin-bottom: 16px;
  padding: 16px 18px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  background: var(--c-grape-soft);
  border-color: var(--c-grape);
  transition:
    transform var(--dur) var(--ease-bounce),
    box-shadow var(--dur) var(--ease-bounce);
}

.daily-quote:hover {
  transform: translate(-1px, -2px);
  box-shadow: var(--shadow-pop);
}

.daily-quote__eyebrow {
  margin: 0 0 8px;
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--c-grape);
  letter-spacing: 0.02em;
}

.daily-quote__content {
  margin: 0 0 6px;
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
  line-height: 1.45;
}

.daily-quote__meta {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--c-ink-2);
}

.mobile-only {
  display: flex;
}

@media (min-width: 768px) {
  .mobile-only {
    display: none;
  }
}

.recent {
  margin-top: 28px;
}

.recent__title {
  margin: 0 0 12px;
  font-size: var(--fs-md);
}

.recent__item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.recent__summary {
  margin: 0 0 4px;
  font-size: var(--fs-sm);
  font-weight: 600;
}

.recent__meta {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.form {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form__row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form__row--between {
  justify-content: space-between;
  flex-wrap: wrap;
}

.form__block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form__label {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.form__hint {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-mint);
  font-weight: 600;
}

.form__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form__summary {
  margin-top: 4px;
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
  padding-top: 4px;
}

.form__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
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
  background: var(--c-honey);
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
