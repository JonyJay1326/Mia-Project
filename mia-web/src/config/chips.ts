import type { CaregiverType, EventType, LocationType } from '@/types/event'

/** 按事件类型切换的一句话 chips */
export const CHIPS_BY_TYPE: Record<EventType, string[]> = {
  meltdown: [
    '要买糖/玩具被拒',
    '不想走，还想玩',
    '该回家了还不走',
    '没按她的顺序来',
    '不肯穿这件衣服',
    '不肯吃饭',
    '不想洗澡/洗手',
    '不给看手机/iPad',
    '毯子/安抚物找不到',
    '要妈妈不要别人',
    '和小朋友抢玩具',
    '突然换计划',
    '要抱抱',
    '累了还不自知',
    '不明原因',
  ],
  skill: ['自己完成了一件事', '说了新词/新句子', '解锁新动作'],
  daily: ['今天发生的一件小事', '自己做了…', '出门玩了', '和家人在一起'],
  emotion: ['特别开心', '有点害羞', '很黏人', '突然不高兴', '情绪来得很快'],
  sleep: ['早醒', '入睡困难', '夜醒', '午睡不好', '睡前折腾'],
  diet: ['吃得好', '挑食/拒食', '要喝奶', '肚子不舒服', '零食相关'],
  social: ['见人热情/认生', '分离焦虑', '和小朋友互动', '上幼儿园相关'],
  medical: ['发烧/看病', '疫苗', '吃药', '过敏/皮疹', '体检'],
}

/** 崩溃应对方式 chips（事后补详情用） */
export const COPING_CHIPS = [
  '抱抱/安抚物',
  '提前预告',
  '给两个选项',
  '转移注意力',
  '冷处理等着',
  '讲道理',
  '没管用',
]

/** 地点 chips（录入可选） */
export const LOCATION_CHIPS: { value: LocationType; label: string }[] = [
  { value: 'home', label: '家里' },
  { value: 'outdoor', label: '户外' },
  { value: 'mall', label: '商场' },
  { value: 'grandparents', label: '爷奶家' },
  { value: 'taoshudi', label: '桃树地' },
  { value: 'tongtong', label: '彤彤姐家' },
  { value: 'school', label: '学校' },
  { value: 'other', label: '其他' },
]

/** 地点展示文案（含历史值回退） */
const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_CHIPS.map((c) => [c.value, c.label]),
)

/** 记录人 chips（录入仅爸妈） */
export const CAREGIVER_CHIPS: { value: CaregiverType; label: string }[] = [
  { value: 'mom', label: '妈妈' },
  { value: 'dad', label: '爸爸' },
]

/** 记录人展示文案（含历史爷奶数据） */
const CAREGIVER_LABELS: Record<string, string> = {
  mom: '妈妈',
  dad: '爸爸',
  grandma: '奶奶',
  grandpa: '爷爷',
}

/** 触发原因 chips */
export const TRIGGER_CHIPS: { value: string; label: string }[] = [
  { value: 'refused', label: '要求被拒' },
  { value: 'interrupted', label: '被打断' },
  { value: 'order', label: '顺序被打乱' },
  { value: 'dressed', label: '穿衣' },
  { value: 'food', label: '吃饭' },
  { value: 'share', label: '分享/抢玩具' },
  { value: 'bedtime', label: '睡前' },
  { value: 'unknown', label: '不明' },
]

/** 地点枚举转中文 */
export function locationLabel(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return LOCATION_LABELS[value] ?? value
}

/** 记录人枚举转中文 */
export function caregiverLabel(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return CAREGIVER_LABELS[value] ?? value
}
