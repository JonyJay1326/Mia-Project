<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import MiaFormDialog from '@/components/MiaFormDialog.vue'
import { formatFetchError } from '@/api/client'
import {
  createSkill,
  deleteSkill,
  fetchSkills,
  markSkill,
  suggestSkillMeta,
  updateSkillNote,
} from '@/api/skills'
import {
  skillDomainLabel,
} from '@/config/skillDomains'
import type { SkillDomain, SkillDomainGroup, SkillItem, SkillStatus } from '@/types/skill'
import { useMiaConfirm } from '@/composables/useMiaConfirm'
import { formatMonthAge } from '@/utils/date'

const { confirm } = useMiaConfirm()

const loading = ref(false)
const error = ref('')
const groups = ref<SkillDomainGroup[]>([])
const toast = ref('')

/** 添加技能弹框 */
const addOpen = ref(false)
const addLabel = ref('')
const addSaving = ref(false)
const addSuggesting = ref(false)
const previewEmoji = ref('🌱')
const previewDomain = ref<SkillDomain>('other')
const previewLabel = ref('')

let suggestTimer = 0

/** 备注弹框 */
const noteOpen = ref(false)
const noteSaving = ref(false)
const noteTarget = ref<SkillItem | null>(null)
const noteDraft = ref('')

/** 打开备注弹框 */
function openNoteDialog(item: SkillItem) {
  noteTarget.value = item
  noteDraft.value = item.note ?? ''
  noteOpen.value = true
}

/** 关闭备注弹框 */
function closeNoteDialog() {
  if (noteSaving.value) {
    return
  }
  noteOpen.value = false
  noteTarget.value = null
  noteDraft.value = ''
}

/** 保存备注 */
async function saveNote() {
  const item = noteTarget.value
  if (!item || noteSaving.value) {
    return
  }
  noteSaving.value = true
  try {
    const trimmed = noteDraft.value.trim()
    const updated = await updateSkillNote(item.id, trimmed || null)
    patchItem(updated)
    noteOpen.value = false
    noteTarget.value = null
    noteDraft.value = ''
    showToast(trimmed ? '备注已保存' : '备注已清除')
  } catch (e) {
    showToast(formatFetchError(e))
  } finally {
    noteSaving.value = false
  }
}

/**
 * 删除自定义技能（二次确认）
 */
async function removeCustomSkill() {
  const item = noteTarget.value
  if (!item?.isCustom || noteSaving.value) {
    return
  }
  const ok = await confirm({
    title: '删除这条自定义技能？',
    message: `删除后不可恢复。\n\n${item.emoji} ${item.label}`,
    confirmText: '删除',
    cancelText: '再想想',
    danger: true,
  })
  if (!ok) {
    return
  }
  noteSaving.value = true
  try {
    await deleteSkill(item.id)
    removeItem(item.id)
    noteOpen.value = false
    noteTarget.value = null
    noteDraft.value = ''
    showToast('已删除')
  } catch (e) {
    showToast(formatFetchError(e))
  } finally {
    noteSaving.value = false
  }
}

/** 从本地列表移除技能 */
function removeItem(skillId: string) {
  for (const g of groups.value) {
    const idx = g.items.findIndex((i) => i.id === skillId)
    if (idx >= 0) {
      g.items.splice(idx, 1)
      g.total = g.items.length
      g.doneCount = g.items.filter((i) => i.status === 'done').length
      break
    }
  }
  groups.value = groups.value.filter((g) => g.total > 0)
}

/** 总进度 */
const progress = computed(() => {
  const total = groups.value.reduce((s, g) => s + g.total, 0)
  const done = groups.value.reduce((s, g) => s + g.doneCount, 0)
  return { total, done }
})

/** 预览领域文案 */
const previewDomainText = computed(() => skillDomainLabel(previewDomain.value))

/** 轻提示 */
function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 2600)
}

