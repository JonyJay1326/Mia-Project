import { ServiceUnavailableException } from '@nestjs/common'
import { loadAiConfig } from './ai.config'

/** 自定义场景建议：全新类型 + emoji + 5 条 chips */
export interface SceneSuggestResult {
  emoji: string
  /** 类型短键，英文/拼音小写，将存成 c_xxx */
  typeKey: string
  /** 类型中文名（时间线胶囊用） */
  typeLabel: string
  /** 约 5 条一句话 chips */
  chips: string[]
}

/**
 * 为自定义场景卡生成 emoji、新类型名与 5 条 chips
 */
export async function suggestSceneEmoji(
  rawLabel: string,
): Promise<SceneSuggestResult> {
  const label = rawLabel.trim().slice(0, 40)
  if (!label) {
    return heuristicSuggest('新场景')
  }

  const fallback = heuristicSuggest(label)
  const cfg = loadAiConfig()
  if (!cfg.enabled) {
    return fallback
  }

  const system = [
    '你是育儿记录助手。家长正在添加一张「自定义快速录入场景卡片」。',
    '请为这个场景发明一个**新的事件分类**（不要用崩溃/技能/日常/情绪/吃喝拉撒睡/社交/医疗/高光这些已有大类名，要更具体），',
    '并给出一个 emoji，以及正好 5 条适合点选的「一句话」chips（短、可观测、口语）。',
    'typeKey：英文或拼音小写+下划线，2–20 字符，如 toilet_train、first_words。',
    'typeLabel：中文分类名，2–8 字，如「如厕训练」「第一次」。',
    '只输出严格 JSON，不要 markdown。',
    '格式：{"emoji":"🚽","typeKey":"toilet_train","typeLabel":"如厕训练","chips":["拉臭臭成功","试图拉但没成","拉在裤子上","不肯坐盆","自己喊臭臭"]}',
  ].join('\n')

  try {
    const content = await callChatJson(cfg.baseUrl, cfg.apiKey, cfg.model, [
      { role: 'system', content: system },
      { role: 'user', content: label },
    ])
    return mergeSuggest(parseSuggestJson(content), fallback)
  } catch {
    return fallback
  }
}

/** 无 AI：按名称生成兜底类型与 chips */
function heuristicSuggest(label: string): SceneSuggestResult {
  const typeKey = slugify(label)
  const typeLabel = label.slice(0, 8) || '自定义'
  const chips = [
    `${typeLabel}相关`,
    '今天发生了',
    '还差一点',
    '自己做到了',
    '需要大人帮忙',
  ]
  let emoji = '⭐'
  if (/拉|臭|便|尿|厕/.test(label)) emoji = '🚽'
  else if (/睡|夜醒|午睡/.test(label)) emoji = '😴'
  else if (/吃|喝|奶|饭/.test(label)) emoji = '🥣'
  else if (/高光|第一次|暖心|骄傲/.test(label)) emoji = '✨'
  else if (/崩|哭/.test(label)) emoji = '🍭'
  return { emoji, typeKey, typeLabel, chips }
}

/** 合并 AI 结果与兜底 */
function mergeSuggest(
  parsed: Partial<SceneSuggestResult>,
  fallback: SceneSuggestResult,
): SceneSuggestResult {
  const chips = (parsed.chips?.length ? parsed.chips : fallback.chips)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 5)
  while (chips.length < 5) {
    chips.push(fallback.chips[chips.length] ?? '其他情况')
  }
  return {
    emoji: parsed.emoji || fallback.emoji,
    typeKey: parsed.typeKey || fallback.typeKey,
    typeLabel: parsed.typeLabel || fallback.typeLabel,
    chips,
  }
}

/** 解析 JSON */
function parseSuggestJson(content: string): Partial<SceneSuggestResult> {
  const trimmed = content.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  const obj = JSON.parse(jsonText) as {
    emoji?: string
    typeKey?: string
    typeLabel?: string
    chips?: unknown
  }
  const chips = Array.isArray(obj.chips)
    ? obj.chips.map((c) => String(c)).filter(Boolean)
    : undefined
  return {
    emoji: normalizeEmoji(obj.emoji),
    typeKey: normalizeTypeKey(obj.typeKey),
    typeLabel: (obj.typeLabel ?? '').trim().slice(0, 12) || undefined,
    chips,
  }
}

/** 取首个 emoji */
function normalizeEmoji(raw?: string): string {
  const s = (raw ?? '').trim()
  if (!s) return '⭐'
  return [...s][0] ?? '⭐'
}

/** 规范 typeKey */
function normalizeTypeKey(raw?: string): string | undefined {
  const s = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
  return s || undefined
}

/** 中文名转简易 slug */
function slugify(label: string): string {
  const ascii = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (ascii.length >= 2) {
    return ascii.slice(0, 16)
  }
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return `s${hash.toString(36).slice(0, 8)}`
}

/** 调用 Chat Completions */
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
      temperature: 0.3,
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
