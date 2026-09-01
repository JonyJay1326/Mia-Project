<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { suggestSceneEmoji } from '@/api/ai'
import { useMiaConfirm } from '@/composables/useMiaConfirm'
import type { Scene } from '@/config/scenes'
import {
  DEFAULT_SCENES,
  loadSceneOrderIds,
  loadScenes,
  saveScenes,
  sortScenesForDisplay,
} from '@/config/scenes'

const emit = defineEmits<{
  /** 选中某张场景卡片 */
  select: [scene: Scene]
  /** 场景被删除（供父级清选中态） */
  removed: [id: string]
}>()

const { confirm } = useMiaConfirm()

const props = defineProps<{
  /** 当前选中的场景 id */
  activeId?: string | null
}>()

const scenes = ref<Scene[]>([])
const orderIds = ref<string[] | null>(null)
const editing = ref(false)
const dragFrom = ref<number | null>(null)

/** 展示用排序后的列表 */
const displayScenes = computed(() =>
  sortScenesForDisplay(scenes.value, orderIds.value),
)

/** 新增场景名称 */
const draftLabel = ref('')
/** AI 预览 emoji */
const previewEmoji = ref('⭐')
/** 正在识别 emoji */
const emojiSuggesting = ref(false)
/** 正在添加场景 */
const adding = ref(false)
/** 已成功识别过的原文 */
const lastPreviewKey = ref('')

let suggestTimer = 0

/** 初始化：读本地配置 */
onMounted(() => {
  scenes.value = loadScenes()
  orderIds.value = loadSceneOrderIds()
})

/** 持久化当前场景与顺序 */
function persist() {
  saveScenes(scenes.value, orderIds.value ?? undefined)
}

/** 点击选中场景 */
function onSelect(scene: Scene) {
  if (editing.value) {
    return
  }
  emit('select', scene)
}

/** 开始拖拽 */
function onDragStart(index: number) {
  dragFrom.value = index
}

/** 放置后重排并记住手动顺序 */
function onDrop(index: number) {
  if (dragFrom.value === null || dragFrom.value === index) {
    dragFrom.value = null
    return
  }
  const list = [...displayScenes.value]
  const [moved] = list.splice(dragFrom.value, 1)
  list.splice(index, 0, moved)
  orderIds.value = list.map((s) => s.id)
  persist()
  dragFrom.value = null
}

/** 删除场景卡片（二次确认） */
async function requestRemoveScene(scene: Scene) {
  const ok = await confirm({
    title: '删除这张场景卡片？',
    message: scene.custom
      ? `删除后不可恢复。\n\n${scene.icon} ${scene.label}`
      : `这是内置场景，删除后可通过「恢复默认」找回。\n\n${scene.icon} ${scene.label}`,
    confirmText: '删除',
    cancelText: '再想想',
    danger: true,
  })
  if (!ok) {
    return
  }
  removeScene(scene.id)
  emit('removed', scene.id)
}

/** 从列表移除场景 */
function removeScene(id: string) {
  scenes.value = scenes.value.filter((s) => s.id !== id)
  if (orderIds.value) {
    orderIds.value = orderIds.value.filter((x) => x !== id)
  }
  persist()
}

/**
 * 输入变化时 debounce 调用 AI 预览 emoji
 */
watch(draftLabel, (text) => {
  window.clearTimeout(suggestTimer)
  const trimmed = text.trim()
  if (!trimmed) {
    previewEmoji.value = '⭐'
    lastPreviewKey.value = ''
    return
  }
  suggestTimer = window.setTimeout(() => {
    void refreshEmojiPreview(trimmed)
  }, 450)
})

/** 刷新 AI emoji 预览 */
async function refreshEmojiPreview(label: string) {
  emojiSuggesting.value = true
  try {
    const meta = await suggestSceneEmoji(label)
    previewEmoji.value = meta.emoji
    lastPreviewKey.value = label
  } catch {
    previewEmoji.value = '⭐'
    lastPreviewKey.value = ''
  } finally {
    emojiSuggesting.value = false
  }
}

/**
 * 解析最终 emoji：优先用已预览结果，否则即时请求
 */
async function resolveEmoji(label: string): Promise<string> {
  if (lastPreviewKey.value === label && previewEmoji.value) {
    return previewEmoji.value
  }
  try {
    const meta = await suggestSceneEmoji(label)
    return meta.emoji
  } catch {
    return '⭐'
  }
}

