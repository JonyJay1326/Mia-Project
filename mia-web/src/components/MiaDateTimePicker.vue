<script setup lang="ts">
import { computed } from 'vue'

/**
 * 糖果风日期时间：拆成日期 + 时间两个选择器
 * 避免 Element Plus datetime 内嵌时间面板被裁切、遮挡
 */
const props = withDefaults(
  defineProps<{
    /** 是否补录高亮 */
    backfill?: boolean
    /** 占位文案 */
    placeholder?: string
  }>(),
  {
    backfill: false,
    placeholder: '选择时间',
  },
)

/** 完整值：YYYY-MM-DDTHH:mm */
const model = defineModel<string>({ required: true })

/** 日期部分 YYYY-MM-DD */
const datePart = computed({
  get() {
    return model.value?.slice(0, 10) || ''
  },
  set(value: string) {
    const time = timePart.value || '12:00'
    if (!value) {
      return
    }
    model.value = `${value}T${time}`
  },
})

/** 时间部分 HH:mm */
const timePart = computed({
  get() {
    const raw = model.value?.slice(11, 16)
    return raw || ''
  },
  set(value: string) {
    const date = datePart.value || new Date().toISOString().slice(0, 10)
    if (!value) {
      return
    }
    model.value = `${date}T${value}`
  },
})

/** 仅用于满足模板引用 props.placeholder */
void props.placeholder
</script>

<template>
  <div class="mia-datetime-pair" :class="{ 'is-backfill': backfill }">
    <el-date-picker
      v-model="datePart"
      class="mia-datetime mia-datetime--date"
      type="date"
      format="YYYY/MM/DD"
      value-format="YYYY-MM-DD"
      placeholder="日期"
      :clearable="false"
      :editable="false"
      teleported
      placement="bottom"
      :show-arrow="false"
      popper-class="mia-datetime-popper"
    />
    <el-time-picker
      v-model="timePart"
      class="mia-datetime mia-datetime--time"
      format="HH:mm"
      value-format="HH:mm"
      placeholder="时间"
      :clearable="false"
      :editable="false"
      teleported
      placement="bottom"
      :show-arrow="false"
      popper-class="mia-time-popper"
    />
  </div>
</template>

<style scoped>
.mia-datetime-pair {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.mia-datetime-pair :deep(.mia-datetime--date) {
  width: 158px;
}

.mia-datetime-pair :deep(.mia-datetime--time) {
  width: 118px;
}
</style>
