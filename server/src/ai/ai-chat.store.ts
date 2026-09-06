import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DbService } from '../db/db.service'
import type { ChatMessage } from './ai.service'

/** 会话列表项 */
export interface AiChatSummary {
  id: string
  title: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

/** 会话详情 */
export interface AiChatDetail {
  id: string
  title: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  createdAt: string
  updatedAt: string
}

interface AiChatRow {
  id: string
  title: string
  messages: string
  created_at: string
  updated_at: string
}

/** AI 咨询会话持久化 */
@Injectable()
export class AiChatStore {
  constructor(private readonly dbService: DbService) {}

  /** 会话列表（新→旧） */
  list(limit = 50): AiChatSummary[] {
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 50, 1), 100)
    const rows = this.dbService.db
      .prepare(
        `SELECT * FROM ai_chats ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(safeLimit) as AiChatRow[]

    return rows.map((row) => {
      const messages = parseMessages(row.messages)
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      return {
        id: row.id,
        title: row.title,
        preview: (lastUser?.content ?? messages[0]?.content ?? '').slice(0, 80),
        messageCount: messages.length,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })
  }

  /** 读取完整会话 */
  get(id: string): AiChatDetail {
    const row = this.dbService.db
      .prepare('SELECT * FROM ai_chats WHERE id = ?')
      .get(id) as AiChatRow | undefined
    if (!row) {
      throw new NotFoundException('会话不存在')
    }
    return {
      id: row.id,
      title: row.title,
      messages: parseMessages(row.messages),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * 保存一轮对话后的完整 messages
   * chatId 为空则新建
   */
  save(
    chatId: string | undefined,
    messages: ChatMessage[],
  ): { chatId: string; title: string } {
    const cleaned = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    const now = new Date().toISOString()
    const title = titleFromMessages(cleaned)
    const payload = JSON.stringify(cleaned)

    if (chatId) {
      const existing = this.dbService.db
        .prepare('SELECT id FROM ai_chats WHERE id = ?')
        .get(chatId) as { id: string } | undefined
      if (!existing) {
        throw new NotFoundException('会话不存在')
      }
      this.dbService.db
        .prepare(
          `UPDATE ai_chats
           SET title = ?, messages = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(title, payload, now, chatId)
      return { chatId, title }
    }

    const id = randomUUID()
    this.dbService.db
      .prepare(
        `INSERT INTO ai_chats (id, title, messages, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, title, payload, now, now)
    return { chatId: id, title }
  }

  /** 删除会话 */
  remove(id: string): { id: string } {
    const result = this.dbService.db
      .prepare('DELETE FROM ai_chats WHERE id = ?')
      .run(id)
    if (result.changes === 0) {
      throw new NotFoundException('会话不存在')
    }
    return { id }
  }
}

/** 解析 messages JSON */
function parseMessages(
  raw: string,
): { role: 'user' | 'assistant'; content: string }[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
      .map((m) => ({ role: m.role, content: m.content }))
  } catch {
    return []
  }
}

/** 用首条用户消息做标题 */
function titleFromMessages(
  messages: { role: string; content: string }[],
): string {
  const first = messages.find((m) => m.role === 'user')?.content?.trim()
  if (!first) {
    return '新咨询'
  }
  const oneLine = first.replace(/\s+/g, ' ')
  return oneLine.length > 36 ? `${oneLine.slice(0, 36)}…` : oneLine
}
