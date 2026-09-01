import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 启动前加载 server/.env（不覆盖已有环境变量）
 * 用于 DeepSeek 等密钥配置
 */
export function loadDotEnv() {
  const path = join(process.cwd(), '.env')
  if (!existsSync(path)) {
    return
  }
  const text = readFileSync(path, 'utf-8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const eq = line.indexOf('=')
    if (eq <= 0) {
      continue
    }
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
