<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpriteState } from '@/composables/useSpriteState'
import timeline from '@/assets/sprite/sprite-timeline.json'
import videoSrc from '@/assets/sprite/blanket_loop_12s_v3.mp4'
import { keyOutStudioBg, opaqueBounds } from '@/utils/canvasChromaKey'

const props = defineProps<{
  /** 当前定格状态 */
  state: SpriteState
  /** 是否正在切态播放 */
  playing: boolean
  /** 切态目标 */
  targetState: SpriteState | null
  /** 页恢复后递增：静默对齐画面，避免闪到第 0 帧 */
  paintEpoch?: number
  /** 鼠标悬浮 */
  hovered?: boolean
}>()

const emit = defineEmits<{
  playEnd: []
}>()

const keys = timeline.keys as Record<SpriteState, number>
const displayW = timeline.displayWidth ?? 320
/** 切态播放倍速（默认 2 = 加快一倍） */
const playRate =
  typeof (timeline as { playbackRate?: number }).playbackRate === 'number'
    ? (timeline as { playbackRate: number }).playbackRate
    : 2

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
/** CSS 显示高度（按裁切后毯子比例） */
const displayH = ref(Math.round(displayW * 0.55))

let rafId = 0
/** fold→idle 用淡入 */
const fading = ref(false)
/** 高分辨率离屏画布：先画视频再抠像 */
let workCanvas: HTMLCanvasElement | null = null
let workCtx: CanvasRenderingContext2D | null = null

/** 状态 → 视频时刻（秒） */
function timeOf(s: SpriteState): number {
  return keys[s] ?? 0
}

/** 设备像素比（上限 2，避免过重） */
function deviceScale() {
  return Math.min(window.devicePixelRatio || 1, 2)
}

/**
 * 准备离屏工作画布
 */
function ensureWork(w: number, h: number) {
  if (!workCanvas) {
    workCanvas = document.createElement('canvas')
  }
  if (workCanvas.width !== w || workCanvas.height !== h) {
    workCanvas.width = w
    workCanvas.height = h
    workCtx = workCanvas.getContext('2d', { willReadFrequently: true })
  }
  return workCtx
}

/**
 * 高清绘制：原片放大采样 → 抠像 → 按内容裁切铺满显示画布（Retina）
 */
