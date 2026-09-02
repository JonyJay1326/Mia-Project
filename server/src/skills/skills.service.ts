import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { DbService } from '../db/db.service'
import { BIRTH_DATE, monthAge } from '../utils/date'
import type {
  SkillDomain,
  SkillDomainGroup,
  SkillItem,
  SkillStatus,
} from '../types/skill'
import { DOMAIN_META, SKILL_CATALOG } from './skill-catalog'
import { classifySkillLabel } from './skill-classify'

/** 更新标记请求 */
export interface MarkSkillInput {
  status: SkillStatus | 'todo'
  markedAt?: string
  note?: string | null
}

/** 更新备注请求 */
export interface UpdateNoteInput {
  note?: string | null
}

/** 新建自定义技能 */
export interface CreateSkillInput {
  label: string
  /** 是否用 AI 选 emoji / 领域（默认 true） */
  useAi?: boolean
  domain?: SkillDomain
  emoji?: string
  status?: SkillStatus
  markedAt?: string
  note?: string | null
}

interface SkillRow {
  id: string
  domain: string
  label: string
  emoji: string | null
  typical_from: number | null
  typical_to: number | null
  sort_order: number
  is_custom?: number | null
  created_at?: string | null
}

interface MarkRow {
  skill_id: string
  status: string
  marked_at: string
  note: string | null
  updated_at: string | null
}

/** 技能地图：目录同步 + 标记读写 */
@Injectable()
export class SkillsService implements OnModuleInit {
  constructor(private readonly dbService: DbService) {}

  /** 启动时把目录 upsert 进表，并补档案已知标记 */
  onModuleInit() {
    this.migrateSkillsColumns()
    this.syncCatalog()
    this.seedArchiveMarks()
  }

  /**
   * 旧库补列：is_custom / created_at
   */
  private migrateSkillsColumns() {
    const cols = this.dbService.db
      .prepare(`PRAGMA table_info(skills)`)
      .all() as { name: string }[]
    const names = new Set(cols.map((c) => c.name))
    if (!names.has('is_custom')) {
      this.dbService.db.exec(
        `ALTER TABLE skills ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0`,
      )
    }
    if (!names.has('created_at')) {
      this.dbService.db.exec(`ALTER TABLE skills ADD COLUMN created_at TEXT`)
    }
  }

