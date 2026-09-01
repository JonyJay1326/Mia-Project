import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** SQLite 封装：启动时建库建表，开启 WAL */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: Database.Database

  constructor() {
    const dir = join(process.cwd(), 'data')
    mkdirSync(dir, { recursive: true })

    this.db = new Database(join(dir, 'mia.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    const schemaPath = join(__dirname, 'schema.sql')
    this.db.exec(readFileSync(schemaPath, 'utf-8'))
  }

  /** 进程退出时关闭数据库连接 */
  onModuleDestroy() {
    this.db.close()
  }
}
