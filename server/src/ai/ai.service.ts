import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AnalyticsService } from '../analytics/analytics.service'
import { DbService } from '../db/db.service'
import { SkillsService } from '../skills/skills.service'
import { mapEventRow, mapQuoteRow } from '../utils/mappers'
import type { EventRow, QuoteRow } from '../types/event'
import { loadAiConfig, readArchiveText } from './ai.config'

/** 对话消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** 聊天请求 */
export interface ChatRequest {
  messages: ChatMessage[]
  /** 是否附带近期崩溃统计（默认 true） */
  includeStats?: boolean
  days?: number
}

/** 一键解读请求 */
export interface InsightRequest {
  days?: number
}

/** AI 咨询：档案上下文 + OpenAI 兼容 Chat Completions */
@Injectable()
export class AiService {
  constructor(
    private readonly dbService: DbService,
    private readonly analyticsService: AnalyticsService,
    private readonly skillsService: SkillsService,
  ) {}

  /** 当前配置是否可用 */
  getStatus() {
    const cfg = loadAiConfig()
    const archive = readArchiveText(cfg.archivePath)
    const archiveLoaded =
      archive.length > 80 && !archive.startsWith('（未找到') && !archive.startsWith('（读取')
    return {
      enabled: cfg.enabled,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      archivePath: cfg.archivePath,
      archiveLoaded,
    }
  }

  /**
   * 多轮咨询：系统提示 = 档案规则 + 事实摘要
   */
  async chat(body: ChatRequest): Promise<{ reply: string; model: string }> {
    const cfg = loadAiConfig()
    if (!cfg.enabled) {
      throw new ServiceUnavailableException(
        '未配置 MIA_AI_API_KEY，无法调用 AI',
      )
    }

    const messages = sanitizeMessages(body.messages)
    if (!messages.length) {
      throw new BadRequestException('请先输入问题')
    }

    const days = clampDays(body.days ?? 60)
    const includeStats = body.includeStats !== false
    const system = this.buildSystemPrompt(days, includeStats)

    const reply = await callChatCompletions(cfg, [
      { role: 'system', content: system },
      ...messages,
    ])

    return { reply, model: cfg.model }
  }

  /**
   * 一键解读近 N 天崩溃统计（不写回数据库）
   */
  async insight(body: InsightRequest): Promise<{ reply: string; model: string }> {
    const days = clampDays(body.days ?? 60)
    const stats = this.analyticsService.getMeltdownAnalytics(days)
    if (stats.sampleSize < 5) {
      return {
        reply: `近 ${days} 天只有 ${stats.sampleSize} 条崩溃记录（不足 5 条）。先多记几条再解读，避免过度推断。`,
        model: 'local',
      }
    }

    return this.chat({
      days,
      includeStats: true,
      messages: [
        {
          role: 'user',
          content: [
            `请根据系统里附带的「近 ${days} 天崩溃统计事实」，做一次简短解读。`,
            '要求：',
            '1. 只基于给出的数字与排行，不编造未出现的场景',
            '2. 结合档案里已验证的方法给 2–4 条可执行建议',
            '3. 标明依据（统计项或档案条目）',
            '4. 若数据不足以支持某结论，明确说不确定',
            '5. 不要给性格标签，不要下医学诊断',
          ].join('\n'),
        },
      ],
    })
  }

  /**
   * 组装系统提示：档案全文（截断）+ 近期事实
   */
  private buildSystemPrompt(days: number, includeStats: boolean): string {
    const cfg = loadAiConfig()
    let archive = readArchiveText(cfg.archivePath)
    // 控制上下文体积，避免占满内存 / 超 token
    if (archive.length > 28000) {
      archive = `${archive.slice(0, 28000)}\n\n…（档案过长已截断）`
    }

    const facts = includeStats
      ? this.buildFactsBlock(days)
      : '（本次未附带统计摘要）'

    return [
      '你是 Mia（出生 2024-05-17）的专属育儿咨询助手。',
      '【硬性规则】必须结合下方完整的「Mia 档案」回答；禁止抛开档案给通用育儿百科。',
      '若档案与通用知识冲突，以档案为准。若档案未覆盖，先说明「档案未记载」再谨慎补充，并标注不确定。',
      '',
      '具体要求（与档案「给 AI 的话」一致）：',
      '1. 优先参考档案第三节「已验证清单」——已验证无效的方法不要重复推荐',
      '2. 说明依据——建议请注明来自档案哪一节/哪条，或来自哪项统计',
      '3. 年龄适配——建议必须适合她当前月龄（以档案与出生日期推算）',
      '4. 该就医就直说——超出正常范围请明确建议挂什么科',
      '5. 不确定就承认——信息不足时直接提问，别编造',
      '6. 只讨论可观察行为，不用性格标签',
      '7. 回答是给家长看的解读，不要要求写入成长记录数据库',
      '',
      '===== Mia 档案（权威上下文，请完整参考） =====',
      archive,
      '',
      '===== 近期系统事实（只读，来自成长中心数据库） =====',
      facts,
    ].join('\n')
  }

