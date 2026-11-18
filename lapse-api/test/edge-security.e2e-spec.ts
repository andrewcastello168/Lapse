import { createRequire } from 'node:module';
import knex, { type Knex } from 'knex';
import { describe, it, expect } from 'vitest';

describe.skipIf(process.env.RUN_DB_TESTS !== '1')(
  'migration bookkeeping security',
  () => {
    it('protects both existing metadata tables while retaining migration-runner access (rollback only)', async () => {
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
        acquireConnectionTimeout: 15000,
      });
      const trx = await db.transaction();
      try {
        await trx.raw("SET LOCAL lock_timeout = '3000ms'");
        await trx.raw("SET LOCAL statement_timeout = '10000ms'");
        const migration = createRequire(import.meta.url)(
          '../migrations/202611180002_migration_metadata_security.cjs',
        ) as { up: (db: Knex.Transaction) => Promise<void> };
        const before = await trx('knex_migrations')
          .select('id', 'name', 'batch')
          .orderBy('id');
        await migration.up(trx);
        const rows =
          await trx.raw(`SELECT c.relname AS name,c.relrowsecurity AS rls,
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_access,
        has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS authenticated_access,
        has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT')
          AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE') AS runner_crud
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('knex_migrations','knex_migrations_lock') ORDER BY c.relname`);
        expect(rows.rows).toHaveLength(2);
        for (const row of rows.rows)
          expect(row).toMatchObject({
            rls: true,
            anon_access: false,
            authenticated_access: false,
            runner_crud: true,
          });
        expect(
          await trx('knex_migrations')
            .select('id', 'name', 'batch')
            .orderBy('id'),
        ).toEqual(before);
        // Exercise UPDATE permission/RLS without changing values or adding records.
        await trx('knex_migrations_lock')
          .whereRaw('false')
          .update({ is_locked: 0 });
      } finally {
        await trx.rollback();
        await db.destroy();
      }
    });
  },
);
