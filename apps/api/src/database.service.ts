import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
@Injectable()
export class DatabaseService extends Pool implements OnModuleDestroy {
  constructor() { super({ connectionString: process.env.POSTGRES_URL }); }
  async onModuleDestroy() { await this.end(); }
}
