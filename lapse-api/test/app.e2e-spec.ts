import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import knex, { type Knex } from 'knex';
import { AuthModule } from '../src/auth/auth.module.js';
import { UserItemsModule } from '../src/user-items/user-items.module.js';
import { TimelineModule } from '../src/timeline/timeline.module.js';
import { CategoriesModule } from '../src/categories/categories.module.js';
import { ItemsModule } from '../src/items/items.module.js';
import { DATABASE } from '../src/database/database.js';
import { DatabaseExceptionFilter } from '../src/database/database-exception.filter.js';
import { todayInZone, addDays } from '../src/expiration/calendar.js';

// Opt-in integration suite. Every fixture is created inside one outer
// transaction and rolled back; existing user/catalog data is never mutated.
describe.skipIf(process.env.RUN_DB_TESTS !== '1')(
  'live PostgreSQL HTTP integration',
  () => {
    let app: INestApplication;
    let db: Knex;
    let trx: Knex.Transaction;
    let server: Server;
    let access: string;
    let other: string;
    let refresh: string;
    let userId: string;
    let category: number;
    let itemId: string;
    let resetMail = '';
    const email = 'lapse-test-' + randomUUID() + '@example.test';
    const password = 'Lapse-test-passphrase-42';
    const smtp = createServer((socket) => {
      socket.setEncoding('utf8');
      socket.write('220 localhost ESMTP\r\n');
      let buffer = '';
      let data = false;
      let message = '';
      socket.on('data', (chunk) => {
        buffer += chunk;
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 2);
          if (data) {
            if (line === '.') {
              resetMail = message;
              data = false;
              socket.write('250 accepted\r\n');
            } else message += line + '\r\n';
          } else if (/^EHLO|^HELO/.test(line))
            socket.write('250-localhost\r\n250 OK\r\n');
          else if (line.startsWith('DATA')) {
            data = true;
            message = '';
            socket.write('354 send mail\r\n');
          } else if (line.startsWith('QUIT')) {
            socket.end('221 bye\r\n');
          } else socket.write('250 OK\r\n');
        }
      });
    });
    beforeAll(async () => {
      smtp.listen(0, '127.0.0.1');
      await once(smtp, 'listening');
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = String((smtp.address() as AddressInfo).port);
      process.env.SMTP_FROM = 'Lapse <test@example.test>';
      process.env.SMTP_ALLOW_INSECURE = 'true';
      process.env.PASSWORD_RESET_URL = 'lapsemobile://auth';
      db = knex({
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
      trx = await db.transaction();
      const module = await Test.createTestingModule({
        imports: [
          AuthModule,
          UserItemsModule,
          TimelineModule,
          CategoriesModule,
          ItemsModule,
        ],
      })
        .overrideProvider(DATABASE)
        .useValue(trx)
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      app.useGlobalFilters(new DatabaseExceptionFilter());
      await app.init();
      server = app.getHttpServer() as Server;
      const catalog = await trx('master_categories')
        .select('id')
        .where('is_active', true)
        .first();
      category = catalog.id;
      await request(server)
        .post('/auth/signup')
        .send({ name: 'Integration owner', email, password })
        .expect(201);
      const login = await request(server)
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      access = login.body.accessToken;
      refresh = login.body.refreshToken;
      userId = login.body.user.id;
      const second = 'other-' + email;
      await request(server)
        .post('/auth/signup')
        .send({ name: 'Other owner', email: second, password })
        .expect(201);
      other = (
        await request(server)
          .post('/auth/login')
          .send({ email: second, password })
          .expect(201)
      ).body.accessToken;
    }, 60000);
    afterAll(async () => {
      if (app) await app.close();
      if (trx) await trx.rollback();
      if (db) await db.destroy();
      smtp.close();
    });
    const auth = (
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
      token = access,
    ) =>
      request(server)
        [method](path)
        .set('Authorization', 'Bearer ' + token)
        .set('X-Timezone', 'Asia/Jakarta');
    it('validates runtime auth DTOs and isolates catalogs/items', async () => {
      await request(server)
        .post('/auth/signup')
        .send({ name: '', email: 'bad', password: 'x' })
        .expect(400);
      await request(server).get('/user-items').expect(401);
      const catalog = await auth('get', '/categories').expect(200);
      expect(catalog.body[0]).toHaveProperty('image_url');
      const masters = await auth('get', '/items').expect(200);
      expect(masters.body[0]).toHaveProperty('expiry_type');
      const catalogItem = await auth('post', '/user-items')
        .send({ miId: masters.body[0].id, expiryType: 'NEVER' })
        .expect(201);
      expect(catalogItem.body.item_name).toBe(masters.body[0].name);
      expect(catalogItem.body.image_url).toContain('/lapse-bucket/');
      await auth('delete', '/user-items/' + catalogItem.body.id).expect(200);
      const created = await auth('post', '/user-items')
        .send({
          mcId: category,
          itemName: 'Annual permit',
          expiryType: 'RECURRING',
          expiryDate: '2024-11-07',
          recurrenceYears: 1,
          recurrenceMonths: 0,
          recurrenceDays: 0,
          renewalMode: 'MANUAL',
        })
        .expect(201);
      itemId = created.body.id;
      expect(created.body.expiration_status).toBe('OVERDUE');
      expect(created.body.recurrence_months).toBe(0);
      await auth('get', '/user-items/' + itemId, other).expect(404);
      await auth('patch', '/user-items/' + itemId, other)
        .send({ itemName: 'stolen' })
        .expect(404);
      await auth('delete', '/user-items/' + itemId, other).expect(404);
      await auth('post', '/user-items')
        .send({
          mcId: category,
          itemName: 'Invalid',
          expiryType: 'RECURRING',
          expiryDate: '2026-02-30',
          recurrenceDays: 1,
        })
        .expect(400);
    });
    it('rejects duplicate/stale renewal and preserves anchor even after late renewal', async () => {
      await auth('post', '/user-items/' + itemId + '/renew')
        .send({
          expected_expiry_date: '2024-11-07',
          new_expiry_date: '2025-11-07',
        })
        .expect(201);
      const item = (await auth('get', '/user-items/' + itemId).expect(200))
        .body;
      expect(item.expiry_date).toBe('2024-11-07');
      expect(item.renewed_through).toBe('2025-11-07');
      expect(item.expiration_status).toBe('OVERDUE');
      await auth('post', '/user-items/' + itemId + '/renew')
        .send({
          expected_expiry_date: '2024-11-07',
          new_expiry_date: '2025-11-07',
        })
        .expect(409);
      await auth('post', '/user-items/' + itemId + '/renew', other)
        .send({
          expected_expiry_date: '2025-11-07',
          new_expiry_date: '2027-11-07',
        })
        .expect(404);
      await auth('patch', '/user-items/' + itemId)
        .send({ itemName: 'Renamed permit' })
        .expect(200);
      expect(
        (await auth('get', '/user-items/' + itemId)).body.renewed_through,
      ).toBe('2025-11-07');
      await auth('patch', '/user-items/' + itemId)
        .send({ recurrenceMonths: 1 })
        .expect(409);
      await auth('patch', '/user-items/' + itemId)
        .send({
          recurrenceMonths: 1,
          resetConfirmation: true,
          expectedRenewedThrough: '2025-11-07',
        })
        .expect(200);
      expect(
        (await auth('get', '/user-items/' + itemId)).body.renewed_through,
      ).toBeNull();
    });
    it('handles NEVER and ONCE, exact timezone, bounded counts, zero components and reminder plans', async () => {
      const never = await auth('post', '/user-items')
        .send({ mcId: category, itemName: 'Lifetime', expiryType: 'NEVER' })
        .expect(201);
      expect(never.body.can_renew).toBe(false);
      await auth('post', '/user-items/' + never.body.id + '/renew')
        .send({
          expected_expiry_date: '2026-01-01',
          new_expiry_date: '2027-01-01',
        })
        .expect(400);
      const once = await auth('post', '/user-items')
        .send({
          mcId: category,
          itemName: 'Passport',
          expiryType: 'ONCE',
          expiryDate: '2026-01-01',
        })
        .expect(201);
      await auth('post', '/user-items/' + once.body.id + '/renew')
        .send({
          expected_expiry_date: '2026-01-01',
          new_expiry_date: '2030-01-01',
        })
        .expect(201);
      const today = todayInZone('Asia/Jakarta');
      const due = addDays(today, 20);
      const auto = await auth('post', '/user-items')
        .send({
          mcId: category,
          itemName: 'Automatic',
          expiryType: 'RECURRING',
          expiryDate: due,
          recurrenceMonths: 1,
          recurrenceYears: 0,
          recurrenceDays: 0,
        })
        .expect(201);
      await auth('post', '/user-items/' + auto.body.id + '/renew')
        .send({ expected_expiry_date: due, new_expiry_date: '2030-01-01' })
        .expect(400);
      const timeline = await auth('get', '/timeline?window=3M&limit=1').expect(
        200,
      );
      expect(timeline.body.total).toBeGreaterThan(1);
      expect(timeline.body.data).toHaveLength(1);
      expect(timeline.body.hasMore).toBe(true);
      await auth('get', '/timeline?from=2026-01-01&to=2028-01-01').expect(400);
      await auth('get', '/user-items')
        .set('X-Timezone', 'invalid/zone')
        .expect(400);
      const plan = await auth('get', '/reminders?offset=7&hour=9').expect(200);
      expect(
        plan.body.data.some(
          (row: { itemId: string }) => row.itemId === auto.body.id,
        ),
      ).toBe(true);
      expect(
        plan.body.data.some(
          (row: { itemId: string }) => row.itemId === never.body.id,
        ),
      ).toBe(false);
      expect(
        new Set(plan.body.data.map((row: { id: string }) => row.id)).size,
      ).toBe(plan.body.data.length);
      await auth('delete', '/user-items/' + auto.body.id).expect(200);
      expect(
        (await auth('get', '/reminders?offset=7&hour=9')).body.data.some(
          (row: { itemId: string }) => row.itemId === auto.body.id,
        ),
      ).toBe(false);
    });
    it('rotates refresh tokens, persists reuse revocation and completes one-use SMTP reset', async () => {
      const rotated = (
        await request(server)
          .post('/auth/refresh')
          .send({ refreshToken: refresh })
          .expect(201)
      ).body;
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: refresh })
        .expect(401);
      await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: rotated.refreshToken })
        .expect(401);
      expect(
        (
          await trx('master_refresh_tokens')
            .where('user_id', userId)
            .whereNull('revoked_at')
        ).length,
      ).toBe(0);
      const known = await request(server)
        .post('/auth/forgot-password')
        .send({ email })
        .expect(200);
      const unknown = await request(server)
        .post('/auth/forgot-password')
        .send({ email: 'unknown-' + email })
        .expect(200);
      expect(known.body).toEqual(unknown.body);
      const token = resetMail
        .replace(/=\r\n/g, '')
        .replace(/=3D/g, '=')
        .match(/token=([A-Za-z0-9_-]{43})/)?.[1];
      expect(token).toBeTruthy();
      await request(server)
        .post('/auth/reset-password')
        .send({ token, password: password + 'new' })
        .expect(200);
      await request(server)
        .post('/auth/reset-password')
        .send({ token, password: password + 'again' })
        .expect(400);
      await auth('get', '/auth/me').expect(401);
      await request(server)
        .post('/auth/login')
        .send({ email, password })
        .expect(401);
      await request(server)
        .post('/auth/login')
        .send({ email, password: password + 'new' })
        .expect(201);
    });
    it('backfills legacy recurrence and rolls invalid migrations back in temporary tables', async () => {
      // The temporary tables shadow public tables only on this test connection.
      await trx.raw(
        'CREATE TEMP TABLE master_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, timezone text, token_version integer NOT NULL DEFAULT 0)',
      );
      await trx.raw(
        'CREATE TEMP TABLE user_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), expiry_type text NOT NULL, expiry_date date, recurrence_years integer, recurrence_months integer, recurrence_days integer, renewal_mode text, renewed_through date, recurrence_value integer, recurrence_unit text, CONSTRAINT chk_recurrence_positive CHECK ((recurrence_years IS NULL OR recurrence_years>0) AND (recurrence_months IS NULL OR recurrence_months>0) AND (recurrence_days IS NULL OR recurrence_days>0)))',
      );
      const temp = (
        await trx.raw('SELECT pg_my_temp_schema()::regnamespace::text AS name')
      ).rows[0].name as string;
      await trx.raw('SET LOCAL search_path = ??, public', [temp]);
      const migration = createRequire(import.meta.url)(
        '../migrations/202611140001_renewals.cjs',
      ) as { up: (db: Knex.Transaction) => Promise<void> };
      const [invalid] = await trx('user_items')
        .insert({
          expiry_type: 'RECURRING',
          expiry_date: '2026-01-01',
          recurrence_value: 0,
          recurrence_unit: 'DAY',
        })
        .returning('id');
      await expect(
        trx.transaction((savepoint) => migration.up(savepoint)),
      ).rejects.toThrow('needs review');
      expect(
        (await trx('user_items').where('id', invalid.id).first())
          .recurrence_days,
      ).toBeNull();
      await trx('user_items').where('id', invalid.id).del();
      await trx('user_items').insert([
        {
          expiry_type: 'RECURRING',
          expiry_date: '2026-01-31',
          recurrence_value: 1,
          recurrence_unit: 'MONTH',
        },
        { expiry_type: 'ONCE', expiry_date: '2026-11-07' },
        { expiry_type: 'NEVER' },
      ]);
      await migration.up(trx);
      const recurring = await trx('user_items')
        .where('expiry_type', 'RECURRING')
        .first();
      expect(recurring).toMatchObject({
        recurrence_years: 0,
        recurrence_months: 1,
        recurrence_days: 0,
        renewal_mode: 'AUTOMATIC',
        recurrence_value: 1,
        recurrence_unit: 'MONTH',
      });
      expect(
        (await trx('user_items').where('expiry_type', 'NEVER').first())
          .recurrence_days,
      ).toBeNull();
    });
  },
);
