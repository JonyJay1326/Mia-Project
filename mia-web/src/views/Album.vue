<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  deletePhoto,
  fetchPhotos,
  photoAssetUrl,
  uploadPhoto,
} from '@/api/photos'
import type { PhotoRecord } from '@/types/photo'
import { useMiaConfirm } from '@/composables/useMiaConfirm'
import { formatMonthAge } from '@/utils/date'
import { dayKey } from '@/utils/timeline'

const { confirm } = useMiaConfirm()
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const toast = ref('')
const items = ref<PhotoRecord[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const viewer = ref<PhotoRecord | null>(null)

/** 轻提示 */
function showToast(msg: string) {
  toast.value = msg
  window.setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 2200)
}

/** 加载相册 */
async function load(reset = true) {
  loading.value = true
  error.value = ''
  try {
    const before = reset
      ? undefined
      : items.value[items.value.length - 1]?.takenAt
    const batch = await fetchPhotos({ limit: 48, before })
    items.value = reset ? batch : [...items.value, ...batch]
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/** 触发文件选择 */
function pickFiles() {
  fileInput.value?.click()
}

/** 处理选中的文件（可多选） */
async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return

  uploading.value = true
  let ok = 0
  for (const file of files) {
    try {
      await uploadPhoto(file)
      ok += 1
    } catch (err) {
      console.error(err)
      showToast(`${file.name} 上传失败`)
    }
  }
  uploading.value = false
  if (ok > 0) {
    showToast(`已上传 ${ok} 张`)
    await load(true)
  }
}

/** 打开大图 */
function openViewer(photo: PhotoRecord) {
  viewer.value = photo
}

/** 关闭大图 */
function closeViewer() {
  viewer.value = null
}

/** 删除当前大图 */
async function removeCurrent() {
  if (!viewer.value) {
    return
  }
  const ok = await confirm({
    title: '删除这张照片？',
    message: '删除后不可恢复。',
    confirmText: '删除',
    cancelText: '再想想',
    danger: true,
  })
  if (!ok) {
    return
  }
  const id = viewer.value.id
  try {
    await deletePhoto(id)
    items.value = items.value.filter((p) => p.id !== id)
    viewer.value = null
    showToast('已删除')
  } catch {
    showToast('删除失败')
  }
}

/** 拍摄日短显 */
function shotLabel(photo: PhotoRecord) {
  return dayKey(photo.takenAt)
}

onMounted(() => {
  void load(true)
})
</script>

<template>
  <div class="page">
    <header class="page__hero">
      <div>
        <h1 class="page__title">📷 相册</h1>
        <p class="page__desc">
          上传照片；拍摄时间与语录相差 30 分钟内会自动配图。
        </p>
      </div>
      <button
        type="button"
        class="mia-btn mia-btn--primary"
        :disabled="uploading"
        @click="pickFiles"
      >
        {{ uploading ? '上传中…' : '上传照片' }}
      </button>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        @change="onFilesSelected"
      />
    </header>

    <p v-if="error" class="page__status page__status--err">{{ error }}</p>
    <p v-else-if="loading && !items.length" class="page__status">加载中…</p>

    <div v-else-if="!items.length" class="mia-empty">
      <span class="mia-empty__emoji">🖼️</span>
      <p class="mia-empty__text">还没有照片，先上传几张看看</p>
      <button type="button" class="mia-btn mia-btn--honey" @click="pickFiles">
        选照片
      </button>
    </div>

    <div v-else class="grid">
      <button
        v-for="photo in items"
        :key="photo.id"
        type="button"
        class="mia-card tile"
        @click="openViewer(photo)"
      >
        <img
          class="tile__img"
          :src="photoAssetUrl(photo.thumbUrl)"
          :alt="photo.originalName || '照片'"
          loading="lazy"
        />
        <div class="tile__meta">
          <span>{{ shotLabel(photo) }}</span>
          <span v-if="photo.monthAge != null">{{
            formatMonthAge(photo.monthAge)
          }}</span>
        </div>
      </button>
    </div>

    <div v-if="items.length" class="more">
      <button
        type="button"
        class="mia-btn"
        :disabled="loading"
        @click="load(false)"
      >
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </div>

    <div
      v-if="viewer"
      class="viewer"
      role="dialog"
      aria-label="查看照片"
      @click.self="closeViewer"
    >
      <div class="viewer__panel mia-card">
        <img
          class="viewer__img"
          :src="photoAssetUrl(viewer.fileUrl)"
          :alt="viewer.originalName || '照片'"
        />
        <div class="viewer__bar">
          <div>
            <div class="viewer__title">{{ shotLabel(viewer) }}</div>
            <div v-if="viewer.monthAge != null" class="viewer__sub">
              {{ formatMonthAge(viewer.monthAge) }}
            </div>
          </div>
          <div class="viewer__actions">
            <button type="button" class="mia-btn" @click="closeViewer">
              关闭
            </button>
            <button
              type="button"
              class="mia-btn mia-btn--primary"
              @click="removeCurrent"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

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

.page__status {
  margin: 0;
  color: var(--c-ink-2);
}

.page__status--err {
  color: var(--c-coral);
  font-weight: 700;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.tile {
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.tile__img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--c-cream-3);
}

.tile__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 10px;
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
  font-weight: 600;
}

.more {
  display: flex;
  justify-content: center;
}

.viewer {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(74, 63, 56, 0.45);
}

.viewer__panel {
  width: min(720px, 100%);
  max-height: 92vh;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.viewer__img {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--r-md);
  background: var(--c-cream);
}

.viewer__bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.viewer__title {
  font-weight: 800;
  font-size: var(--fs-md);
}

.viewer__sub {
  font-size: var(--fs-xs);
  color: var(--c-ink-2);
}

.viewer__actions {
  display: flex;
  gap: 8px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 130;
  padding: 10px 18px;
  border: var(--stroke);
  border-radius: var(--r-pill);
  background: var(--c-honey);
  color: var(--c-ink);
  font-weight: 700;
  box-shadow: var(--shadow-sticker);
}
</style>