/** 加载地图 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    groups.value = await fetchSkills()
  } catch (e) {
    error.value = formatFetchError(e)
  } finally {
    loading.value = false
  }
}

/** 打开添加弹框 */
function openAddDialog() {
  addLabel.value = ''
  previewEmoji.value = '🌱'
  previewDomain.value = 'other'
  previewLabel.value = ''
  addOpen.value = true
}

/** 关闭添加弹框 */
function closeAddDialog() {
  if (addSaving.value) {
    return
  }
  addOpen.value = false
}

/**
 * 输入变化时 debounce 调用 AI 预览（仅展示，不写库）
 */
watch(addLabel, (text) => {
  window.clearTimeout(suggestTimer)
  const trimmed = text.trim()
  if (!trimmed) {
    previewEmoji.value = '🌱'
    previewDomain.value = 'other'
    previewLabel.value = ''
    return
  }
  suggestTimer = window.setTimeout(() => {
    void refreshPreview(trimmed)
  }, 450)
})

/** 刷新 AI 预览 */
async function refreshPreview(label: string) {
  addSuggesting.value = true
  try {
    const meta = await suggestSkillMeta(label)
    previewEmoji.value = meta.emoji
    previewDomain.value = meta.domain
    previewLabel.value = meta.label
  } catch {
    previewEmoji.value = '🌱'
    previewDomain.value = 'other'
    previewLabel.value = label.slice(0, 40)
  } finally {
    addSuggesting.value = false
  }
}

/** 确认添加自定义技能 */
async function confirmAdd() {
  const label = addLabel.value.trim()
  if (!label || addSaving.value) {
    return
  }
  addSaving.value = true
  try {
    const created = await createSkill({
      label,
      useAi: true,
      status: 'emerging',
      markedAt: new Date().toISOString(),
    })
    await load()
    addOpen.value = false
    showToast(
      `已加入 ${skillDomainLabel(created.domain)} ${created.emoji} ${created.label}`,
    )
  } catch (e) {
    showToast(formatFetchError(e))
  } finally {
    addSaving.value = false
  }
}

/**
 * 点击循环：未观察 → 刚出现 → 已掌握 → 未观察
 */
async function cycleStatus(item: SkillItem) {
  const next: SkillStatus =
    item.status === 'todo'
      ? 'emerging'
      : item.status === 'emerging'
        ? 'done'
        : 'todo'

  try {
    const updated = await markSkill(item.id, {
      status: next,
      markedAt: next === 'todo' ? undefined : new Date().toISOString(),
    })
    patchItem(updated)
    const label =
      next === 'done' ? '已掌握' : next === 'emerging' ? '刚出现' : '未观察'
    showToast(`${item.emoji} ${label}`)
  } catch (e) {
    showToast(formatFetchError(e))
  }
}

/** 用返回项替换本地列表中的技能 */
function patchItem(updated: SkillItem) {
  for (const g of groups.value) {
    const idx = g.items.findIndex((i) => i.id === updated.id)
    if (idx >= 0) {
      g.items[idx] = updated
      g.doneCount = g.items.filter((i) => i.status === 'done').length
      return
    }
  }
  void load()
}

/** 常见月龄提示文案 */
function typicalHint(item: SkillItem) {
  if (item.typicalFrom == null && item.typicalTo == null) return ''
  if (item.typicalFrom != null && item.typicalTo != null) {
    return `常见 ${item.typicalFrom}–${item.typicalTo} 月`
  }
  if (item.typicalFrom != null) return `常见 ${item.typicalFrom}+ 月`
  return `常见 ≤${item.typicalTo} 月`
}

