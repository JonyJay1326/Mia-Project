import { reactive } from 'vue'

/** 确认框入参 */
export type MiaConfirmOptions = {
  /** 标题 */
  title?: string
  /** 正文（可多行） */
  message: string
  /** 确认按钮文案 */
  confirmText?: string
  /** 取消按钮文案 */
  cancelText?: string
  /** 危险操作（确认钮用珊瑚红） */
  danger?: boolean
}

type ConfirmResolver = (ok: boolean) => void

/** 全局确认框状态（App 挂一份宿主） */
export const miaConfirmState = reactive({
  open: false,
  title: '确认一下',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: true,
})

let resolver: ConfirmResolver | null = null

/**
 * 打开糖果风二次确认框，返回是否确认
 */
export function miaConfirm(options: MiaConfirmOptions): Promise<boolean> {
  if (resolver) {
    resolver(false)
    resolver = null
  }
  miaConfirmState.title = options.title ?? '确认一下'
  miaConfirmState.message = options.message
  miaConfirmState.confirmText = options.confirmText ?? '确定'
  miaConfirmState.cancelText = options.cancelText ?? '取消'
  miaConfirmState.danger = options.danger ?? true
  miaConfirmState.open = true

  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

/** 关闭并回传结果 */
export function settleMiaConfirm(ok: boolean) {
  miaConfirmState.open = false
  if (resolver) {
    resolver(ok)
    resolver = null
  }
}

/**
 * 组合式：页面里调用 confirm()
 */
export function useMiaConfirm() {
  return { confirm: miaConfirm }
}
