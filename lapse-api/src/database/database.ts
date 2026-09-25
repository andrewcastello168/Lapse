import { Provider } from '@nestjs/common';
import knex, { Knex } from 'knex';

export const DATABASE = 'DATABASE';

export const databaseProvider: Provider = {
  provide: DATABASE,

  useFactory: async (): Promise<Knex> => {
    // console.log(process.env.DB_HOST);
    // console.log(process.env.DB_PORT);
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
