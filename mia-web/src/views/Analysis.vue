<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchMeltdownAnalytics } from '@/api/analytics'
import { postAiInsight } from '@/api/ai'
import type { MeltdownAnalytics } from '@/types/analytics'
import RankCard from '@/components/analytics/RankCard.vue'
import StatBar from '@/components/analytics/StatBar.vue'
import MiaMarkdown from '@/components/MiaMarkdown.vue'

/** 可选时间窗口 */
const dayOptions = [
  { value: 30, label: '近 30 天' },
  { value: 60, label: '近 60 天' },
  { value: 90, label: '近 90 天' },
] as const

const days = ref(60)
const loading = ref(false)
const error = ref('')
const data = ref<MeltdownAnalytics | null>(null)
const insightLoading = ref(false)
const insightText = ref('')
const insightError = ref('')
const insightModel = ref('')

/** 周趋势最大值 */
const weekMax = computed(() =>
  (data.value?.byWeek ?? []).reduce((m, w) => Math.max(m, w.count), 0),
)

/** 星期分布最大值 */
const weekdayMax = computed(() =>
  (data.value?.byWeekday ?? []).reduce((m, w) => Math.max(m, w.count), 0),
)

/** 午睡对照行 */
const nappedRows = computed(() => {
  if (!data.value) return []
  const n = data.value.byNapped
  return [
    { key: 'yes', label: '午睡了', count: n.nappedYes },
    { key: 'no', label: '没午睡', count: n.nappedNo },
    { key: 'unk', label: '未记录', count: n.nappedUnknown },
  ].filter((r) => r.count > 0)
})

/**
 * 拉取分析数据
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await fetchMeltdownAnalytics(days.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
    data.value = null
  } finally {
    loading.value = false
  }
}

watch(days, () => {
  void load()
  insightText.value = ''
  insightError.value = ''
})

/**
 * 用 DeepSeek + Mia 档案解读当前统计窗口
 */
