import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService extends Pool implements OnModuleDestroy {
  constructor() {
    super({
      connectionString: getPostgresUrl(),
    });
  }

  async onModuleDestroy() {
    await this.end();
  }
}

function getPostgresUrl() {
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const user = process.env.DB_USER ?? 'atlas';
  const password = process.env.DB_PASSWORD ?? 'atlas';
  const database = process.env.DB_NAME ?? 'atlas';

  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}
