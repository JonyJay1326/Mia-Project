import DOMPurify from 'dompurify'
import { marked } from 'marked'

/** Markdown 解析选项：GFM + 单换行转 br */
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * 将 Markdown 转为经消毒的 HTML（供 v-html 使用）
 */
export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
