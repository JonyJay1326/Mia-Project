import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventsService } from '../events/events.service'
import { QuotesService } from '../quotes/quotes.service'
import { DbService } from '../db/db.service'
import type { EventInput, QuoteInput } from '../types/event'
import { BIRTH_DATE, monthAge } from '../utils/date'

/**
 * 启动时写入历史种子数据
 * 各条用固定 id + 存在则跳过，可重复启动不重复插入
 */
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly dbService: DbService,
    private readonly eventsService: EventsService,
    private readonly quotesService: QuotesService,
  ) {}

  /** 模块初始化后执行种子逻辑 */
  onModuleInit() {
    this.seedHistoricalEvent()
    this.seedDemoMeltdowns()
    this.seedDemoQuotes()
  }

  /** 写入 2026-08-31 早醒那条健康记录 */
  private seedHistoricalEvent() {
    const happenedAt = '2026-08-31T05:50:00.000+08:00'
    const created = this.insertEventIfAbsent({
      id: 'seed-2026-08-31-early-wake',
      happenedAt,
      type: 'health',
      summary: '早醒要喝奶，说肚子不舒服，放屁后缓解但不再睡',
      chips: ['睡不好/早醒', '肚子不舒服'],
      location: 'home',
      caregiver: 'dad',
      napped: null,
      outcome:
        '5:50 醒来说要喝奶；喝 90ml 后说肚子不舒服；后来放了个屁，之后不想睡了，起床看书。醒后精神状态好，无哭闹。',
      monthAge: monthAge(BIRTH_DATE, happenedAt),
    })
    if (created) {
      console.log('[seed] 已写入历史事件：2026-08-31 早醒')
    }
  }

  /**
   * 写入 5 条示例崩溃（来自档案高发场景，便于分析页验收）
   */
  private seedDemoMeltdowns() {
    const demos: EventInput[] = [
      {
        id: 'seed-meltdown-01-mall-candy',
        happenedAt: '2026-08-28T16:40:00.000+08:00',
        type: 'meltdown',
        summary: '商场要买糖被拒，蹲地哭喊约 8 分钟',
        chips: ['要买糖/玩具被拒'],
        location: 'mall',
        trigger: 'refused',
        intensity: 4,
        durationMin: 8,
        coping: ['抱抱/安抚物', '给两个选项'],
        outcome: '抱起离开糖果区后逐渐平静',
        caregiver: 'mom',
        napped: 1,
      },
      {
        id: 'seed-meltdown-02-order',
        happenedAt: '2026-08-29T10:15:00.000+08:00',
        type: 'meltdown',
        summary: '穿衣没按她说的顺序，哭喊不要',
        chips: ['没按她的顺序来', '不肯穿这件衣服'],
        location: 'home',
        trigger: 'order',
        intensity: 3,
        durationMin: 6,
        coping: ['提前预告', '给两个选项'],
        outcome: '改成先穿袜子后平静',
        caregiver: 'dad',
        napped: null,
      },
      {
        id: 'seed-meltdown-03-park',
        happenedAt: '2026-08-27T18:20:00.000+08:00',
        type: 'meltdown',
        summary: '公园说回家，她不想走还想玩',
        chips: ['不想走，还想玩'],
        location: 'outdoor',
        trigger: 'interrupted',
        intensity: 4,
        durationMin: 12,
        coping: ['转移注意力（唱歌）', '抱抱/安抚物'],
        outcome: '唱歌带走，路上仍哼唧',
        caregiver: 'mom',
        napped: 0,
      },
      {
        id: 'seed-meltdown-04-bedtime',
        happenedAt: '2026-08-26T21:05:00.000+08:00',
        type: 'meltdown',
        summary: '睡前不肯关灯，哭喊要继续玩',
        chips: ['不明原因'],
        location: 'home',
        trigger: 'bedtime',
        intensity: 3,
        durationMin: 10,
        coping: ['冷处理等着', '抱抱/安抚物'],
        outcome: '关灯后抱毯子约 5 分钟入睡',
        caregiver: 'mom',
        napped: 1,
      },
      {
        id: 'seed-meltdown-05-food',
        happenedAt: '2026-08-25T12:30:00.000+08:00',
        type: 'meltdown',
        summary: '不肯吃饭，推开碗哭',
        chips: ['不肯吃饭'],
        location: 'home',
        trigger: 'food',
        intensity: 2,
        durationMin: 5,
        coping: ['给两个选项', '讲道理'],
        outcome: '换小份后吃了几口',
        caregiver: 'grandma',
        napped: 1,
      },
    ]

    let inserted = 0
    for (const demo of demos) {
      if (this.insertEventIfAbsent(demo)) {
        inserted += 1
      }
    }
    if (inserted > 0) {
      console.log(`[seed] 已写入 ${inserted} 条示例崩溃（分析验收用）`)
    }
  }

  /**
   * 写入示例语录（来自档案里出现过的原话，供精灵气泡 / 语录墙）
   */
  private seedDemoQuotes() {
    const demos: QuoteInput[] = [
      {
        id: 'seed-quote-01-sound',
        content: '这是什么声音',
        context: '听到远处不明声响',
        note: '她在把未知变成可预测，是健康的应对',
        saidAt: '2026-08-28T15:10:00.000+08:00',
      },
      {
        id: 'seed-quote-02-no',
        content: '不要',
        context: '被要求停下来做事时',
        note: '还不会用情绪词，只会拒绝',
        saidAt: '2026-08-27T09:40:00.000+08:00',
      },
      {
        id: 'seed-quote-03-grass',
        content: '浇浇小草',
        context: '户外小便，大人引导后她跟着说',
        note: '游戏化引导有效',
        saidAt: '2026-08-26T16:05:00.000+08:00',
      },
      {
        id: 'seed-quote-04-apple',
        content: 'apple',
        context: '吃苹果时',
        note: '英语在场景里自然冒出来',
        saidAt: '2026-08-25T10:20:00.000+08:00',
      },
      {
        id: 'seed-quote-05-dog',
        content: 'dog',
        context: '看见狗',
        note: '动物类单词已会说',
        saidAt: '2026-08-24T17:30:00.000+08:00',
      },
    ]

    let inserted = 0
    for (const demo of demos) {
      if (this.insertQuoteIfAbsent(demo)) {
        inserted += 1
      }
    }
    if (inserted > 0) {
      console.log(`[seed] 已写入 ${inserted} 条示例语录（精灵气泡用）`)
    }
  }

  /**
   * 事件若不存在则写入
   */
  private insertEventIfAbsent(input: EventInput): boolean {
    const existing = this.dbService.db
      .prepare('SELECT id FROM events WHERE id = ?')
      .get(input.id)
    if (existing) {
      return false
    }
    this.eventsService.create({
      ...input,
      monthAge: input.monthAge ?? monthAge(BIRTH_DATE, input.happenedAt),
    })
    return true
  }

  /**
   * 语录若不存在则写入
   */
  private insertQuoteIfAbsent(input: QuoteInput): boolean {
    const existing = this.dbService.db
      .prepare('SELECT id FROM quotes WHERE id = ?')
      .get(input.id)
    if (existing) {
      return false
    }
    this.quotesService.create({
      ...input,
      monthAge: input.monthAge ?? monthAge(BIRTH_DATE, input.saidAt),
    })
    return true
  }
}