/** 卡片第二行说明：已掌握显示标记月龄，未观察显示常见月龄，刚出现不显示 */
function skillMetaText(item: SkillItem): string {
  if (item.status === 'emerging') return ''
  if (item.status === 'done' && item.monthAgeWhenMarked != null) {
    return formatMonthAge(item.monthAgeWhenMarked)
  }
  return typicalHint(item)
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <div>
        <h1 class="page__title">🌱 技能地图</h1>
        <p class="page__desc">
          只记可观察行为。点一下切换：未观察 → 刚出现 → 已掌握。也可自己添加。
        </p>
      </div>
      <div class="page__hero-actions">
        <button type="button" class="mia-btn mia-btn--honey" @click="openAddDialog">
          ＋ 添加技能
        </button>
        <div v-if="progress.total" class="page__progress mia-card">
          <div class="page__progress-num">
            {{ progress.done }}
            <span>/ {{ progress.total }}</span>
          </div>
          <div class="page__progress-label">已掌握</div>
        </div>
      </div>
    </header>

    <p v-if="loading" class="page__status">加载中…</p>
    <p v-else-if="error" class="page__status page__status--err">{{ error }}</p>

    <section v-for="group in groups" :key="group.domain" class="domain">
      <h2 class="domain__title">
        <span>{{ group.emoji }} {{ group.label }}</span>
        <span class="domain__count"
          >{{ group.doneCount }}/{{ group.total }}</span
        >
      </h2>
      <div class="domain__grid">
        <div
          v-for="item in group.items"
          :key="item.id"
          class="skill"
          :class="[`skill--${item.status}`, { 'skill--has-note': item.note }]"
          role="button"
          tabindex="0"
          @click="cycleStatus(item)"
          @keydown.enter.prevent="cycleStatus(item)"
        >
          <span class="skill__emoji" aria-hidden="true">{{ item.emoji }}</span>
          <span class="skill__label">{{ item.label }}</span>
          <span class="skill__head-actions">
            <button
              type="button"
              class="skill__note-btn"
              :class="{ 'is-active': item.note }"
              title="备注"
              aria-label="编辑备注"
              @click.stop="openNoteDialog(item)"
            >
              📝
            </button>
            <span class="skill__badge">
              <template v-if="item.status === 'done'">已掌握</template>
              <template v-else-if="item.status === 'emerging'">刚出现</template>
              <template v-else>未观察</template>
            </span>
          </span>
          <span v-if="item.note" class="skill__note">{{ item.note }}</span>
          <span v-else-if="skillMetaText(item)" class="skill__meta">{{
            skillMetaText(item)
          }}</span>
        </div>
      </div>
    </section>

    <MiaFormDialog
      v-model:open="addOpen"
      title="添加技能"
      :emoji="previewEmoji"
      confirm-text="添加"
      :loading="addSaving"
      :confirm-disabled="!addLabel.trim()"
      @confirm="confirmAdd"
      @cancel="closeAddDialog"
    >
      <label class="add-field">
        <span class="add-field__label">可观察的行为</span>
        <input
          v-model="addLabel"
          class="mia-input"
          type="text"
          maxlength="80"
          placeholder="例如：会自己穿袜子"
          :disabled="addSaving"
        />
      </label>
      <p v-if="addLabel.trim()" class="add-preview">
        <template v-if="addSuggesting">识别中…</template>
        <template v-else>
          将归入
          <strong>{{ previewDomainText }}</strong>
          · {{ previewEmoji }}
          <span v-if="previewLabel && previewLabel !== addLabel.trim()">
            （{{ previewLabel }}）
          </span>
        </template>
      </p>
      <p class="add-hint">
        用 AI 自动选 emoji 和分类；无法归类时进「其他」。
      </p>
    </MiaFormDialog>

    <MiaFormDialog
      v-model:open="noteOpen"
      :title="noteTarget ? `${noteTarget.label} · 备注` : '备注'"
      :emoji="noteTarget?.emoji ?? '📝'"
      confirm-text="保存"
      :loading="noteSaving"
      @confirm="saveNote"
      @cancel="closeNoteDialog"
    >
      <label class="add-field">
        <span class="add-field__label">观察记录（选填，最多 200 字）</span>
        <textarea
          v-model="noteDraft"
          class="mia-input note-textarea"
          rows="4"
          maxlength="200"
          placeholder="例如：8 月在公园第一次自己穿"
          :disabled="noteSaving"
        />
      </label>
      <p v-if="noteTarget?.isCustom" class="note-delete">
        <button
          type="button"
          class="note-delete__btn"
          :disabled="noteSaving"
          @click="removeCustomSkill"
        >
          删除这条自定义技能
        </button>
      </p>
    </MiaFormDialog>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page__hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.page__hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.page__title {
  margin: 0 0 6px;
  font-size: var(--fs-title);
}

.page__desc {
  margin: 0;
  color: var(--c-ink-2);
  font-size: var(--fs-sm);
  max-width: 28em;
}

.page__progress {
  padding: 12px 16px;
  min-width: 96px;
  text-align: center;
  background: var(--c-mint-soft);
  border-color: var(--c-mint);
}

.page__progress-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--c-ink);
}