function paintFrame() {
  const video = videoRef.value
  const canvas = canvasRef.value
  if (!video || !canvas || video.readyState < 2) {
    return
  }
  const vw = video.videoWidth || 1280
  const vh = video.videoHeight || 720
  const dpr = deviceScale()
  // 工作分辨率：约显示宽的 2×dpr，且不超过源视频宽
  const workW = Math.min(vw, Math.round(displayW * dpr * 2))
  const workH = Math.max(1, Math.round((workW * vh) / vw))
  const wctx = ensureWork(workW, workH)
  if (!wctx || !workCanvas) {
    return
  }

  wctx.imageSmoothingEnabled = true
  wctx.imageSmoothingQuality = 'high'
  wctx.clearRect(0, 0, workW, workH)
  wctx.drawImage(video, 0, 0, workW, workH)
  const imageData = wctx.getImageData(0, 0, workW, workH)
  keyOutStudioBg(imageData)
  wctx.putImageData(imageData, 0, 0)

  const box = opaqueBounds(imageData)
  // 显示区高度：按毯子内容比例，限制在合理范围
  let cssH = Math.round(displayW * 0.55)
  if (box) {
    cssH = Math.max(
      Math.round(displayW * 0.42),
      Math.min(Math.round(displayW * 0.72), Math.round((displayW * box.h) / box.w)),
    )
  }
  displayH.value = cssH

  const bufW = Math.round(displayW * dpr)
  const bufH = Math.round(cssH * dpr)
  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW
    canvas.height = bufH
  }
  canvas.style.width = `${displayW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, bufW, bufH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (!box) {
    return
  }
  // 水平铺满、底部对齐（略留 2% 边）
  const fitPad = bufW * 0.02
  const destW = bufW - fitPad * 2
  const destH = (destW * box.h) / box.w
  const dx = fitPad
  const dy = Math.max(0, bufH - destH)
  ctx.drawImage(
    workCanvas,
    box.x,
    box.y,
    box.w,
    box.h,
    dx,
    dy,
    destW,
    Math.min(destH, bufH),
  )
}

/** 停止 rAF */
function stopPlaybackLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

/**
 * 播放循环：每帧绘制 + 检测是否到达终点
 */
function startPlaybackLoop(endTime: number) {
  stopPlaybackLoop()
  const tick = () => {
    paintFrame()
    const video = videoRef.value
    if (video && !video.paused && video.currentTime >= endTime - 0.04) {
      video.pause()
      video.playbackRate = 1
      video.currentTime = endTime
      paintFrame()
      stopPlaybackLoop()
      emit('playEnd')
      return
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

/**
 * seek 到指定时刻并画一帧；seek 过程中不 paint，避免闪到第 0 帧
 */
async function seekAndPaint(sec: number) {
  const video = videoRef.value
  if (!video) {
    return
  }
  const target = Math.max(0, Math.min(sec, (video.duration || timeline.durationSec) - 0.05))
  if (Math.abs(video.currentTime - target) < 0.05 && video.readyState >= 2) {
    paintFrame()
    return
  }
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = target
    // 已在目标附近时某些浏览器不触发 seeked
    window.setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }, 120)
  })
  paintFrame()
}

/**
 * 切态：从当前态播到目标态；fold→idle 直接回 0 并淡入
 */
watch(
  () => [props.playing, props.targetState, props.state, ready.value] as const,
  async ([playing, target, state, isReady]) => {
    const video = videoRef.value
    if (!video || !isReady) {
      return
    }
    if (!playing || !target) {
      stopPlaybackLoop()
      video.pause()
      video.playbackRate = 1
      await seekAndPaint(timeOf(state))
      return
    }

    // fold → idle：不倒放，seek 到开头 + 短淡入
    if (state === 'fold' && target === 'idle') {
      stopPlaybackLoop()
      video.pause()
      video.playbackRate = 1
      fading.value = true
      await seekAndPaint(timeOf('idle'))
      window.setTimeout(() => {
        fading.value = false
        emit('playEnd')
      }, 280)
      return
    }

    const from = timeOf(state)
    const to = timeOf(target)
    await seekAndPaint(from)
    video.playbackRate = playRate
    try {
      await video.play()
    } catch {
      video.playbackRate = 1
      await seekAndPaint(to)
      emit('playEnd')
      return
    }
    startPlaybackLoop(to)
  },
)

/** 非播放时 state 变化 */
watch(
  () => props.state,
  async (state) => {
    if (props.playing || !ready.value) {
      return
    }
    await seekAndPaint(timeOf(state))
  },
)

/** 切回标签页：静默对齐当前态（seek 完成前保留旧 canvas 像素） */
watch(
  () => props.paintEpoch,
  async (epoch, prev) => {
    if (!ready.value || props.playing) {
      return
    }
    if (epoch == null || epoch === prev) {
      return
    }
    stopPlaybackLoop()
    const video = videoRef.value
    video?.pause()
    if (video) {
      video.playbackRate = 1
    }
    await seekAndPaint(timeOf(props.state))
  },
)

onMounted(async () => {
  const video = videoRef.value
  if (!video) {
    return
  }
  video.muted = true
  video.playsInline = true
  const onReady = async () => {
    ready.value = true
    await seekAndPaint(timeOf(props.state))
  }
  if (video.readyState >= 2) {
    await onReady()
  } else {
    video.addEventListener('loadeddata', () => {
      void onReady()
    }, { once: true })
  }
})

onUnmounted(() => {
  stopPlaybackLoop()
  videoRef.value?.pause()
})

/** 包裹样式 */
const wrapStyle = computed(() => ({
  '--dw': `${displayW}px`,
  '--dh': `${displayH.value}px`,
}))
</script>

<template>
  <div
    class="sprite-image-wrap is-idle-wobble"
    :class="{
      'is-hover-wobble': hovered && !playing,
      'is-scrubbing': playing,
      'is-fading': fading,
      'is-ready': ready,
    }"
    :style="wrapStyle"
  >
    <video
      ref="videoRef"
      class="sprite-video"
      :src="videoSrc"
      muted
      playsinline
      preload="auto"
      crossorigin="anonymous"
    />
    <canvas ref="canvasRef" class="sprite-canvas" aria-hidden="true" />
  </div>
</template>

<style scoped>
.sprite-image-wrap {
  width: var(--dw);
  height: var(--dh);
  position: relative;
  line-height: 0;
  transform-origin: center bottom;
  opacity: 0;
  filter: drop-shadow(0 2px 4px rgb(61 40 23 / 12%));
  transition: opacity 0.25s ease;
}

.sprite-image-wrap.is-ready {
  opacity: 1;
}

.sprite-image-wrap.is-fading {
  animation: sprite-fade-in 0.28s ease;
}

.sprite-video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.sprite-canvas {
  width: var(--dw);
  height: var(--dh);
  display: block;
  pointer-events: none;
  /* 交给 canvas 缓冲像素，避免 CSS 再模糊一次 */
  image-rendering: auto;
}

.sprite-image-wrap.is-idle-wobble:not(.is-scrubbing) {
  animation: blanket-wobble 2.8s ease-in-out infinite;
}

.sprite-image-wrap.is-hover-wobble {
  animation: blanket-wobble-hover 1.05s ease-in-out infinite;
}

.sprite-image-wrap.is-scrubbing {
  animation: none;
}

@keyframes sprite-fade-in {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

@keyframes blanket-wobble {
  0%,
  100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-3px) rotate(1.2deg);
  }
}

@keyframes blanket-wobble-hover {
  0%,
  100% {
    transform: translateY(0) rotate(-2.8deg) scale(1);
  }
  25% {
    transform: translateY(-5px) rotate(2.2deg) scale(1.035);
  }
  50% {
    transform: translateY(-2px) rotate(-1.8deg) scale(1.04);
  }
  75% {
    transform: translateY(-6px) rotate(3deg) scale(1.03);
  }
}

@media (max-width: 767px) {
  .sprite-image-wrap {
    transform: scale(0.92);
    transform-origin: bottom right;
  }

  .sprite-image-wrap.is-idle-wobble:not(.is-scrubbing) {
    animation: blanket-wobble-mobile 2.8s ease-in-out infinite;
  }

  .sprite-image-wrap.is-hover-wobble {
    animation: blanket-wobble-hover-mobile 1.05s ease-in-out infinite;
  }

  .sprite-image-wrap.is-scrubbing {
    transform: scale(0.92);
  }
}

@keyframes blanket-wobble-mobile {
  0%,
  100% {
    transform: scale(0.92) translateY(0) rotate(-1deg);
  }
  50% {
    transform: scale(0.92) translateY(-3px) rotate(1.2deg);
  }
}

@keyframes blanket-wobble-hover-mobile {
  0%,
  100% {
    transform: scale(0.92) translateY(0) rotate(-2.8deg);
  }
  25% {
    transform: scale(0.955) translateY(-5px) rotate(2.2deg);
  }
  50% {
    transform: scale(0.96) translateY(-2px) rotate(-1.8deg);
  }
  75% {
    transform: scale(0.95) translateY(-6px) rotate(3deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sprite-image-wrap.is-idle-wobble,
  .sprite-image-wrap.is-hover-wobble {
    animation: none;
  }
}
</style>
