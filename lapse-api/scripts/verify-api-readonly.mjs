// Existing account data stays in memory. No login/refresh/device/mutation calls.
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { connect } from '../src/database/connection.mjs';
const db = connect();
try {
  const account = await db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY');
    await trx.raw("SET LOCAL statement_timeout = '10000ms'");
    return trx('master_users')
      .select('id', 'token_version')
      .where('is_active', true)
      .first();
  });
  if (!account || !process.env.JWT_SECRET)
    throw new Error('no diagnostic account/configuration');
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = await jwt.signAsync(
    { sub: account.id, ver: account.token_version },
    { expiresIn: '60s' },
  );
  const origin = `http://127.0.0.1:${Number(process.env.PORT ?? 3000)}`;
  for (const path of [
    '/auth/me',
    '/categories',
    '/items',
    '/user-items',
    '/notifications/preferences',
  ]) {
    const response = await fetch(origin + path, {
      headers: { Authorization: `Bearer ${token}`, 'X-Timezone': 'UTC' },
      signal: AbortSignal.timeout(10000),
    });
    await response.arrayBuffer();
    console.log('Running API read:', {
      path,
      status: response.status,
      passed: response.status === 200,
    });
    if (response.status !== 200) process.exitCode = 1;
  }
  const denied = await fetch(origin + '/user-items', {
    signal: AbortSignal.timeout(10000),
  });
  console.log('Running API rejects missing JWT:', {
    status: denied.status,
    passed: denied.status === 401,
  });
  if (denied.status !== 401) process.exitCode = 1;
  const missing = await fetch(origin + '/user-items/' + randomUUID(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  console.log('Running API rejects unavailable owned item:', {
    status: missing.status,
    passed: missing.status === 404,
  });
  if (missing.status !== 404) process.exitCode = 1;
} catch (error) {
  console.error(
    'Read-only API verification incomplete:',
    error.code ?? error.name,
  );
  process.exitCode = 1;
} finally {
  await db.destroy();
}
