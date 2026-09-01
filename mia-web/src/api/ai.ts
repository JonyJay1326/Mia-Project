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
}

/** 查询 AI 是否已配置 */
export function fetchAiStatus() {
  return request<AiStatus>('/ai/status')
}

/** 多轮咨询（服务端会附带 Mia 档案 + 近期事实） */
export function postAiChat(body: {
  messages: AiChatMessage[]
  days?: number
  includeStats?: boolean
}) {
  return request<AiReply>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 一键解读崩溃统计 */
export function postAiInsight(days = 60) {
  return request<AiReply>('/ai/insight', {
    method: 'POST',
    body: JSON.stringify({ days }),
  })
}

/** AI 预览场景 emoji（不写库） */
export function suggestSceneEmoji(label: string) {
  return request<{ emoji: string }>('/ai/scene-suggest', {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
}
