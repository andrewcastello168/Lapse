import { Provider } from '@nestjs/common';
import knex, { Knex } from 'knex';
import pg from 'pg';

// PostgreSQL DATE is a calendar value. Never convert it through the server's TZ.
pg.types.setTypeParser(1082, (value: string) => value);

export const DATABASE = 'DATABASE';

export const databaseProvider: Provider = {
  provide: DATABASE,

  useFactory: async (): Promise<Knex> => {
    const db = knex({
      client: 'pg',
      connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
      pool: {
        min: 2,
        max: 10,
      },
    });

    await db.raw('SELECT 1');
    console.log('✅ Supabase PostgreSQL connected');
    return db;
  },
};
