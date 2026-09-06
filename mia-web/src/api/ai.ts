import { request } from '@/api/client'

/** AI 配置状态 */
export interface AiStatus {
  enabled: boolean
  model: string
  baseUrl: string
  archivePath: string
  archiveLoaded: boolean
}

/** 对话消息 */
export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** AI 回复 */
export interface AiReply {
  reply: string
  model: string
  chatId?: string
}

/** 历史会话摘要 */
export interface AiChatSummary {
  id: string
  title: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

/** 历史会话详情 */
export interface AiChatDetail {
  id: string
  title: string
  messages: AiChatMessage[]
  createdAt: string
  updatedAt: string
}

/** 查询 AI 是否已配置 */
export function fetchAiStatus() {
  return request<AiStatus>('/ai/status')
}

/** 多轮咨询（服务端会附带 Mia 档案 + 近期事实，并写入历史） */
export function postAiChat(body: {
  messages: AiChatMessage[]
  days?: number
  includeStats?: boolean
  chatId?: string
}) {
  return request<AiReply>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 咨询历史列表 */
export function fetchAiChats(limit = 40) {
  return request<AiChatSummary[]>(`/ai/chats?limit=${limit}`)
}

/** 单条咨询历史 */
export function fetchAiChat(id: string) {
  return request<AiChatDetail>(`/ai/chats/${id}`)
}

/** 删除咨询历史 */
export function deleteAiChat(id: string) {
  return request<{ id: string }>(`/ai/chats/${id}`, { method: 'DELETE' })
}

/** 一键解读崩溃统计 */
export function postAiInsight(days = 60) {
  return request<AiReply>('/ai/insight', {
    method: 'POST',
    body: JSON.stringify({ days }),
  })
}

/** AI 预览自定义场景：emoji + 新类型 + 5 条 chips（不写库） */
export function suggestSceneEmoji(label: string) {
  return request<{
    emoji: string
    typeKey: string
    typeLabel: string
    chips: string[]
  }>('/ai/scene-suggest', {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
}
