<script setup lang="ts">
import { computed } from 'vue'
import StatBar from './StatBar.vue'

export interface RankRow {
  key: string
  label: string
  count: number
}

const props = withDefaults(
  defineProps<{
    title: string
    items: RankRow[]
    emptyText?: string
    color?: string
    /** 最多展示条数 */
    limit?: number
  }>(),
  {
    emptyText: '暂无数据',
    color: 'var(--c-coral)',
    limit: 8,
  },
)

/** 截断后的列表 */
const rows = computed(() => props.items.slice(0, props.limit))

/** 条形图最大值 */
const maxCount = computed(() =>
  rows.value.reduce((m, row) => Math.max(m, row.count), 0),
)
</script>

<template>
  <section class="mia-card rank-card">
    <h2 class="rank-card__title">{{ title }}</h2>
    <p v-if="!rows.length" class="rank-card__empty">{{ emptyText }}</p>
    <div v-else class="rank-card__list">
      <StatBar
        v-for="row in rows"
        :key="row.key"
        :label="row.label"
        :value="row.count"
        :max="maxCount"
        :color="color"
      />
    </div>
  </section>
</template>

<style scoped>
.rank-card__title {
  margin: 0 0 14px;
  font-size: var(--fs-lg);
  color: var(--c-ink);
}

.rank-card__empty {
  margin: 0;
  color: var(--c-ink-3);
  font-size: var(--fs-sm);
}

.rank-card__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
