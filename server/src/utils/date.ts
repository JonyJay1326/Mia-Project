/** Mia 出生日期，月龄计算基准 */
export const BIRTH_DATE = '2024-05-17'

/**
 * 按完整月计算月龄（不是天数除 30）
 * 未到当月生日那天则不算满月
 */
export function monthAge(birthDate: string, at: string): number {
  const birth = new Date(birthDate)
  const when = new Date(at)
  let months =
    (when.getFullYear() - birth.getFullYear()) * 12 +
    (when.getMonth() - birth.getMonth())
  if (when.getDate() < birth.getDate()) {
    months--
  }
  return Math.max(0, months)
}

/**
 * 把月龄格式化成「x 岁 y 个月」
 */
export function formatMonthAge(months: number): string {
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years <= 0) {
    return `${rem} 个月`
  }
  if (rem === 0) {
    return `${years} 岁`
  }
  return `${years} 岁 ${rem} 个月`
}

/** 安全解析 JSON 数组，失败返回空数组 */
export function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) {
    return []
  }
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? (value as string[]) : []
  } catch {
    return []
  }
}

/** 把字符串数组序列化为 JSON，空则存 null */
export function stringifyJsonArray(
  value: string[] | null | undefined,
): string | null {
  if (!value || value.length === 0) {
    return null
  }
  return JSON.stringify(value)
}
