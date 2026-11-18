// Read-only Supabase CLI metadata; never print secrets, digests or CLI errors
// that could include account details. Uses existing CLI login only.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const origin = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const ref = new URL(origin).hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(ref))
  throw new Error('Expected the existing hosted Supabase project');
function inspect(command) {
  const result = spawnSync(
    'pnpm.cmd',
    ['dlx', 'supabase', ...command, '--project-ref', ref, '--output', 'json'],
    {
      shell: true,
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    },
  );
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}
const secrets = inspect(['secrets', 'list']);
if (Array.isArray(secrets)) {
  const jwt = secrets.find((row) => row.name === 'JWT_SECRET');
  const digest = createHash('sha256')
    .update(process.env.JWT_SECRET ?? '')
    .digest('hex');
  const remoteDigest = jwt?.digest ?? jwt?.value;
  const isDigest =
    typeof remoteDigest === 'string' && /^[a-f0-9]{64}$/i.test(remoteDigest);
  console.log({
    deployedJwtSecretPresent: !!jwt,
    jwtSecretDigestMatches: isDigest
      ? remoteDigest.toLowerCase() === digest
      : 'digest unavailable',
    scheduledFlagPresent: secrets.some(
      (row) => row.name === 'SCHEDULED_PUSH_ENABLED',
    ),
    scheduledPushDisabled: secrets.some(
      (row) =>
        row.name === 'SCHEDULED_PUSH_ENABLED' &&
        (row.digest ?? row.value) ===
          createHash('sha256').update('false').digest('hex'),
    ),
  });
} else
  console.log(
    'Secret digest comparison unavailable: existing CLI management access is not available.',
  );
const functions = inspect(['functions', 'list']);
if (Array.isArray(functions)) {
  const fn = functions.find(
    (row) => row.slug === 'notifications' || row.name === 'notifications',
  );
  console.log(
    'Deployed notification metadata:',
    fn
      ? {
          version: fn.version,
          status: fn.status,
          verify_jwt: fn.verify_jwt,
          updated_at: fn.updated_at,
        }
      : 'not found',
  );
} else
  console.log(
    'Function metadata unavailable: existing CLI management access is not available.',
  );
// The archived pre-release source snapshot is historical, not a comparison
// against this live version. Never infer current code drift from that snapshot.
// Avoid CLI source unbundling because artifacts may retain absolute paths.
