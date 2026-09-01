<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  deletePhoto,
  fetchPhotos,
  photoAssetUrl,
  uploadPhoto,
} from '@/api/photos'
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  isVideoMime,
  type PhotoRecord,
} from '@/types/photo'
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

/** 客户端校验体积与类型 */
function validateFile(file: File): string | null {
  const mime = (file.type || '').toLowerCase()
  const isVideo = isVideoMime(mime)
  const isImage =
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/gif'
  if (!isVideo && !isImage) {
    return '仅支持图片或 MP4 / WebM 视频'
  }
  if (isVideo && file.size > VIDEO_MAX_BYTES) {
    return '视频不能超过 100MB'
  }
  if (isImage && file.size > IMAGE_MAX_BYTES) {
    return '图片不能超过 20MB'
  }
  return null
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
    const invalid = validateFile(file)
    if (invalid) {
      showToast(`${file.name}：${invalid}`)
      continue
    }
    try {
      await uploadPhoto(file)
      ok += 1
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : '上传失败'
      showToast(`${file.name}：${msg}`)
    }
  }
  uploading.value = false
  if (ok > 0) {
    showToast(`已上传 ${ok} 个`)
    await load(true)
  }
}

/** 打开大图 / 播放器 */
function openViewer(photo: PhotoRecord) {
  viewer.value = photo
}

/** 关闭查看器 */
function closeViewer() {
  viewer.value = null
}

/** 删除当前媒体 */
async function removeCurrent() {
  if (!viewer.value) {
    return
  }
  const isVideo = isVideoMime(viewer.value.mime)
  const ok = await confirm({
    title: isVideo ? '删除这段视频？' : '删除这张照片？',
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
          上传照片或短视频（MP4 / WebM，≤100MB）。拍摄时间与语录相差 30
          分钟内会自动配图。
        </p>
      </div>
      <button
        type="button"
        class="mia-btn mia-btn--primary"
        :disabled="uploading"
        @click="pickFiles"
      >
        {{ uploading ? '上传中…' : '上传' }}
      </button>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        multiple
        @change="onFilesSelected"
      />
    </header>

    <p v-if="error" class="page__status page__status--err">{{ error }}</p>
    <p v-else-if="loading && !items.length" class="page__status">加载中…</p>

    <div v-else-if="!items.length" class="mia-empty">
      <span class="mia-empty__emoji">🖼️</span>
      <p class="mia-empty__text">还没有照片或视频，先上传几个看看</p>
      <button type="button" class="mia-btn mia-btn--honey" @click="pickFiles">
        选文件
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
        <div class="tile__media">
          <img
            class="tile__img"
            :src="photoAssetUrl(photo.thumbUrl)"
            :alt="photo.originalName || '媒体'"
            loading="lazy"
          />
          <span
            v-if="isVideoMime(photo.mime)"
            class="tile__badge"
            aria-hidden="true"
          >
            ▶
          </span>
        </div>
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
      :aria-label="isVideoMime(viewer.mime) ? '播放视频' : '查看照片'"
      @click.self="closeViewer"
    >
      <div
        class="viewer__panel mia-card"
        :class="{ 'viewer__panel--video': isVideoMime(viewer.mime) }"
      >
        <div
          v-if="isVideoMime(viewer.mime)"
          class="viewer__stage viewer__stage--video"
        >
          <video
            class="viewer__video"
            controls
            playsinline
            preload="metadata"
            :src="photoAssetUrl(viewer.fileUrl)"
          />
        </div>
        <img
          v-else
          class="viewer__img"
          :src="photoAssetUrl(viewer.fileUrl)"
          :alt="viewer.originalName || '照片'"
        />
        <div class="viewer__bar">
          <div>
            <div class="viewer__title">
              {{ isVideoMime(viewer.mime) ? '🎬 ' : '' }}{{ shotLabel(viewer) }}
            </div>
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

.tile__media {
  position: relative;
}

.tile__img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  background: var(--c-cream-3);
}

.tile__badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2.5px solid #6b5a4e;
  background: var(--c-coral);
  color: #fffdf8;
  font-size: 14px;
  box-shadow: var(--shadow-sticker);
  line-height: 1;
  padding-left: 2px;
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

.viewer__panel--video {
  width: min(860px, 100%);
  background:
    radial-gradient(circle at 12% 18%, rgba(245, 196, 94, 0.28), transparent 42%),
    radial-gradient(circle at 88% 12%, rgba(169, 139, 196, 0.22), transparent 40%),
    var(--c-cream-2);
}

.viewer__stage--video {
  border: var(--stroke);
  border-radius: var(--r-lg);
  overflow: hidden;
  background: #4a3f38;
  box-shadow: var(--shadow-sticker);
}

.viewer__video {
  display: block;
  width: 100%;
  max-height: 68vh;
  background: #4a3f38;
  accent-color: var(--c-coral);
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
