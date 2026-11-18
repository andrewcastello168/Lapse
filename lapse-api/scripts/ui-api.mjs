import { createRequire } from 'node:module';
import { NotificationsModule } from '../dist/notifications/notifications.module.js';
// Real API/controllers and real PostgreSQL; all UI fixtures live in an outer
// transaction which is rolled back when this process exits. No response mocks.
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { connect } from '../src/database/connection.mjs';
import { DATABASE } from '../dist/database/database.js';
import { AuthModule } from '../dist/auth/auth.module.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { UserItemsModule } from '../dist/user-items/user-items.module.js';
import { UserItemsService } from '../dist/user-items/user-items.service.js';
import { TimelineModule } from '../dist/timeline/timeline.module.js';
import { CategoriesModule } from '../dist/categories/categories.module.js';
import { ItemsModule } from '../dist/items/items.module.js';
import { DatabaseExceptionFilter } from '../dist/database/database-exception.filter.js';
import { addDays, todayInZone } from '../dist/expiration/calendar.js';
const db = connect();
const trx = await db.transaction();
let app;
async function close() {
  if (app) await app.close();
  await trx.rollback();
  await db.destroy();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
try {
  if (!(await trx.schema.hasTable('notification_preferences'))) await createRequire(import.meta.url)(
    '../migrations/202611160001_notifications.cjs',
  ).up(trx);
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
  app.enableCors({
    origin: ['http://localhost:8082', 'http://localhost:8081'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new DatabaseExceptionFilter());
  const auth = app.get(AuthService),
    items = app.get(UserItemsService);
  const email = 'ui-' + crypto.randomUUID() + '@example.test',
    password = crypto.randomBytes(20).toString('base64url');
  const { user } = await auth.signup({
    name: 'Andrew Castello',
    email,
    password,
  });
  await auth.updateProfile(user.id, { timezone: 'Asia/Jakarta' });
  const categories = await trx('master_categories').where('is_active', true);
  const masters = await trx('master_items').where('is_active', true);
  const today = todayInZone('Asia/Jakarta');
  async function seed(name, categoryName, type, days, mode = 'AUTOMATIC') {
    const master = masters.find((row) =>
      row.name.toLowerCase().includes(name.toLowerCase()),
    );
    const category =
      categories.find((row) => row.name === categoryName) ?? categories[0];
    return items.create(
      user.id,
      {
        ...(master
          ? { miId: Number(master.id) }
          : { mcId: category.id, itemName: name }),
        expiryType: type,
        ...(type === 'NEVER' ? {} : { expiryDate: addDays(today, days) }),
        ...(type === 'RECURRING'
          ? {
              recurrenceYears: mode === 'MANUAL' ? 1 : 0,
              recurrenceMonths: mode === 'MANUAL' ? 0 : 1,
              recurrenceDays: 0,
              renewalMode: mode,
            }
          : {}),
      },
      'Asia/Jakarta',
    );
  }
  await seed('Netflix', 'Subscription', 'RECURRING', 23);
  await seed('Spotify', 'Subscription', 'RECURRING', 34);
  const manual = await seed('Pajak STNK', 'Vehicle', 'RECURRING', -7, 'MANUAL');
  await seed('Passport', 'Identity', 'ONCE', 14);
  await seed('KTP Elektronik', 'Identity', 'NEVER', 0);
  const stateDir = new URL(
    '../../lapse-mobile/.expo/ui-check/',
    import.meta.url,
  );
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    new URL('state.json', stateDir),
    JSON.stringify({ email, password, manualId: manual.id }),
  );
  await app.listen(3100, '127.0.0.1');
  console.log(
    'UI verification API ready on port 3100. All fixtures will roll back.',
  );
} catch (error) {
  console.error('UI API failed:', error.code ?? error.name, error.message);
  await close();
}
