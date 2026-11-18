// Read-only diagnostics: no emails, device registration, push, migrations or writes.
import { createHmac, randomUUID } from 'node:crypto';
import { connect } from '../src/database/connection.mjs';
const keys = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_FROM',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'PASSWORD_RESET_URL',
  'JWT_SECRET',
];
console.log(
  'Configuration presence:',
  Object.fromEntries(keys.map((key) => [key, !!process.env[key]?.trim()])),
);
const db = connect();
const configuredOrigin =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const projectRef = configuredOrigin
  ? new URL(configuredOrigin).hostname.split('.')[0]
  : '';
const dbUserRef = process.env.DB_USER?.split('.')[1];
const dbHostRef = process.env.DB_HOST?.match(
  /^db\.([a-z0-9]+)\.supabase\.co$/,
)?.[1];
console.log('Project alignment:', {
  databaseUserRefMatchesEdge: dbUserRef
    ? dbUserRef === projectRef
    : 'not encoded in username',
  databaseHostRefMatchesEdge: dbHostRef
    ? dbHostRef === projectRef
    : 'pooled host',
});
try {
  const snapshot = await db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY');
    await trx.raw("SET LOCAL statement_timeout = '10000ms'");
    const tables = {};
    for (const table of [
      'notification_preferences',
      'notification_devices',
      'notification_item_preferences',
      'notification_inbox',
      'notification_attempts',
      'auth_rate_limits',
      'password_reset_tokens',
    ])
      tables[table] = await trx.schema.hasTable(table);
    const account = await trx('master_users')
      .select('id', 'token_version')
      .where('is_active', true)
      .first();
    const privileges = await trx.raw(
      "SELECT name, has_table_privilege('service_role', 'public.' || name, 'SELECT') AS service_select FROM unnest(ARRAY['master_users','notification_preferences','notification_devices']) name",
    );
    console.log('Service role table access:', privileges.rows);
    const database = await trx.raw(
      "SELECT current_database()='postgres' AS uses_default_supabase_database",
    );
    console.log('Data API database alignment:', database.rows[0]);
    const apiSettings = await trx.raw(
      "SELECT COALESCE(array_agg(setting) FILTER (WHERE setting LIKE 'pgrst.db_schemas=%'),ARRAY[]::text[]) AS exposed_schema_settings FROM pg_db_role_setting r CROSS JOIN LATERAL unnest(r.setconfig) setting WHERE r.setrole=(SELECT oid FROM pg_roles WHERE rolname='authenticator')",
    );
    console.log('PostgREST exposed schema settings:', apiSettings.rows[0]);
    const security = await trx.raw(
      "SELECT c.relname AS name,c.relrowsecurity AS rls,has_table_privilege('anon',c.oid,'SELECT') AS anonymous_select,has_table_privilege('authenticated',c.oid,'SELECT') AS supabase_authenticated_select FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('master_users','master_refresh_tokens','master_categories','master_items','user_items','password_reset_tokens') ORDER BY c.relname",
    );
    console.log('Core table Data API security:', security.rows);
    const locks = await trx.raw(
      "SELECT pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers,CASE WHEN query ILIKE '%notification_item_preferences%' THEN 'item reminder query' WHEN query ILIKE '%notification_preferences%' THEN 'account reminder query' ELSE 'other query' END AS operation FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
    );
    console.log('Database lock waits:', locks.rows);
    return {
      tables,
      account,
      items: Number(
        (await trx('user_items').count('* as count').first()).count,
      ),
    };
  });
  console.log('Schema:', snapshot.tables, 'item count:', snapshot.items);
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const url =
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const result = await fetch(
      `${url}/rest/v1/master_users?select=id&limit=0`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    const body = await result.json().catch(() => ({}));
    console.log('Read-only local service-key REST check:', {
      status: result.status,
      code: body.code,
    });
  }
  const origin =
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (origin && snapshot.account && process.env.JWT_SECRET) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: snapshot.account.id,
        ver: snapshot.account.token_version,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString('base64url');
    const content = `${header}.${payload}`;
    const signature = createHmac('sha256', process.env.JWT_SECRET)
      .update(content)
      .digest('base64url');
    for (const action of ['preferences', 'inbox', 'register']) {
      const response = await fetch(
        `${origin.replace(/\/$/, '')}/functions/v1/notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${content}.${signature}`,
          },
          // Invalid registration can only reach validation; it cannot persist a device.
          body: JSON.stringify(
            action === 'register'
              ? { action, deviceId: 'invalid', token: '', enabled: true }
              : { action },
          ),
          signal: AbortSignal.timeout(12000),
        },
      );
      const body = await response.json().catch(() => ({}));
      console.log('Read-only Edge probe:', {
        action,
        status: response.status,
        // Only known diagnostic fields, never account data/tokens/preference values.
        message:
          typeof body.message === 'string'
            ? body.message.slice(0, 200)
            : undefined,
        configured: body.configured,
        initialized: body.initialized,
      });
      const expected = action === 'register' ? 400 : 200;
      if (response.status !== expected) process.exitCode = 1;
      if (body.configured === true) {
        console.log('Unexpected scheduling configuration: enabled');
        process.exitCode = 1;
      }
    }
    for (const authorization of [null, 'Bearer invalid-jwt']) {
      const response = await fetch(
        `${origin.replace(/\/$/, '')}/functions/v1/notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
          },
          body: JSON.stringify({ action: 'preferences' }),
          signal: AbortSignal.timeout(12000),
        },
      );
      await response.arrayBuffer();
      console.log('Edge rejects unauthorized request:', {
        kind: authorization ? 'invalid JWT' : 'missing JWT',
        status: response.status,
        passed: response.status === 401,
      });
      if (response.status !== 401) process.exitCode = 1;
    }
    const probeDevice = randomUUID();
    const collision = await db('notification_devices')
      .select('id')
      .where('id', probeDevice)
      .first();
    if (collision) throw new Error('diagnostic device must not exist');
    const validations = [
      { action: 'save-preferences', body: { preferences: {} }, expected: 400 },
      // The owned-device lookup returns no device, before any claim/provider work.
      {
        action: 'test',
        body: { deviceId: probeDevice, requestId: randomUUID() },
        expected: 404,
      },
    ];
    for (const validation of validations) {
      const response = await fetch(
        `${origin.replace(/\/$/, '')}/functions/v1/notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${content}.${signature}`,
          },
          body: JSON.stringify({
            action: validation.action,
            ...validation.body,
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      const body = await response.json().catch(() => ({}));
      console.log('Non-mutating Edge validation:', {
        action: validation.action,
        status: response.status,
        message:
          typeof body.message === 'string'
            ? body.message.slice(0, 200)
            : undefined,
        passed: response.status === validation.expected,
      });
      if (response.status !== validation.expected) process.exitCode = 1;
    }
  }
} catch (error) {
  console.error('Read-only audit failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
