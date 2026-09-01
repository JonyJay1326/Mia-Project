import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** AI 相关环境配置（OpenAI 兼容接口） */
export interface AiConfig {
  apiKey: string
  baseUrl: string
  model: string
  archivePath: string
  enabled: boolean
}

/**
 * 从环境变量读取 AI 配置（默认 DeepSeek）
 * MIA_AI_API_KEY / MIA_AI_BASE_URL / MIA_AI_MODEL / MIA_ARCHIVE_PATH
 */
export function loadAiConfig(): AiConfig {
  const apiKey = (process.env.MIA_AI_API_KEY ?? '').trim()
  const baseUrl = (
    process.env.MIA_AI_BASE_URL ?? 'https://api.deepseek.com/v1'
  ).replace(/\/$/, '')
  const model = (process.env.MIA_AI_MODEL ?? 'deepseek-chat').trim()
  const archivePath = resolveArchivePath(process.env.MIA_ARCHIVE_PATH)

  return {
    apiKey,
    baseUrl,
    model,
    archivePath,
    enabled: Boolean(apiKey),
  }
}

/**
 * 解析档案路径：相对路径相对 server 工作目录与上一级项目根
 */
function resolveArchivePath(raw?: string): string {
  if (raw?.trim()) {
    return resolve(raw.trim())
  }
  const candidates = [
    join(process.cwd(), '..', 'Mia档案.md'),
    join(process.cwd(), 'Mia档案.md'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      return p
    }
  }
  return candidates[0]
}

/**
 * 读取 Mia 档案全文；缺失则返回短提示
 */
export function readArchiveText(path: string): string {
  try {
    if (!existsSync(path)) {
      return '（未找到 Mia档案.md，请设置环境变量 MIA_ARCHIVE_PATH）'
    }
    return readFileSync(path, 'utf-8')
  } catch {
    return '（读取档案失败）'
  }
}
