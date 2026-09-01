<script setup lang="ts">
import { computed, watch } from 'vue'
import type { EventType } from '@/types/event'
import { CHIPS_BY_TYPE } from '@/config/chips'

const props = defineProps<{
  /** 当前事件类型，决定 chips 列表 */
  type: EventType
  /** 已选中的 chip 文案 */
  modelValue: string[]
  /** 是否允许多选，默认单选后写入 summary */
  multiple?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  /** 选中变化时同步给摘要框 */
  pick: [summary: string]
}>()

/** 当前类型可用 chips */
const options = computed(() => CHIPS_BY_TYPE[props.type] ?? [])

/**
 * 点击 chip：单选替换；多选切换
 */
function toggle(label: string) {
  if (props.multiple) {
    const set = new Set(props.modelValue)
    if (set.has(label)) {
      set.delete(label)
    } else {
      set.add(label)
    }
    const next = Array.from(set)
    emit('update:modelValue', next)
    emit('pick', next.join(' · '))
    return
  }

  emit('update:modelValue', [label])
  emit('pick', label)
}

/** 类型切换时清空已选（避免跨类型残留） */
watch(
  () => props.type,
  () => {
    emit('update:modelValue', [])
  },
)
</script>

<template>
  <div v-if="options.length" class="chip-group">
    <button
      v-for="label in options"
      :key="label"
      type="button"
      class="mia-chip"
      :class="{ 'is-active': modelValue.includes(label) }"
      @click="toggle(label)"
    >
      {{ label }}
    </button>
  </div>
  <p v-else class="chip-group__empty">这类没有预设短语，直接在下面写就好</p>
</template>

<style scoped>
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-group__empty {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
}
</style>
