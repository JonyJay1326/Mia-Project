import { ServiceUnavailableException } from '@nestjs/common'
import { loadAiConfig } from './ai.config'

/** 场景 emoji 建议结果 */
export interface SceneEmojiResult {
  emoji: string
}

/**
 * 为录入场景名称选一个贴合的 emoji；失败则返回默认星标
 */
export async function suggestSceneEmoji(
  rawLabel: string,
): Promise<SceneEmojiResult> {
  const label = rawLabel.trim().slice(0, 40)
  if (!label) {
    return { emoji: '⭐' }
  }

  const cfg = loadAiConfig()
  if (!cfg.enabled) {
    return { emoji: '⭐' }
  }

  const system = [
    '你是育儿记录助手。家长正在添加一张「快速录入场景卡片」名称。',
    '请选一个最贴合场景含义的 emoji，只输出严格 JSON，不要 markdown。',
    'emoji 只用一个表情符号，不要文字。',
    '格式：{"emoji":"..."}',
  ].join('\n')

  try {
    const content = await callChatJson(cfg.baseUrl, cfg.apiKey, cfg.model, [
      { role: 'system', content: system },
      { role: 'user', content: label },
    ])
    return parseEmojiJson(content)
  } catch {
    return { emoji: '⭐' }
  }
}

/**
 * 解析模型返回的 emoji JSON
 */
function parseEmojiJson(content: string): SceneEmojiResult {
  const trimmed = content.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  const obj = JSON.parse(jsonText) as { emoji?: string }
  return { emoji: normalizeEmoji(obj.emoji) }
}

/** 校验 emoji：取第一个字符 */
function normalizeEmoji(raw?: string): string {
  const s = (raw ?? '').trim()
  if (!s) {
    return '⭐'
  }
  const chars = [...s]
  return chars[0] ?? '⭐'
}

/**
 * 调用 Chat Completions（低温度，便于 JSON）
 */
async function callChatJson(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  })
  const text = await res.text()
  let json: {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    throw new ServiceUnavailableException('AI 返回非 JSON')
  }
  if (!res.ok) {
    throw new ServiceUnavailableException(
      json.error?.message || `AI HTTP ${res.status}`,
    )
  }
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new ServiceUnavailableException('AI 未返回内容')
  }
  return content
}
