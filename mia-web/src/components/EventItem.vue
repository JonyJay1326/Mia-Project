<script setup lang="ts">
import TypeChip from '@/components/TypeChip.vue'
import type { TimelineItem } from '@/utils/timeline'
import { formatTime, intensityDots } from '@/utils/timeline'
import { CAREGIVER_CHIPS, LOCATION_CHIPS, TRIGGER_CHIPS } from '@/config/chips'

defineProps<{
  item: TimelineItem
  active?: boolean
}>()

const emit = defineEmits<{
  select: []
}>()

/** 枚举值转中文标签 */
function labelOf(
  list: { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((x) => x.value === value)?.label ?? value ?? '—'
}
</script>

<template>
  <button
    type="button"
    class="mia-card event-item"
    :class="{ 'is-active': active }"
    @click="emit('select')"
  >
    <div class="event-item__head">
      <TypeChip :type="item.type" />
      <span class="event-item__time">{{ formatTime(item.at) }}</span>
      <span
        v-if="item.event?.intensity"
        class="event-item__dots"
        :title="`强度 ${item.event.intensity}`"
      >
        {{ intensityDots(item.event.intensity) }}
      </span>
      <span v-if="item.event?.durationMin" class="event-item__meta">
        {{ item.event.durationMin }}min
      </span>
    </div>

    <p class="event-item__title">
      <template v-if="item.kind === 'quote'">「{{ item.title }}」</template>
      <template v-else>{{ item.title }}</template>
    </p>

    <p v-if="item.event" class="event-item__sub desktop-only">
      照护：{{ labelOf(CAREGIVER_CHIPS, item.event.caregiver) }}
      · 地点：{{ labelOf(LOCATION_CHIPS, item.event.location) }}
      <template v-if="item.event.trigger">
        · 触发：{{ labelOf(TRIGGER_CHIPS, item.event.trigger) }}
      </template>
      · 午睡：{{
        item.event.napped === 1 ? '是' : item.event.napped === 0 ? '否' : '—'
      }}
    </p>
  </button>
</template>

<style scoped>
.event-item {
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}

.event-item.is-active {
  background: var(--c-cream-3);
  box-shadow: var(--shadow-pop);
}

.event-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.event-item__time {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.event-item__dots {
  letter-spacing: 1px;
  color: var(--c-coral);
  font-size: var(--fs-xs);
}

.event-item__meta {
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.event-item__title {
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--c-ink);
  line-height: 1.45;
}

.event-item__sub {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.desktop-only {
  display: none;
}

@media (min-width: 768px) {
  .desktop-only {
    display: block;
  }
}
</style>
