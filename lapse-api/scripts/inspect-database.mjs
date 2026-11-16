import knex from 'knex';

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  pool: { min: 0, max: 1 },
  acquireConnectionTimeout: 12000,
});
try {
  await db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY');
    await trx.raw("SET LOCAL statement_timeout = '10000ms'");
    const columns = await trx('information_schema.columns')
      .select(
        'table_name',
        'column_name',
        'data_type',
        'udt_name',
        'is_nullable',
        'column_default',
      )
      .where('table_schema', 'public')
      .orderBy(['table_name', 'ordinal_position']);
    const constraints = await trx.raw(
      "SELECT conrelid::regclass::text AS table_name, conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid, conname",
    );
    const indexes = await trx('pg_indexes')
      .select('tablename', 'indexname', 'indexdef')
      .where('schemaname', 'public');
    console.log(
      JSON.stringify(
        { columns, constraints: constraints.rows, indexes },
        null,
        2,
      ),
    );
    if (await trx.schema.withSchema('storage').hasTable('buckets')) {
      console.log(
        JSON.stringify({
          bucket: await trx('storage.buckets')
            .select('id', 'public')
            .where('id', 'lapse-bucket'),
        }),
      );
    }
  });
} catch (error) {
  console.error('Database inspection failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
