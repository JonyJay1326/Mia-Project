/** Mia 出生日期 */
export const BIRTH_DATE = '2024-05-17'

/**
 * 按完整月计算月龄（未到当月生日不算满月）
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
 * 月龄格式化为「x 岁 y 个月」
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

/** 生成本地可读的 datetime-local 值 */
export function toDatetimeLocalValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 把 datetime-local 转成 ISO 字符串 */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}
