import { NotificationsService } from '../src/notifications/notifications.service.js';
import { vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MailService } from '../src/auth/mail.service.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import knex, { type Knex } from 'knex';
import { NotificationsModule } from '../src/notifications/notifications.module.js';
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
      process.env.SMTP_USER = '';
      process.env.SMTP_PASSWORD = '';
      process.env.PASSWORD_RESET_URL = 'http://127.0.0.1/auth/reset';
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
      const require = createRequire(import.meta.url);
      if (!(await trx.schema.hasTable('notification_preferences')))
        await require('../migrations/202611160001_notifications.cjs').up(trx);
      await require('../migrations/202611170001_edge_notifications.cjs').up(
        trx,
      );
      await require('../migrations/202611180001_edge_data_api_security.cjs').up(
        trx,
      );
      const module = await Test.createTestingModule({
        imports: [
          AuthModule,
          NotificationsModule,
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
    it('restricts Data API tables to the service role without changing API ownership', async () => {
      const result = await trx.raw(
        "SELECT c.relname,c.relrowsecurity AS rls,has_table_privilege('anon',c.oid,'SELECT') AS anon_read,has_table_privilege('authenticated',c.oid,'SELECT') AS auth_read,has_table_privilege('service_role',c.oid,'SELECT') AS service_read FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('master_users','master_refresh_tokens','password_reset_tokens','user_items','notification_preferences','notification_devices')",
      );
      expect(result.rows).toHaveLength(6);
      for (const row of result.rows)
        expect(row).toMatchObject({
          rls: true,
          anon_read: false,
          auth_read: false,
          service_read: true,
        });
    });
    it('serves the secure HTTPS reset fallback without exposing tokens in HTML', async () => {
      const page = await request(server)
        .get('/auth/reset?token=example')
        .expect(200);
      expect(page.headers['cache-control']).toBe('no-store');
      expect(page.headers['referrer-policy']).toBe('no-referrer');
      expect(page.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      expect(page.text).toContain('Confirm password');
      expect(page.text).not.toContain('token=example');
    });
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
      for (const offset of [0, 14]) {
        const selectedPlan = await auth(
          'get',
          `/reminders?offset=${offset}&hour=9`,
        ).expect(200);
        expect(
          selectedPlan.body.data.every(
            (row: { offset: number }) => row.offset === offset,
          ),
        ).toBe(true);
      }
      await auth('get', '/reminders?offset=2&hour=9').expect(400);
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
    it('persists owned notification preferences, device transfers and inbox reads', async () => {
      const deviceId = randomUUID();
      await request(server)
        .patch('/notifications/preferences')
        .set('Authorization', 'Bearer ' + access)
        .send({
          enabled: true,
          offsets: [7, 1, 0],
          hour: 9,
          timezone: 'Asia/Kathmandu',
        })
        .expect(200);
      const pref = await request(server)
        .get('/notifications/preferences')
        .set('Authorization', 'Bearer ' + access)
        .expect(200);
      expect(pref.body.offsets).toEqual([7, 1, 0]);
      await request(server)
        .patch('/notifications/preferences')
        .set('Authorization', 'Bearer ' + access)
        .send({ enabled: true, offsets: [2], hour: 9, timezone: 'UTC' })
        .expect(400);
      await request(server)
        .post('/notifications/devices')
        .set('Authorization', 'Bearer ' + access)
        .send({
          id: deviceId,
          token: 'ExpoPushToken[test_token]',
          enabled: true,
        })
        .expect(200);
      await request(server)
        .delete('/notifications/devices/' + deviceId)
        .set('Authorization', 'Bearer ' + other)
        .expect(200);
      expect(
        await trx('notification_devices').where('id', deviceId).first(),
      ).toBeDefined();
      const id = userId + ':test';
      await trx('notification_inbox').insert({
        id,
        user_id: userId,
        item_id: itemId,
        title: 'Test reminder',
        body: 'Due today',
      });
      const inbox = await request(server)
        .get('/notifications')
        .set('Authorization', 'Bearer ' + access)
        .expect(200);
      expect(inbox.body.unread).toBe(1);
      await request(server)
        .post('/notifications/read')
        .set('Authorization', 'Bearer ' + other)
        .send({ id })
        .expect(200);
      expect(
        (await trx('notification_inbox').where({ id }).first()).read_at,
      ).toBeNull();
      await request(server)
        .post('/notifications/read')
        .set('Authorization', 'Bearer ' + access)
        .send({})
        .expect(200);
      expect(
        (await trx('notification_inbox').where({ id }).first()).read_at,
      ).not.toBeNull();
      await request(server)
        .get('/notifications/items/' + itemId)
        .set('Authorization', 'Bearer ' + other)
        .expect(404);
      await request(server)
        .patch('/notifications/items/' + itemId)
        .set('Authorization', 'Bearer ' + access)
        .send({ mode: 'DISABLED', offsets: [] })
        .expect(200);
      await request(server)
        .post('/internal/notifications/dispatch')
        .send({})
        .expect(401);
      await request(server)
        .delete('/notifications/devices/' + deviceId)
        .set('Authorization', 'Bearer ' + access)
        .expect(200);
      expect(
        await trx('notification_devices').where('id', deviceId).first(),
      ).toBeUndefined();
    });
    it('claims delivery once, handles partial failure and receipts without changing anchors', async () => {
      const push = app.get(NotificationsService);
      const now = new Date(),
        due = todayInZone('UTC');
      const created = await request(server)
        .post('/user-items')
        .set('Authorization', 'Bearer ' + access)
        .send({
          mcId: category,
          itemName: 'Push fixture',
          expiryType: 'ONCE',
          expiryDate: due,
        })
        .expect(201);
      await push.savePreferences(userId, {
        enabled: true,
        offsets: [0],
        hour: now.getUTCHours(),
        timezone: 'UTC',
      });
      const deviceA = randomUUID(),
        deviceB = randomUUID();
      await push.device(userId, {
        id: deviceA,
        token: 'ExpoPushToken[device_a]',
        enabled: true,
      });
      await push.device(userId, {
        id: deviceB,
        token: 'ExpoPushToken[device_b]',
        enabled: true,
      });
      const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { status: 'ok', id: 'ticket-a' },
              { status: 'error', details: { error: 'DeviceNotRegistered' } },
            ],
          }),
        ),
      );
      const previous = process.env.REMOTE_PUSH_ENABLED;
      process.env.REMOTE_PUSH_ENABLED = 'true';
      try {
        await Promise.all([push.dispatch(), push.dispatch()]);
        expect(transport).toHaveBeenCalledTimes(1);
        expect(
          await trx('notification_attempts').where('state', 'accepted'),
        ).toHaveLength(1);
        expect(
          await trx('notification_devices').where({
            user_id: userId,
            enabled: false,
          }),
        ).toHaveLength(1);
        await trx('notification_preferences')
          .where('user_id', userId)
          .update({ next_check_at: new Date(0) });
        await push.dispatch();
        expect(transport).toHaveBeenCalledTimes(1);
        await trx('notification_attempts')
          .where('state', 'accepted')
          .update({ updated_at: new Date(Date.now() - 20 * 60000) });
        transport.mockResolvedValue(
          new Response(
            JSON.stringify({ data: { 'ticket-a': { status: 'ok' } } }),
          ),
        );
        await push.dispatch();
        expect(
          await trx('notification_attempts').where('state', 'receipt_ok'),
        ).toHaveLength(1);
        expect(
          (await trx('user_items').where('id', created.body.id).first())
            .expiry_date,
        ).toBe(due);
        const retryDevice = randomUUID();
        await push.device(userId, {
          id: retryDevice,
          token: 'ExpoPushToken[rate_retry]',
          enabled: true,
        });
        transport.mockImplementation(
          async () =>
            new Response(
              JSON.stringify({
                data: [
                  {
                    status: 'error',
                    details: { error: 'MessageRateExceeded' },
                  },
                ],
              }),
            ),
        );
        const beforeRetries = transport.mock.calls.length;
        for (let n = 0; n < 4; n++) {
          await trx('notification_preferences')
            .where('user_id', userId)
            .update({ next_check_at: new Date(0) });
          await push.dispatch();
        }
        expect(transport.mock.calls.length - beforeRetries).toBe(3);
        expect(
          (
            await trx('notification_attempts')
              .where('device_id', retryDevice)
              .first()
          ).attempt_count,
        ).toBe(3);
        await request(server)
          .delete('/user-items/' + created.body.id)
          .set('Authorization', 'Bearer ' + access)
          .expect(200);
        expect(
          (
            await trx('notification_inbox')
              .where('id', userId + ':' + created.body.id + ':' + due + ':0')
              .first()
          ).item_id,
        ).toBeNull();
      } finally {
        transport.mockRestore();
        if (previous === undefined) delete process.env.REMOTE_PUSH_ENABLED;
        else process.env.REMOTE_PUSH_ENABLED = previous;
      }
    }, 60000);
    it('reuses notification tables for Edge RPC claims, permissions and persistent test cooldown', async () => {
      const edgeDevice = randomUUID(),
        testId = randomUUID();
      await trx.raw(
        'select public.lapse_push_register(?::uuid,?::uuid,?,true,?::jsonb,0)',
        [
          userId,
          edgeDevice,
          'ExpoPushToken[edge_owned]',
          JSON.stringify({
            enabled: true,
            offsets: [7, 1, 0],
            hour: 9,
            timezone: 'UTC',
          }),
        ],
      );
      const claim = {
        kind: 'test',
        userId,
        userVersion: 0,
        deviceId: edgeDevice,
        requestId: testId,
        title: 'Test',
        body: 'Test',
      };
      const call = async (rows: unknown[]) =>
        (
          await trx.raw('select public.lapse_push_claim(?::jsonb) as data', [
            JSON.stringify(rows),
          ])
        ).rows[0].data;
      const first = await call([claim]);
      expect(first[0].token).toBe('ExpoPushToken[edge_owned]');
      expect((await call([claim]))[0].replayed).toBe(true);
      await expect(
        trx.transaction(async (savepoint) =>
          savepoint.raw('select public.lapse_push_claim(?::jsonb)', [
            JSON.stringify([{ ...claim, requestId: randomUUID() }]),
          ]),
        ),
      ).rejects.toThrow('test cooldown');
      const privilege = await trx.raw(
        "select has_function_privilege('anon','public.lapse_push_claim(jsonb)','EXECUTE') as allowed",
      );
      expect(privilege.rows[0].allowed).toBe(false);
      await trx.raw('select public.lapse_push_results(?::jsonb)', [
        JSON.stringify([
          {
            id: first[0].id,
            deviceId: edgeDevice,
            state: 'accepted',
            ticket: 'edge-ticket',
          },
        ]),
      ]);
      expect(
        (
          await trx('notification_attempts')
            .where('device_id', edgeDevice)
            .first()
        ).state,
      ).toBe('accepted');
      const created = await request(server)
        .post('/user-items')
        .set('Authorization', 'Bearer ' + access)
        .send({
          mcId: category,
          itemName: 'Edge snapshot',
          expiryType: 'ONCE',
          expiryDate: '2030-01-31',
        })
        .expect(201);
      const snapshot = (
        await trx.raw(
          'select to_jsonb(ui) as data from user_items ui where id=?',
          [created.body.id],
        )
      ).rows[0].data;
      const pref = await trx('notification_preferences')
        .where('user_id', userId)
        .first();
      const reminder = {
        kind: 'reminder',
        userId,
        deviceId: edgeDevice,
        itemId: created.body.id,
        occurrence: '2030-01-31',
        offset: 0,
        title: 'Due',
        body: 'Due',
        itemSnapshot: snapshot,
        preferenceSnapshot: {
          enabled: pref.enabled,
          offsets: pref.offsets,
          hour: pref.hour,
          timezone: pref.timezone,
        },
        overrideSnapshot: { mode: 'INHERIT', offsets: [] },
      };
      expect(await call([reminder])).toHaveLength(1);
      expect(await call([reminder])).toHaveLength(0);
      await trx('user_items')
        .where('id', created.body.id)
        .update({ item_name: 'Edited fixture' });
      expect(
        await call([{ ...reminder, occurrence: '2030-02-01' }]),
      ).toHaveLength(0);
      expect(
        (await trx('user_items').where('id', created.body.id).first())
          .expiry_date,
      ).toBe('2030-01-31');
    });
    it('reports failed reset delivery and removes the unusable reset token', async () => {
      const failedEmail = 'smtp-failure-' + randomUUID() + '@example.test';
      const created = await request(server)
        .post('/auth/signup')
        .send({ name: 'SMTP fixture', email: failedEmail, password })
        .expect(201);
      const mail = vi
        .spyOn(MailService.prototype, 'passwordReset')
        .mockRejectedValueOnce(
          new ServiceUnavailableException(
            'Password reset email could not be sent',
          ),
        );
      try {
        await request(server)
          .post('/auth/forgot-password')
          .send({ email: failedEmail })
          .expect(503);
        expect(
          await trx('password_reset_tokens').where(
            'user_id',
            created.body.user.id,
          ),
        ).toHaveLength(0);
      } finally {
        mail.mockRestore();
      }
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