async function runInsight() {
  insightLoading.value = true
  insightError.value = ''
  try {
    const res = await postAiInsight(days.value)
    insightText.value = res.reply
    insightModel.value = res.model
  } catch (e) {
    insightError.value = e instanceof Error ? e.message : '解读失败'
  } finally {
    insightLoading.value = false
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
        <h1 class="page__title">📊 分析</h1>
        <p class="page__desc">
          只看可观测事实的汇总。样本不足时不下结论。
        </p>
      </div>
      <div class="page__range" role="group" aria-label="统计区间">
        <button
          v-for="opt in dayOptions"
          :key="opt.value"
          type="button"
          class="mia-chip"
          :class="{ 'is-active': days === opt.value }"
          @click="days = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </header>

    <p v-if="loading" class="page__status">加载中…</p>
    <p v-else-if="error" class="page__status page__status--err">{{ error }}</p>

    <template v-else-if="data">
      <section
        class="mia-card notice"
        :class="data.canConclude ? 'notice--ok' : 'notice--warn'"
      >
        <p class="notice__text">
          <template v-if="data.canConclude">
            近 {{ data.days }} 天共
            <strong>{{ data.sampleSize }}</strong>
            条崩溃记录，可以看分布，仍请当作参考而非定论。
          </template>
          <template v-else>
            近 {{ data.days }} 天只有
            <strong>{{ data.sampleSize }}</strong>
            条崩溃记录（不足 5 条）。先多记几条，再下结论。
          </template>
        </p>
        <RouterLink
          v-if="!data.canConclude"
          class="mia-btn mia-btn--primary notice__cta"
          to="/record"
        >
          去记一条崩溃
        </RouterLink>
      </section>

      <section class="mia-card insight">
        <div class="insight__head">
          <h2 class="section-title">AI 解读（结合 Mia 档案）</h2>
          <div class="insight__actions">
            <button
              type="button"
              class="mia-btn mia-btn--honey"
              :disabled="insightLoading"
              @click="runInsight"
            >
              {{ insightLoading ? '解读中…' : '生成解读' }}
            </button>
            <RouterLink class="mia-btn" to="/consult">去咨询</RouterLink>
          </div>
        </div>
        <p v-if="insightError" class="page__status page__status--err">
          {{ insightError }}
        </p>
        <MiaMarkdown v-else-if="insightText" class="insight__body" :source="insightText" />
        <p v-else class="section-empty">
          会把近 {{ days }} 天统计 + 完整档案发给 DeepSeek，回答须依据档案「已验证清单」。
          <span v-if="insightModel">（上次模型：{{ insightModel }}）</span>
        </p>
      </section>

      <section class="overview">
        <div class="mia-card overview__card">
          <div class="overview__label">崩溃次数</div>
          <div class="overview__value">{{ data.sampleSize }}</div>
        </div>
        <div class="mia-card overview__card">
          <div class="overview__label">平均强度</div>
          <div class="overview__value">
            {{ data.avgIntensity ?? '—' }}
            <span v-if="data.avgIntensity != null" class="overview__unit"
              >/ 5</span
            >
          </div>
          <div class="overview__hint">
            {{ data.intensityCount }} 条有强度
          </div>
        </div>
        <div class="mia-card overview__card">
          <div class="overview__label">平均时长</div>
          <div class="overview__value">
            {{ data.avgDurationMin ?? '—' }}
            <span v-if="data.avgDurationMin != null" class="overview__unit"
              >分</span
            >
          </div>
          <div class="overview__hint">
            {{ data.durationCount }} 条有时长
          </div>
        </div>
      </section>

      <section class="mia-card">
        <h2 class="section-title">按周次数</h2>
        <p v-if="!data.byWeek.some((w) => w.count > 0)" class="section-empty">
          暂无数据
        </p>
        <div v-else class="week-list">
          <StatBar
            v-for="w in data.byWeek"
            :key="w.weekStart"
            :label="w.label"
            :value="w.count"
            :max="weekMax"
            color="var(--c-sky)"
          />
        </div>
      </section>

      <div class="grid">
        <RankCard
          title="高发时段"
          :items="data.byHour"
          color="var(--c-coral)"
          empty-text="还没有崩溃时间数据"
        />
        <section class="mia-card">
          <h2 class="section-title">按星期</h2>
          <p
            v-if="!data.byWeekday.some((w) => w.count > 0)"
            class="section-empty"
          >
            暂无数据
          </p>
          <div v-else class="week-list">
            <StatBar
              v-for="w in data.byWeekday"
              :key="w.key"
              :label="w.label"
              :value="w.count"
              :max="weekdayMax || 1"
              color="var(--c-honey)"
            />
          </div>
        </section>
        <RankCard
          title="高发场景（chips）"
          :items="data.byChip"
          color="var(--c-coral)"
          empty-text="还没有勾选场景 chip"
        />
        <RankCard
          title="触发原因"
          :items="data.byTrigger"
          color="var(--c-honey)"
        />
        <RankCard
          title="地点"
          :items="data.byLocation"
          color="var(--c-mint)"
        />
        <RankCard
          title="在场照护人"
          :items="data.byCaregiver"
          color="var(--c-grape)"
        />
        <RankCard
          title="试过的应对"
          :items="
            data.byCoping.map((c) => ({
              key: c.key,
              label: c.key,
              count: c.count,
            }))
          "
          color="var(--c-sky)"
          empty-text="还没有补填应对方式"
        />
        <RankCard
          title="当日是否午睡"
          :items="nappedRows"
          color="var(--c-mint)"
          empty-text="还没有勾选午睡字段"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page__hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
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

.page__range {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page__status {
  margin: 0;
  color: var(--c-ink-2);
}

.page__status--err {
  color: var(--c-coral);
  font-weight: 700;
}

.notice {
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.notice--warn {
  background: var(--c-honey-soft);
  border-color: var(--c-honey);
}

.notice--ok {
  background: var(--c-mint-soft);
  border-color: var(--c-mint);
}

.notice__text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--c-ink);
  flex: 1;
  min-width: 200px;
}

.notice__cta {
  flex-shrink: 0;
  text-decoration: none;
}

.insight__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.insight__head .section-title {
  margin: 0;
}

.insight__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.insight__actions .mia-btn {
  text-decoration: none;
}

.insight__body {
  margin: 0;
}

.overview {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 768px) {
  .overview {
    grid-template-columns: repeat(3, 1fr);
  }
}

.overview__card {
  padding: 16px;
}

.overview__label {
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
  font-weight: 700;
}

.overview__value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 800;
  color: var(--c-ink);
  line-height: 1.1;
}

@media (min-width: 768px) {
  .overview__value {
    font-size: 32px;
  }
}

.overview__unit {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink-2);
}

.overview__hint {
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}

.section-title {
  margin: 0 0 14px;
  font-size: var(--fs-lg);
}

.section-empty {
  margin: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.week-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
