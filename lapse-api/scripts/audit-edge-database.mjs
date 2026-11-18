// Read-only privileged REST diagnostics. Keys stay in process memory and are
// never printed, saved to disk, included in errors or passed on command lines.
import { spawnSync } from 'node:child_process';
const origin = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ref = new URL(origin).hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('Expected hosted project');
function list(args) {
  const result = spawnSync(
    'pnpm.cmd',
    ['dlx', 'supabase', ...args, `--remote=${ref}`, '--output', 'json'],
    { shell: true, encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}
const keys = list(['projects', 'api-keys', '--reveal']);
if (!Array.isArray(keys)) {
  console.log('REST diagnostics unavailable with existing CLI access');
  process.exit(1);
}
const roles = ['service_role', 'anon'];
const credentials = new Map(
  roles.map((role) => {
    const found = keys.find((entry) => entry.name === role);
    return [role, found?.api_key ?? found?.value];
  }),
);
if (
  roles.some(
    (role) =>
      typeof credentials.get(role) !== 'string' ||
      !credentials.get(role).startsWith('eyJ'),
  )
) {
  console.log('Required legacy REST credentials unavailable');
  process.exit(1);
}
const tables = [
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
  'knex_migrations',
  'knex_migrations_lock',
];
// Inspect runtime schema selection independently of stored role overrides.
for (const schema of [null, 'public', '__lapse_schema_probe__']) {
  const key = credentials.get('service_role');
  try {
    const response = await fetch(
      `${origin}/rest/v1/master_users?select=id&limit=0`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          ...(schema ? { 'Accept-Profile': schema } : {}),
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    const body = await response.json().catch(() => null);
    console.log('PostgREST runtime schema probe:', {
      requestedSchema: schema ?? 'default',
      status: response.status,
      code: typeof body?.code === 'string' ? body.code : undefined,
      runtimeSchemaMessage:
        ['PGRST106', 'PGRST205'].includes(body?.code) &&
        typeof body.message === 'string'
          ? body.message
          : undefined,
      runtimeSchemaDetails:
        body?.code === 'PGRST106' && typeof body.details === 'string'
          ? body.details.slice(0, 300)
          : undefined,
    });
  } catch {
    console.log('PostgREST runtime schema probe:', {
      requestedSchema: schema ?? 'default',
      transportFailed: true,
    });
  }
}
const checks = roles.flatMap((role) =>
  tables.map((table) => ({ role, table })),
);
let passed = 0;
for (let offset = 0; offset < checks.length; offset += 4) {
  await Promise.all(
    checks.slice(offset, offset + 4).map(async ({ role, table }) => {
      try {
        const key = credentials.get(role);
        const response = await fetch(
          `${origin}/rest/v1/${table}?select=*&limit=0`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Accept-Profile': 'public',
            },
            signal: AbortSignal.timeout(10000),
          },
        );
        const body = await response.json().catch(() => null);
        // A gateway rejection of a bad key is not proof of table access denial.
        const ok =
          role === 'service_role'
            ? response.status === 200 &&
              Array.isArray(body) &&
              body.length === 0
            : [401, 403].includes(response.status) && body?.code === '42501';
        if (ok) passed++;
        else process.exitCode = 1;
        console.log('Read-only Data API probe:', {
          role,
          table,
          status: response.status,
          code: typeof body?.code === 'string' ? body.code : undefined,
          passed: ok,
        });
      } catch {
        console.log('Read-only Data API probe:', {
          role,
          table,
          transportFailed: true,
        });
        process.exitCode = 1;
      }
    }),
  );
}
console.log('REST security checks:', {
  passed,
  total: checks.length,
  allPassed: passed === checks.length,
});
