import knex from 'knex';
export function connect() {
  return knex({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: { min: 0, max: 1 },
    acquireConnectionTimeout: 30000,
  });
}
