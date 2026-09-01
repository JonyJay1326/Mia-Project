import { Injectable } from '@nestjs/common'
import { DbService } from '../db/db.service'
import type { EventInput, EventRecord, EventRow } from '../types/event'
import { BIRTH_DATE, monthAge, stringifyJsonArray } from '../utils/date'
import { mapEventRow } from '../utils/mappers'

/** 事件列表查询参数 */
interface ListParams {
  limit: number
  before?: string
  type?: string
}

/** 事件表读写服务 */
@Injectable()
export class EventsService {
  constructor(private readonly dbService: DbService) {}

  /**
   * 幂等创建：INSERT OR IGNORE，已存在则返回现有记录
   */
  create(input: EventInput): EventRecord {
    const now = new Date().toISOString()
    const happenedAt = input.happenedAt || now
    const age = input.monthAge ?? monthAge(BIRTH_DATE, happenedAt)

    this.dbService.db
      .prepare(
        `INSERT OR IGNORE INTO events (
          id, happened_at, type, summary, chips, location, trigger,
          intensity, duration_min, coping, outcome, caregiver, napped,
          month_age, created_at, updated_at
        ) VALUES (
          @id, @happened_at, @type, @summary, @chips, @location, @trigger,
          @intensity, @duration_min, @coping, @outcome, @caregiver, @napped,
          @month_age, @created_at, @updated_at
        )`,
      )
      .run({
        id: input.id,
        happened_at: happenedAt,
        type: input.type,
        summary: input.summary ?? null,
        chips: stringifyJsonArray(input.chips),
        location: input.location ?? null,
        trigger: input.trigger ?? null,
        intensity: input.intensity ?? null,
        duration_min: input.durationMin ?? null,
        coping: stringifyJsonArray(input.coping),
        outcome: input.outcome ?? null,
        caregiver: input.caregiver,
        napped: input.napped ?? null,
        month_age: age,
        created_at: now,
        updated_at: null,
      })

    return this.findById(input.id) as EventRecord
  }

  /** 分页列表 */
  list(params: ListParams): EventRecord[] {
    const limit = Math.min(Math.max(params.limit || 50, 1), 100)
    const clauses: string[] = []
    const binds: Record<string, string | number> = { limit }

    if (params.before) {
      clauses.push('happened_at < @before')
      binds.before = params.before
    }
    if (params.type) {
      clauses.push('type = @type')
      binds.type = params.type
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = this.dbService.db
      .prepare(
        `SELECT * FROM events ${where} ORDER BY happened_at DESC LIMIT @limit`,
      )
      .all(binds) as EventRow[]

    return rows.map(mapEventRow)
  }

  /** 按主键查询 */
  findById(id: string): EventRecord | null {
    const row = this.dbService.db
      .prepare('SELECT * FROM events WHERE id = ?')
      .get(id) as EventRow | undefined
    return row ? mapEventRow(row) : null
  }

  /** 部分更新可填字段 */
  update(id: string, patch: Partial<EventInput>): EventRecord | null {
    const existing = this.findById(id)
    if (!existing) {
      return null
    }

    const next: EventRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      chips: patch.chips ?? existing.chips,
      coping: patch.coping ?? existing.coping,
      happenedAt: patch.happenedAt ?? existing.happenedAt,
      monthAge:
        patch.monthAge ??
        monthAge(BIRTH_DATE, patch.happenedAt ?? existing.happenedAt),
      updatedAt: new Date().toISOString(),
    }

    this.dbService.db
      .prepare(
        `UPDATE events SET
          happened_at = @happened_at,
          type = @type,
          summary = @summary,
          chips = @chips,
          location = @location,
          trigger = @trigger,
          intensity = @intensity,
          duration_min = @duration_min,
          coping = @coping,
          outcome = @outcome,
          caregiver = @caregiver,
          napped = @napped,
          month_age = @month_age,
          updated_at = @updated_at
        WHERE id = @id`,
      )
      .run({
        id,
        happened_at: next.happenedAt,
        type: next.type,
        summary: next.summary ?? null,
        chips: stringifyJsonArray(next.chips),
        location: next.location ?? null,
        trigger: next.trigger ?? null,
        intensity: next.intensity ?? null,
        duration_min: next.durationMin ?? null,
        coping: stringifyJsonArray(next.coping),
        outcome: next.outcome ?? null,
        caregiver: next.caregiver,
        napped: next.napped ?? null,
        month_age: next.monthAge,
        updated_at: next.updatedAt,
      })

    return this.findById(id)
  }

  /** 删除，返回是否删到了行 */
  remove(id: string): boolean {
    const result = this.dbService.db
      .prepare('DELETE FROM events WHERE id = ?')
      .run(id)
    return result.changes > 0
  }
}
