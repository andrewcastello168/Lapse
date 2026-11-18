// Read-only release gate. Never prints credentials, JWTs or user records.
import { connect } from '../src/database/connection.mjs';
const db = connect();
const expected = [
  'master_users',
  'master_refresh_tokens',
  'password_reset_tokens',
  'master_categories',
  'master_items',
  'user_items',
  'notification_preferences',
  'notification_devices',
  'notification_item_preferences',
  'notification_inbox',
  'notification_attempts',
  'auth_rate_limits',
];
try {
  await db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY');
    await trx.raw("SET LOCAL statement_timeout = '10000ms'");
    const history = await trx('knex_migrations')
      .select('name', 'batch')
      .orderBy('id');
    console.log('Migration history:', history);
    const tables = await trx.raw(`
      SELECT c.relname AS name, c.relrowsecurity AS rls,
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS anon_access,
        has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS authenticated_access,
        has_table_privilege('service_role',c.oid,'SELECT')
          AND has_table_privilege('service_role',c.oid,'INSERT')
          AND has_table_privilege('service_role',c.oid,'UPDATE')
          AND has_table_privilege('service_role',c.oid,'DELETE') AS service_crud
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname`);
    console.log('Public tables/views:', tables.rows);
    const roles =
      await trx.raw(`SELECT rolname AS name,rolbypassrls AS bypasses_rls,
      has_schema_privilege(rolname,'public','USAGE') AS public_usage,
      rolname=current_user AS api_connection_role
      FROM pg_roles WHERE rolname IN ('service_role',current_user)`);
    console.log('Service/API roles:', roles.rows);
    await trx.raw('SET LOCAL ROLE service_role');
    for (const table of expected)
      await trx.withSchema('public').from(table).select('*').limit(0);
    await trx.raw('RESET ROLE');
    console.log('Actual service-role reads:', {
      tablesChecked: expected.length,
      passed: true,
    });
    const functions =
      await trx.raw(`SELECT p.proname AS name,p.prosecdef AS security_definer,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
      pg_get_function_result(p.oid) AS returns
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' ORDER BY p.proname`);
    console.log('Public function access:', functions.rows);
    const migrationApplied = history.some(
      (row) => row.name === '202611180001_edge_data_api_security.cjs',
    );
    const domainTablesProtected = expected.every((name) =>
      tables.rows.some(
        (row) =>
          row.name === name &&
          row.rls &&
          !row.anon_access &&
          !row.authenticated_access &&
          row.service_crud,
      ),
    );
    const extraExposure = tables.rows.filter(
      (row) =>
        !expected.includes(row.name) &&
        (row.anon_access || row.authenticated_access),
    );
    const rpc = functions.rows.filter((row) =>
      row.name.startsWith('lapse_push_'),
    );
    const rpcProtected =
      rpc.length === 5 &&
      rpc.every(
        (row) =>
          !row.anon_execute &&
          !row.authenticated_execute &&
          row.service_execute,
      );
    const metadataProtected = ['knex_migrations', 'knex_migrations_lock'].every(
      (name) =>
        tables.rows.some(
          (row) =>
            row.name === name &&
            row.rls &&
            !row.anon_access &&
            !row.authenticated_access,
        ),
    );
    console.log('Security gate:', {
      migrationApplied,
      domainTablesProtected,
      rpcProtected,
      metadataProtected,
      additionalExposedObjects: extraExposure.map((row) => row.name),
    });
    if (
      !migrationApplied ||
      !domainTablesProtected ||
      !rpcProtected ||
      !metadataProtected ||
      extraExposure.length
    )
      process.exitCode = 1;
  });
} catch (error) {
  console.error(
    'Read-only security verification failed:',
    error.code ?? error.name,
  );
  process.exitCode = 1;
} finally {
  await db.destroy();
}