/** 新增一张自定义场景卡片 */
async function addScene() {
  const label = draftLabel.value.trim()
  if (!label || adding.value) {
    return
  }
  adding.value = true
  try {
    const icon = await resolveEmoji(label)
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`
    const scene: Scene = {
      id,
      label,
      icon,
      preset: { type: 'question' },
      order: scenes.value.length + 1,
      count: 0,
      custom: true,
    }
    scenes.value = [...scenes.value, scene]
    if (orderIds.value) {
      orderIds.value = [...orderIds.value, id]
    }
    draftLabel.value = ''
    previewEmoji.value = '⭐'
    lastPreviewKey.value = ''
    persist()
  } finally {
    adding.value = false
  }
}

/** 使用次数 +1（保存成功后由父组件调用） */
function bumpCount(id: string) {
  scenes.value = scenes.value.map((s) =>
    s.id === id ? { ...s, count: s.count + 1 } : s,
  )
  persist()
}

/** 恢复默认 8 张 */
function resetDefaults() {
  scenes.value = structuredClone(DEFAULT_SCENES)
  orderIds.value = null
  persist()
}

defineExpose({ bumpCount })
</script>

<template>
  <div class="scene-cards">
    <div class="scene-cards__toolbar">
      <button type="button" class="mia-btn" @click="editing = !editing">
        {{ editing ? '完成编辑' : '编辑卡片' }}
      </button>
      <button
        v-if="editing"
        type="button"
        class="mia-btn"
        @click="resetDefaults"
      >
        恢复默认
      </button>
    </div>

    <div class="scene-grid">
      <button
        v-for="(scene, index) in displayScenes"
        :key="scene.id"
        type="button"
        class="mia-card scene-card"
        :class="{
          'is-active': props.activeId === scene.id,
          'scene-card--editing': editing,
        }"
        :draggable="editing"
        @click="onSelect(scene)"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
      >
        <span class="scene-card__emoji">{{ scene.icon }}</span>
        <span class="scene-card__label">{{ scene.label }}</span>
        <span v-if="scene.count > 0" class="scene-card__count">{{ scene.count }}</span>
        <button
          v-if="editing"
          type="button"
          class="scene-card__remove"
          aria-label="删除"
          @click.stop="requestRemoveScene(scene)"
        >
          <svg
            class="scene-card__remove-icon"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="M2 2 L10 10 M10 2 L2 10"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </button>
    </div>

    <div v-if="editing" class="scene-cards__add mia-card">
      <span class="scene-cards__preview-emoji" aria-hidden="true">
        {{ emojiSuggesting ? '…' : previewEmoji }}
      </span>
      <input
        v-model="draftLabel"
        class="mia-input scene-cards__label-input"
        placeholder="新场景名称"
        :disabled="adding"
        @keydown.enter="addScene"
      />
      <button
        type="button"
        class="mia-btn mia-btn--primary"
        :disabled="!draftLabel.trim() || adding"
        @click="addScene"
      >
        {{ adding ? '添加中…' : '添加' }}
      </button>
    </div>
    <p v-if="editing" class="scene-cards__hint">
      emoji 由 AI 自动选择，无法手动修改
    </p>
  </div>
</template>

<style scoped>
.scene-cards__toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.scene-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 768px) {
  .scene-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.scene-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  cursor: pointer;
  font: inherit;
  color: inherit;
  min-height: 96px;
}

.scene-card__emoji {
  font-size: 32px;
  line-height: 1;
}

.scene-card__label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.scene-card__count {
  position: absolute;
  top: 6px;
  right: 8px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--stroke-color);
  border-radius: var(--r-pill);
  background: var(--c-honey);
  color: var(--c-ink);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 1.5px 1.5px 0 #e0cdb8;
  transition:
    left var(--dur) var(--ease-soft),
    right var(--dur) var(--ease-soft);
}

/** 编辑态：计数角标让位给右上角删除钮 */
.scene-card--editing .scene-card__count {
  right: auto;
  left: 8px;
}

.scene-card.is-active {
  transform: scale(1.06) rotate(-1deg);
  box-shadow: var(--shadow-pop);
  background: var(--c-coral-soft);
}

.scene-card__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid var(--stroke-color);
  border-radius: var(--r-pill);
  background: var(--c-coral-soft);
  color: var(--c-coral);
  cursor: pointer;
  box-shadow: 1px 1px 0 rgba(61, 47, 38, 0.1);
  transition:
    transform var(--dur) var(--ease-bounce),
    background var(--dur) var(--ease-soft),
    color var(--dur) var(--ease-soft),
    box-shadow var(--dur) var(--ease-soft);
  animation: sceneRemovePop 0.34s var(--ease-bounce) both;
}

.scene-card__remove:hover {
  transform: scale(1.12) rotate(90deg);
  background: var(--c-coral);
  color: #fff;
  box-shadow: 1.5px 1.5px 0 rgba(61, 47, 38, 0.14);
}

.scene-card__remove:active {
  transform: scale(0.92) rotate(90deg);
  box-shadow: 0.5px 0.5px 0 rgba(61, 47, 38, 0.1);
}

.scene-card__remove-icon {
  display: block;
  flex-shrink: 0;
  pointer-events: none;
}

@keyframes sceneRemovePop {
  from {
    opacity: 0;
    transform: scale(0.45) rotate(-40deg);
  }

  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.scene-cards__add {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 14px;
}

.scene-cards__preview-emoji {
  width: 40px;
  font-size: 28px;
  line-height: 1;
  text-align: center;
  flex: 0 0 auto;
}

.scene-cards__label-input {
  flex: 1 1 160px;
  min-width: 0;
}

.scene-cards__hint {
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
}
</style>