  /** 拼装统计 + 近期事件/语录/技能摘要 */
  private buildFactsBlock(days: number): string {
    const stats = this.analyticsService.getMeltdownAnalytics(days)
    const lines: string[] = []
    lines.push(`统计窗口：近 ${stats.days} 天`)
    lines.push(`崩溃条数：${stats.sampleSize}（canConclude=${stats.canConclude}）`)
    if (stats.avgIntensity != null) {
      lines.push(`平均强度：${stats.avgIntensity}（${stats.intensityCount} 条有值）`)
    }
    if (stats.avgDurationMin != null) {
      lines.push(
        `平均时长：${stats.avgDurationMin} 分钟（${stats.durationCount} 条有值）`,
      )
    }
    lines.push(
      `高发 chips：${formatTop(stats.byChip.map((x) => `${x.label}×${x.count}`))}`,
    )
    lines.push(
      `触发：${formatTop(stats.byTrigger.map((x) => `${x.label}×${x.count}`))}`,
    )
    lines.push(
      `地点：${formatTop(stats.byLocation.map((x) => `${x.label}×${x.count}`))}`,
    )
    lines.push(
      `照护人：${formatTop(stats.byCaregiver.map((x) => `${x.label}×${x.count}`))}`,
    )
    lines.push(
      `应对：${formatTop(stats.byCoping.map((x) => `${x.key}×${x.count}`))}`,
    )
    lines.push(
      `时段：${formatTop(stats.byHour.map((x) => `${x.label}×${x.count}`))}`,
    )
    lines.push(
      `午睡：是 ${stats.byNapped.nappedYes} / 否 ${stats.byNapped.nappedNo} / 未记 ${stats.byNapped.nappedUnknown}`,
    )

    const events = this.dbService.db
      .prepare(
        `SELECT * FROM events ORDER BY happened_at DESC LIMIT 12`,
      )
      .all() as EventRow[]
    lines.push('近期事件（最多 12 条）：')
    for (const row of events) {
      const ev = mapEventRow(row)
      lines.push(
        `- [${ev.type}] ${ev.happenedAt} ${ev.summary || '（无摘要）'} chips=${(ev.chips ?? []).join('|') || '—'}`,
      )
    }

    const quotes = this.dbService.db
      .prepare(`SELECT * FROM quotes ORDER BY said_at DESC LIMIT 8`)
      .all() as QuoteRow[]
    lines.push('近期语录（最多 8 条）：')
    for (const row of quotes) {
      const q = mapQuoteRow(row)
      lines.push(`- ${q.saidAt} 「${q.content}」 note=${q.note || '—'}`)
    }

    const skills = this.skillsService.listGrouped()
    lines.push('技能地图进度：')
    for (const g of skills) {
      lines.push(`- ${g.label}: ${g.doneCount}/${g.total} 已掌握`)
    }

    return lines.join('\n')
  }
}

/** 清洗并限制对话轮次 */
function sanitizeMessages(raw: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim(),
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 4000),
    }))
    .slice(-16)
}

/** 限制统计天数 */
function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 60
  return Math.min(Math.max(Math.floor(days), 7), 180)
}

/** 排行前几项 */
function formatTop(items: string[], n = 5): string {
  if (!items.length) return '—'
  return items.slice(0, n).join('，')
}

/**
 * 调用 OpenAI 兼容 /chat/completions
 */
async function callChatCompletions(
  cfg: ReturnType<typeof loadAiConfig>,
  messages: ChatMessage[],
): Promise<string> {
  const url = `${cfg.baseUrl}/chat/completions`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.4,
      }),
    })
  } catch (e) {
    throw new ServiceUnavailableException(
      `AI 请求失败：${e instanceof Error ? e.message : '网络错误'}`,
    )
  }

  const text = await res.text()
  let json: {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }
  try {
    json = JSON.parse(text) as typeof json
  } catch {
    throw new ServiceUnavailableException(
      `AI 返回非 JSON（HTTP ${res.status}）`,
    )
  }

  if (!res.ok) {
    throw new ServiceUnavailableException(
      json.error?.message || `AI 接口错误 HTTP ${res.status}`,
    )
  }

  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new ServiceUnavailableException('AI 未返回内容')
  }
  return content
}
