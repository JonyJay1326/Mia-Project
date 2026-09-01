import { ServiceUnavailableException } from '@nestjs/common'
import { loadAiConfig } from '../ai/ai.config'
import type { SkillDomain } from '../types/skill'
import { DOMAIN_META } from './skill-catalog'

/** AI 分类结果 */
export interface SkillClassifyResult {
  domain: SkillDomain
  emoji: string
  label: string
}

const DOMAIN_KEYS = Object.keys(DOMAIN_META) as SkillDomain[]

/**
 * 用 DeepSeek 为技能描述选 emoji 与领域；失败则归入「其他」
 */
export async function classifySkillLabel(
  rawLabel: string,
): Promise<SkillClassifyResult> {
  const label = rawLabel.trim().slice(0, 120)
  if (!label) {
    return { domain: 'other', emoji: '🌱', label: '新技能' }
  }

  const cfg = loadAiConfig()
  if (!cfg.enabled) {
    return fallbackClassify(label)
  }

  const domainHint = DOMAIN_KEYS.map(
    (k) => `${k}=${DOMAIN_META[k].label}`,
  ).join('；')

  const system = [
    '你是幼儿发展观察助手。根据家长一句「可观察技能」描述，输出严格 JSON，不要 markdown。',
    `domain 只能是：${DOMAIN_KEYS.join('|')}。无法归类时用 other。`,
    `领域含义：${domainHint}`,
    'emoji 只用一个表情，贴合技能内容。',
    'label 用简短中文（≤20 字），保留原意，不要加引号。',
    '格式：{"domain":"...","emoji":"...","label":"..."}',
  ].join('\n')

  try {
    const content = await callChatJson(cfg.baseUrl, cfg.apiKey, cfg.model, [
      { role: 'system', content: system },
      { role: 'user', content: label },
    ])
    return parseClassifyJson(content, label)
  } catch {
    return fallbackClassify(label)
  }
}

/**
 * 解析模型返回的 JSON
 */
function parseClassifyJson(
  content: string,
  fallbackLabel: string,
): SkillClassifyResult {
  const trimmed = content.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  const obj = JSON.parse(jsonText) as {
    domain?: string
    emoji?: string
    label?: string
  }
  const domain = normalizeDomain(obj.domain)
  const emoji = normalizeEmoji(obj.emoji)
  const cleanLabel =
    (obj.label ?? fallbackLabel).trim().slice(0, 40) || fallbackLabel
  return { domain, emoji, label: cleanLabel }
}

/** 无 AI 时的简单兜底 */
function fallbackClassify(label: string): SkillClassifyResult {
  return { domain: 'other', emoji: '🌱', label }
}

/** 校验领域 */
function normalizeDomain(raw?: string): SkillDomain {
  const key = (raw ?? '').trim().toLowerCase()
  if (DOMAIN_KEYS.includes(key as SkillDomain)) {
    return key as SkillDomain
  }
  return 'other'
}

/** 校验 emoji：取第一个字符 */
function normalizeEmoji(raw?: string): string {
  const s = (raw ?? '').trim()
  if (!s) {
    return '🌱'
  }
  const chars = [...s]
  return chars[0] ?? '🌱'
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
