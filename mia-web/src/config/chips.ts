import type { EventType } from '@/types/event'

/** 按事件类型切换的一句话 chips */
export const CHIPS_BY_TYPE: Record<EventType, string[]> = {
  meltdown: [
    '要买糖/玩具被拒',
    '不想走，还想玩',
    '没按她的顺序来',
    '不肯穿这件衣服',
    '不肯吃饭',
    '和小朋友抢玩具',
    '要抱抱',
    '不明原因',
  ],
  skill: ['自己完成了一件事', '说了新词/新句子', '解锁新动作'],
  health: ['肚子不舒服', '睡不好/早醒', '吃饭不好'],
  question: [],
}

/** 崩溃应对方式 chips（事后补详情用） */
export const COPING_CHIPS = [
  '抱抱/安抚物',
  '提前预告',
  '给两个选项',
  '转移注意力（唱歌）',
  '冷处理等着',
  '讲道理',
  '没管用',
]

/** 地点 chips */
export const LOCATION_CHIPS: { value: string; label: string }[] = [
  { value: 'home', label: '家里' },
  { value: 'outdoor', label: '户外' },
  { value: 'mall', label: '商场' },
  { value: 'grandparents', label: '爷奶家' },
  { value: 'other', label: '其他' },
]

/** 照护人 chips */
export const CAREGIVER_CHIPS: { value: string; label: string }[] = [
  { value: 'mom', label: '妈妈' },
  { value: 'dad', label: '爸爸' },
  { value: 'grandma', label: '奶奶' },
  { value: 'grandpa', label: '爷爷' },
]

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
