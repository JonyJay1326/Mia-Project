import { Global, Module } from '@nestjs/common'
import { DbService } from './db.service'

/** 全局数据库模块，各业务模块可直接注入 DbService */
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
