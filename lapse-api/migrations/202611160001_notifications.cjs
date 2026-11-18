// Additive Phase 2 schema. Never changes expiration anchors or existing preferences.
exports.up = async function (db) {
  await db.schema.createTable('notification_preferences', (t) => {
    t.uuid('user_id').primary().references('id').inTable('master_users');
    t.boolean('enabled').notNullable().defaultTo(true);
    t.jsonb('offsets').notNullable().defaultTo('[7,1,0]');
    t.integer('hour').notNullable().defaultTo(9);
    t.string('timezone', 100).notNullable().defaultTo('UTC');
    t.uuid('item_cursor').nullable();
    t.timestamp('next_check_at', { useTz: true })
      .notNullable()
      .defaultTo(db.fn.now());
    t.index(['enabled', 'next_check_at']);
  });
  await db.schema.createTable('notification_devices', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('id').inTable('master_users');
    t.string('token', 255).notNullable().unique();
    t.integer('token_version').notNullable().defaultTo(0);
    t.boolean('enabled').notNullable().defaultTo(true);
    t.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(db.fn.now());
    t.index(['user_id', 'enabled']);
  });
  await db.schema.createTable('notification_item_preferences', (t) => {
    t.uuid('item_id')
      .primary()
      .references('id')
      .inTable('user_items')
      .onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('master_users');
    t.string('mode', 12).notNullable();
    t.jsonb('offsets').notNullable();
    t.index('user_id');
  });
  await db.schema.createTable('notification_inbox', (t) => {
    t.string('id', 255).primary();
    t.uuid('user_id').notNullable().references('id').inTable('master_users');
    // Retain history when an item is deleted.
    t.uuid('item_id')
      .nullable()
      .references('id')
      .inTable('user_items')
      .onDelete('SET NULL');
    t.string('title', 255).notNullable();
    t.text('body').notNullable();
    t.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(db.fn.now());
    t.timestamp('read_at', { useTz: true }).nullable();
    t.index(['user_id', 'created_at']);
  });
  await db.schema.createTable('notification_attempts', (t) => {
    t.string('reminder_id', 255)
      .notNullable()
      .references('id')
      .inTable('notification_inbox')
      .onDelete('CASCADE');
    t.uuid('device_id')
      .notNullable()
      .references('id')
      .inTable('notification_devices')
      .onDelete('CASCADE');
    t.primary(['reminder_id', 'device_id']);
    t.integer('attempt_count').notNullable().defaultTo(1);
    t.string('state', 20).notNullable().defaultTo('claimed');
    t.string('ticket', 255).nullable();
    t.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(db.fn.now());
    t.index(['state', 'updated_at']);
  });
  await db.schema.createTable('auth_rate_limits', (t) => {
    t.string('key', 64).primary();
    t.integer('count').notNullable();
    t.timestamp('until', { useTz: true }).notNullable();
    t.index('until');
  });
  for (const table of [
    'notification_preferences',
    'notification_devices',
    'notification_item_preferences',
    'notification_inbox',
    'notification_attempts',
    'auth_rate_limits',
  ])
    await db.raw('ALTER TABLE ?? ENABLE ROW LEVEL SECURITY', [table]);
};
exports.down = async function () {
  throw new Error(
    'Use a reviewed forward migration to preserve notification history',
  );
};
