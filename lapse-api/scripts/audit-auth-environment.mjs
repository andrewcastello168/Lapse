// No secret values or digests are printed. Run WITHOUT --env-file so inherited
// environment and Nest's dotenv parsing can be compared independently.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../dist/auth/auth.module.js';
import { DATABASE } from '../dist/database/database.js';
const dotenv = createRequire(import.meta.resolve('@nestjs/config'))('dotenv');
const filename = path.resolve('.env');
const raw = fs.readFileSync(filename, 'utf8');
const parsed = dotenv.parse(raw);
const inherited = process.env.JWT_SECRET;
const hash = (value) =>
  createHash('sha256')
    .update(value ?? '')
    .digest('hex');
const module = await Test.createTestingModule({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
})
  .overrideProvider(DATABASE)
  .useValue({})
  .compile();
try {
  const configured = module.get(ConfigService).getOrThrow('JWT_SECRET');
  const jwt = module.get(JwtService);
  const probe = await jwt.signAsync({
    sub: '00000000-0000-4000-8000-000000000001',
    ver: 0,
  });
  let fileVerifiesNestToken = false;
  try {
    await jwt.verifyAsync(probe, { secret: parsed.JWT_SECRET });
    fileVerifiesNestToken = true;
  } catch {
    /* bool only */
  }
  console.log({
    cwdIsApi: path.basename(process.cwd()) === 'lapse-api',
    inheritedJwtPresent: !!inherited,
    fileJwtDefinitions: (raw.match(/^\s*(?:export\s+)?JWT_SECRET\s*=/gm) ?? [])
      .length,
    nestConfigMatchesParsedFile: hash(configured) === hash(parsed.JWT_SECRET),
    fileVerifiesNestToken,
    nestUsesInheritedOverride:
      !!inherited && hash(configured) === hash(inherited),
  });
  const origin = parsed.EXPO_PUBLIC_SUPABASE_URL ?? parsed.SUPABASE_URL;
  const ref = new URL(origin).hostname.split('.')[0];
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('Expected hosted project');
  const result = spawnSync(
    'pnpm.cmd',
    [
      'dlx',
      'supabase',
      'secrets',
      'list',
      '--project-ref',
      ref,
      '--output',
      'json',
    ],
    { shell: true, encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  const secrets = JSON.parse(result.stdout);
  const remote = secrets.find((row) => row.name === 'JWT_SECRET');
  const digest = remote?.digest ?? remote?.value;
  const lineValue = raw
    .match(/^\s*JWT_SECRET\s*=(.*)$/m)?.[1]
    ?.replace(/\r$/, '');
  console.log('Parsing diagnosis:', {
    unquotedHashSuffix:
      !/^['"]/.test(lineValue?.trim() ?? '') &&
      lineValue?.includes('#') &&
      lineValue.split('#')[0].trim() === parsed.JWT_SECRET,
  });
  const variants = {
    parsedFile: parsed.JWT_SECRET,
    nestRuntime: configured,
    wholeUnparsedAssignmentValue: lineValue,
    parsedFileWithDoubleQuotes: JSON.stringify(parsed.JWT_SECRET),
    parsedFileWithLF: parsed.JWT_SECRET + '\n',
    parsedFileWithCRLF: parsed.JWT_SECRET + '\r\n',
  };
  console.log(
    'Deployed digest matches:',
    Object.fromEntries(
      Object.entries(variants).map(([label, value]) => [
        label,
        hash(value) === digest,
      ]),
    ),
  );
  console.log(
    'Scheduling-disabled digest matches:',
    secrets.some(
      (row) =>
        row.name === 'SCHEDULED_PUSH_ENABLED' &&
        (row.digest ?? row.value) === hash('false'),
    ),
  );
} finally {
  await module.close();
}
