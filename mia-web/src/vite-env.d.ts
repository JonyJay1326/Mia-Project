/// <reference types="vite/client" />

declare module '*.mp4' {
  const src: string
  export default src
}

/** Vite 环境变量类型 */
interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_ENABLE_SW: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
