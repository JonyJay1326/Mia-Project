<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  fetchPhoto,
  photoAssetUrl,
  uploadPhoto,
} from '@/api/photos'
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  isVideoMime,
  type PhotoRecord,
} from '@/types/photo'

const photoId = defineModel<string | null>('photoId', { default: null })

const uploading = ref(false)
const error = ref('')
const media = ref<PhotoRecord | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

/** 按 id 拉取预览元数据 */
async function loadMedia(id: string | null | undefined) {
  if (!id) {
    media.value = null
    return
  }
  try {
    media.value = await fetchPhoto(id)
    error.value = ''
  } catch (e) {
    media.value = null
    error.value = e instanceof Error ? e.message : '无法加载媒体'
  }
}

watch(
  photoId,
  (id) => {
    void loadMedia(id)
  },
  { immediate: true },
)

/** 打开系统文件选择 */
function pickFile() {
  fileInput.value?.click()
}

/** 校验后上传并写回 photoId */
async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  const mime = (file.type || '').toLowerCase()
  const isVideo = isVideoMime(mime)
  const isImage =
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    mime === 'image/gif'
  if (!isVideo && !isImage) {
    error.value = '仅支持图片或 MP4 / WebM'
    return
  }
  if (isVideo && file.size > VIDEO_MAX_BYTES) {
    error.value = '视频不能超过 100MB'
    return
  }
  if (isImage && file.size > IMAGE_MAX_BYTES) {
    error.value = '图片不能超过 20MB'
    return
  }

  uploading.value = true
  error.value = ''
  try {
    const created = await uploadPhoto(file)
    photoId.value = created.id
    media.value = created
  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

/** 仅解除关联，不删相册文件 */
function clearAttach() {
  photoId.value = null
  media.value = null
  error.value = ''
}
</script>

<template>
  <div class="media-attach">
    <div class="media-attach__label-row">
      <span class="media-attach__label">照片 / 视频</span>
      <span class="media-attach__hint">可选 · 视频 ≤100MB</span>
    </div>

    <div v-if="media" class="media-attach__preview mia-card">
      <div class="media-attach__thumb-wrap">
        <img
          class="media-attach__thumb"
          :src="photoAssetUrl(media.thumbUrl)"
          :alt="media.originalName || '附件'"
        />
        <span
          v-if="isVideoMime(media.mime)"
          class="media-attach__play"
          aria-hidden="true"
        >
          ▶
        </span>
      </div>
      <div class="media-attach__meta">
        <p class="media-attach__name">
          {{ isVideoMime(media.mime) ? '视频' : '照片' }}
          <template v-if="media.originalName">
            · {{ media.originalName }}
          </template>
        </p>
        <div class="media-attach__actions">
          <button
            type="button"
            class="mia-btn"
            :disabled="uploading"
            @click="pickFile"
          >
            更换
          </button>
          <button
            type="button"
            class="mia-btn"
            :disabled="uploading"
            @click="clearAttach"
          >
            移除
          </button>
        </div>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="mia-btn media-attach__pick"
      :disabled="uploading"
      @click="pickFile"
    >
      {{ uploading ? '上传中…' : '📷 上传照片 / 视频' }}
    </button>

    <p v-if="error" class="media-attach__err">{{ error }}</p>

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
      @change="onFileSelected"
    />
  </div>
</template>

<style scoped>
.media-attach {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.media-attach__label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.media-attach__label {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink-2);
}

.media-attach__hint {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-ink-2);
  opacity: 0.78;
}

.media-attach__pick {
  align-self: flex-start;
}

.media-attach__preview {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
}

.media-attach__thumb-wrap {
  position: relative;
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: var(--r-md);
  overflow: hidden;
  border: var(--stroke-light);
  background: var(--c-cream-3);
}

.media-attach__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-attach__play {
  position: absolute;
  inset: auto 6px 6px auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid #6b5a4e;
  background: var(--c-coral);
  color: #fffdf8;
  font-size: 11px;
  padding-left: 2px;
  box-shadow: var(--shadow-sticker);
}

.media-attach__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-attach__name {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--c-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-attach__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.media-attach__err {
  margin: 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--c-coral);
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
</style>
