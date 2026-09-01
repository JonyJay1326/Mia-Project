<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 条目标签 */
    label: string
    /** 数值 */
    value: number
    /** 用于比例的最大值 */
    max: number
    /** 条颜色 token */
    color?: string
  }>(),
  {
    color: 'var(--c-coral)',
  },
)

/** 条宽百分比 */
const widthPct = computed(() => {
  if (props.max <= 0 || props.value <= 0) return 0
  return Math.max(8, Math.round((props.value / props.max) * 100))
})
</script>

<template>
  <div class="stat-bar" :title="`${label} · ${value}`">
    <div class="stat-bar__label">{{ label }}</div>
    <div class="stat-bar__track">
      <div
        class="stat-bar__fill"
        :style="{ width: `${widthPct}%`, background: color }"
      />
    </div>
    <div class="stat-bar__value">{{ value }}</div>
  </div>
</template>

<style scoped>
.stat-bar {
  display: grid;
  grid-template-columns: minmax(72px, 28%) 1fr auto;
  align-items: center;
  gap: 10px;
}

.stat-bar__label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-bar__track {
  height: 14px;
  border: var(--stroke-light);
  border-radius: var(--r-pill);
  background: var(--c-cream);
  overflow: hidden;
}

.stat-bar__fill {
  height: 100%;
  border-radius: var(--r-pill);
  min-width: 0;
  transition: width var(--dur) var(--ease-bounce);
}

.stat-bar__value {
  min-width: 1.5em;
  text-align: right;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}
</style>
