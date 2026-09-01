<script setup lang="ts">
import { computed } from 'vue'
import type { TimelineItemType } from '@/types/event'
import { getTypeChipStyle } from '@/utils/typeChip'

const props = withDefaults(
  defineProps<{
    /** 事件 / 语录类型 */
    type: TimelineItemType
    /** 是否只显示图标 */
    iconOnly?: boolean
  }>(),
  { iconOnly: false },
)

/** 当前类型的视觉配置 */
const style = computed(() => getTypeChipStyle(props.type))
</script>

<template>
  <span
    class="type-chip"
    :style="{ background: style.bg, color: style.color, borderColor: style.color }"
  >
    <span class="type-chip__icon" aria-hidden="true">{{ style.icon }}</span>
    <span v-if="!iconOnly" class="type-chip__label">{{ style.label }}</span>
  </span>
</template>

<style scoped>
.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--r-pill);
  border: 2px solid;
  font-size: var(--fs-xs);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.type-chip__icon {
  font-size: var(--fs-sm);
  line-height: 1;
}

.type-chip__label {
  color: var(--c-ink);
}
</style>