  /** 按领域分组返回技能地图 */
  listGrouped(): SkillDomainGroup[] {
    const skills = this.dbService.db
      .prepare('SELECT * FROM skills ORDER BY domain, sort_order, id')
      .all() as SkillRow[]

    const marks = this.dbService.db
      .prepare('SELECT * FROM skill_marks')
      .all() as MarkRow[]
    const markMap = new Map(marks.map((m) => [m.skill_id, m]))

    const byDomain = new Map<SkillDomain, SkillItem[]>()

    for (const row of skills) {
      const domain = row.domain as SkillDomain
      const mark = markMap.get(row.id)
      const status = (mark?.status as SkillStatus | undefined) ?? 'todo'
      const markedAt = mark?.marked_at ?? null
      const item: SkillItem = {
        id: row.id,
        domain,
        label: row.label,
        emoji: row.emoji ?? '🌱',
        typicalFrom: row.typical_from,
        typicalTo: row.typical_to,
        sortOrder: row.sort_order,
        isCustom: Boolean(row.is_custom),
        status,
        markedAt,
        note: mark?.note ?? null,
        monthAgeWhenMarked: markedAt
          ? monthAge(BIRTH_DATE, markedAt)
          : null,
      }
      const list = byDomain.get(domain) ?? []
      list.push(item)
      byDomain.set(domain, list)
    }

    return Object.entries(DOMAIN_META)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([domain, meta]) => {
        const items = byDomain.get(domain as SkillDomain) ?? []
        return {
          domain: domain as SkillDomain,
          label: meta.label,
          emoji: meta.emoji,
          items,
          doneCount: items.filter((i) => i.status === 'done').length,
          total: items.length,
        }
      })
      .filter((g) => g.total > 0)
  }

  /**
   * 更新或清除标记
   * status=todo 时删除标记行
   */
  mark(skillId: string, input: MarkSkillInput): SkillItem {
    const skill = this.dbService.db
      .prepare('SELECT * FROM skills WHERE id = ?')
      .get(skillId) as SkillRow | undefined
    if (!skill) {
      throw new NotFoundException('技能不存在')
    }

    if (input.status === 'todo') {
      this.dbService.db
        .prepare('DELETE FROM skill_marks WHERE skill_id = ?')
        .run(skillId)
    } else {
      const existing = this.dbService.db
        .prepare('SELECT * FROM skill_marks WHERE skill_id = ?')
        .get(skillId) as MarkRow | undefined
      const markedAt = input.markedAt || existing?.marked_at || new Date().toISOString()
      const now = new Date().toISOString()
      const note =
        input.note !== undefined ? input.note : (existing?.note ?? null)
      this.dbService.db
        .prepare(
          `INSERT INTO skill_marks (skill_id, status, marked_at, note, updated_at)
           VALUES (@skill_id, @status, @marked_at, @note, @updated_at)
           ON CONFLICT(skill_id) DO UPDATE SET
             status = excluded.status,
             marked_at = excluded.marked_at,
             note = excluded.note,
             updated_at = excluded.updated_at`,
        )
        .run({
          skill_id: skillId,
          status: input.status,
          marked_at: markedAt,
          note,
          updated_at: now,
        })
    }

    return this.requireItem(skillId)
  }

  /**
   * 更新备注（无标记时默认记为刚出现）
   */
  updateNote(skillId: string, note: string | null): SkillItem {
    const skill = this.dbService.db
      .prepare('SELECT * FROM skills WHERE id = ?')
      .get(skillId) as SkillRow | undefined
    if (!skill) {
      throw new NotFoundException('技能不存在')
    }

    const existing = this.dbService.db
      .prepare('SELECT * FROM skill_marks WHERE skill_id = ?')
      .get(skillId) as MarkRow | undefined
    const now = new Date().toISOString()
    const status = (existing?.status as SkillStatus | undefined) ?? 'emerging'
    const markedAt = existing?.marked_at ?? now
    const trimmed = note?.trim() ? note.trim().slice(0, 200) : null

    this.dbService.db
      .prepare(
        `INSERT INTO skill_marks (skill_id, status, marked_at, note, updated_at)
         VALUES (@skill_id, @status, @marked_at, @note, @updated_at)
         ON CONFLICT(skill_id) DO UPDATE SET
           note = excluded.note,
           updated_at = excluded.updated_at`,
      )
      .run({
        skill_id: skillId,
        status,
        marked_at: markedAt,
        note: trimmed,
        updated_at: now,
      })

    return this.requireItem(skillId)
  }

  /**
   * 删除自定义技能（目录项不可删）
   */
  removeCustom(skillId: string): { id: string } {
    const skill = this.dbService.db
      .prepare('SELECT * FROM skills WHERE id = ?')
      .get(skillId) as SkillRow | undefined
    if (!skill) {
      throw new NotFoundException('技能不存在')
    }
    if (!skill.is_custom) {
      throw new BadRequestException('目录技能不能删除，可改为「未观察」')
    }

    this.dbService.db
      .prepare('DELETE FROM skill_marks WHERE skill_id = ?')
      .run(skillId)
    this.dbService.db.prepare('DELETE FROM skills WHERE id = ?').run(skillId)
    return { id: skillId }
  }

  /** 从分组列表中取单条技能 */
  private requireItem(skillId: string): SkillItem {
    const groups = this.listGrouped()
    for (const g of groups) {
      const hit = g.items.find((i) => i.id === skillId)
      if (hit) {
        return hit
      }
    }
    throw new NotFoundException('技能不存在')
  }

  /**
   * 新建自定义技能（可选 AI 分类 emoji / 领域）
   */
  async createCustom(input: CreateSkillInput): Promise<SkillItem> {
    const raw = input.label?.trim()
    if (!raw) {
      throw new BadRequestException('请填写技能描述')
    }

    let label = raw.slice(0, 40)
    let domain: SkillDomain = input.domain ?? 'other'
    let emoji = input.emoji?.trim() ?? '🌱'

    if (input.useAi !== false) {
      const classified = await classifySkillLabel(raw)
      label = classified.label
      if (!input.domain) {
        domain = classified.domain
      }
      if (!input.emoji?.trim()) {
        emoji = classified.emoji
      }
    }

    if (!DOMAIN_META[domain]) {
      domain = 'other'
    }

    const id = `custom-${crypto.randomUUID()}`
    const sortOrder = this.nextSortOrder(domain)
    const now = new Date().toISOString()

    this.dbService.db
      .prepare(
        `INSERT INTO skills (
           id, domain, label, emoji, typical_from, typical_to, sort_order, is_custom, created_at
         ) VALUES (?, ?, ?, ?, NULL, NULL, ?, 1, ?)`,
      )
      .run(id, domain, label, emoji, sortOrder, now)

    const status: SkillStatus = input.status ?? 'emerging'
    const markedAt = input.markedAt ?? now
    this.dbService.db
      .prepare(
        `INSERT INTO skill_marks (skill_id, status, marked_at, note, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, status, markedAt, input.note ?? null, now)

    return this.requireItem(id)
  }

  /** 某领域下一个排序号 */
  private nextSortOrder(domain: SkillDomain): number {
    const row = this.dbService.db
      .prepare(
        `SELECT MAX(sort_order) AS max_order FROM skills WHERE domain = ?`,
      )
      .get(domain) as { max_order: number | null } | undefined
    return (row?.max_order ?? 0) + 10
  }

  /** 目录 upsert，不删用户自定义（本版无自定义） */
  private syncCatalog() {
    const upsert = this.dbService.db.prepare(
      `INSERT INTO skills (
         id, domain, label, emoji, typical_from, typical_to, sort_order
       ) VALUES (
         @id, @domain, @label, @emoji, @typical_from, @typical_to, @sort_order
       )
       ON CONFLICT(id) DO UPDATE SET
         domain = excluded.domain,
         label = excluded.label,
         emoji = excluded.emoji,
         typical_from = excluded.typical_from,
         typical_to = excluded.typical_to,
         sort_order = excluded.sort_order`,
    )

    const tx = this.dbService.db.transaction(() => {
      for (const s of SKILL_CATALOG) {
        upsert.run({
          id: s.id,
          domain: s.domain,
          label: s.label,
          emoji: s.emoji,
          typical_from: s.typicalFrom ?? null,
          typical_to: s.typicalTo ?? null,
          sort_order: s.sortOrder,
        })
      }
    })
    tx()
  }

  /**
   * 档案 2026-08-30 已确认掌握的技能，幂等写入 done
   */
  private seedArchiveMarks() {
    const archiveDate = '2026-08-30T12:00:00.000+08:00'
    const doneIds = [
      'gross-jump-two-feet',
      'gross-stairs-rail',
      'gross-kick-ball',
      'fine-blocks-7',
      'fine-lego-duplo',
      'fine-draw-line-circle',
      'fine-turn-pages',
      'fine-twist-cap',
      'lang-talk-lots',
      'lang-sing-along',
      'lang-en-words',
      'lang-what-sound',
      'cog-puzzle-9',
      'cog-love-books',
      'care-shoes',
      'care-pee-day',
      'care-brush-teeth',
      'soc-simple-play',
      'soc-not-shy',
    ]

    const insert = this.dbService.db.prepare(
      `INSERT OR IGNORE INTO skill_marks (skill_id, status, marked_at, note, updated_at)
       VALUES (?, 'done', ?, ?, ?)`,
    )

    let n = 0
    const tx = this.dbService.db.transaction(() => {
      for (const id of doneIds) {
        const r = insert.run(
          id,
          archiveDate,
          '来自档案 2026-08-30 评估',
          archiveDate,
        )
        n += r.changes
      }
    })
    tx()

    if (n > 0) {
      console.log(`[seed] 已写入 ${n} 条技能掌握标记（档案）`)
    }
  }
}