.page__progress-num span {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink-2);
}

.page__progress-label {
  margin-top: 4px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-ink-2);
}

.page__status {
  margin: 0;
  color: var(--c-ink-2);
}

.page__status--err {
  color: var(--c-coral);
  font-weight: 700;
}

.domain__title {
  margin: 0 0 12px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-lg);
}

.domain__count {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-ink-2);
}

.domain__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: stretch;
}

@media (min-width: 768px) {
  .domain__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.skill {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 4px;
  align-items: start;
  height: 100%;
  padding: 12px 14px;
  border: var(--stroke);
  border-radius: var(--r-lg);
  background: var(--c-cream-2);
  box-shadow: var(--shadow-sticker);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--c-ink);
  transition:
    transform var(--dur) var(--ease-bounce),
    box-shadow var(--dur) var(--ease-bounce),
    background var(--dur) var(--ease-soft);
}

.skill--has-note {
  border-style: dashed;
}

.skill:hover {
  transform: translate(-1px, -2px);
  box-shadow: var(--shadow-pop);
}

.skill:active {
  transform: scale(0.98);
}

.skill--done {
  background: var(--c-mint-soft);
  border-color: var(--c-mint);
}

.skill--emerging {
  background: var(--c-honey-soft);
  border-color: var(--c-honey);
}

.skill--todo {
  opacity: 0.92;
}

.skill__emoji {
  grid-row: 1 / span 2;
  font-size: 28px;
  line-height: 1;
}

.skill__label {
  font-weight: 700;
  font-size: var(--fs-base);
  line-height: 1.3;
}

.skill__badge {
  padding: 2px 10px;
  border: 2px solid var(--stroke-color);
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 800;
  background: var(--c-cream);
  white-space: nowrap;
}

.skill__head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  align-self: start;
}

.skill__note-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid var(--stroke-color);
  border-radius: var(--r-pill);
  background: var(--c-cream);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.72;
  transition:
    transform var(--dur) var(--ease-bounce),
    opacity var(--dur) var(--ease-soft);
}

.skill__note-btn:hover,
.skill__note-btn.is-active {
  opacity: 1;
  transform: translateY(-1px);
}

.skill__note-btn.is-active {
  background: var(--c-honey-soft);
  border-color: var(--c-honey);
}

.skill--done .skill__badge {
  background: var(--c-mint);
  color: #fff;
  border-color: var(--stroke-color);
}

.skill--emerging .skill__badge {
  background: var(--c-honey);
}

.skill__meta {
  grid-column: 2;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
  line-height: 1.25;
}

.skill__note {
  grid-column: 2;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 80;
  padding: 10px 18px;
  border: var(--stroke);
  border-radius: var(--r-pill);
  background: var(--c-honey);
  color: var(--c-ink);
  font-weight: 700;
  box-shadow: var(--shadow-sticker);
  max-width: min(92vw, 420px);
  text-align: center;
}

.add-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-field__label {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.add-preview {
  margin: 10px 0 0;
  font-size: var(--fs-sm);
  color: var(--c-ink);
  line-height: 1.5;
}

.add-hint {
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--c-ink-3);
  line-height: 1.45;
}

.note-textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.45;
}

.note-delete {
  margin: 14px 0 0;
  text-align: center;
}

.note-delete__btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--c-coral);
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.note-delete__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
