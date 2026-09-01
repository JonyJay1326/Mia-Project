import { ref, onMounted, onUnmounted } from 'vue'

/** 毯子精灵四态 */
export type SpriteState = 'idle' | 'wave' | 'sleep' | 'fold'

/** 点击切换顺序 */
const CYCLE: SpriteState[] = ['idle', 'wave', 'sleep', 'fold']

/**
 * 精灵状态机：定格关键时刻；点击播到下一态后停下
 * 切页只暂停/定格逻辑，不改视觉态（避免回来时 idle→当前态闪一下）
 */
export function useSpriteState() {
  const state = ref<SpriteState>('idle')
  /** 正在播放切态动画 */
  const playing = ref(false)
  /** 切态目标（播放中优先于 state 作为终点） */
  const targetState = ref<SpriteState | null>(null)
  /** 页不可见：禁止点击，等回来再允许 */
  const pageHidden = ref(false)
  /** 通知画面层：可见后静默对齐当前态 */
  const paintEpoch = ref(0)

  /** 下一态 */
  function nextCycleState(): SpriteState {
    const index = CYCLE.indexOf(state.value)
    const safe = index < 0 ? 0 : index
    return CYCLE[(safe + 1) % CYCLE.length]
  }

  /** 进入待机 */
  function enterIdle() {
    playing.value = false
    targetState.value = null
    pageHidden.value = false
    state.value = 'idle'
  }

  /** 是否可点击切态 */
  function canClick(): boolean {
    return !playing.value && !pageHidden.value
  }

  /**
   * 点击：开始播向下一态
   * @returns 是否成功开始
   */
  function playClickTransition(): boolean {
    if (!canClick()) {
      return false
    }
    targetState.value = nextCycleState()
    playing.value = true
    return true
  }

  /** 播放结束：定格目标态 */
  function onPlayEnd() {
    if (targetState.value) {
      state.value = targetState.value
    }
    targetState.value = null
    playing.value = false
  }

  /**
   * 页面隐藏：若正在切态则直接定格到目标；不改成 fold，避免回来 seek 闪帧
   */
  function onPageHide() {
    pageHidden.value = true
    if (playing.value && targetState.value) {
      state.value = targetState.value
      playing.value = false
      targetState.value = null
    } else {
      playing.value = false
      targetState.value = null
    }
  }

  /** 页面可见：允许交互，并触发画面静默对齐 */
  function onPageShow() {
    pageHidden.value = false
    playing.value = false
    targetState.value = null
    paintEpoch.value += 1
  }

  /** visibility 变化 */
  function onVisibility() {
    if (document.hidden) {
      onPageHide()
    } else {
      onPageShow()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    state,
    playing,
    targetState,
    paintEpoch,
    nextCycleState,
    canClick,
    playClickTransition,
    onPlayEnd,
    enterIdle,
  }
}
