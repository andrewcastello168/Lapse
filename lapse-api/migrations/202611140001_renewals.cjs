// Reconciles the inspected Supabase schema. No existing tables/IDs or legacy
// columns are removed. A failed preflight rolls the entire migration back.
exports.up = async function (db) {
  for (const column of [
    'recurrence_years',
    'recurrence_months',
    'recurrence_days',
  ]) {
    if (!(await db.schema.hasColumn('user_items', column)))
      await db.schema.alterTable('user_items', (t) =>
        t.integer(column).nullable(),
      );
  }
  if (!(await db.schema.hasColumn('user_items', 'renewal_mode')))
    await db.schema.alterTable('user_items', (t) =>
      t.string('renewal_mode', 20).nullable(),
    );
  if (!(await db.schema.hasColumn('user_items', 'renewed_through')))
    await db.schema.alterTable('user_items', (t) =>
      t.date('renewed_through').nullable(),
    );
  // Legacy backfill writes zero to unused components; replace the old
  // nullable-positive check inside this same atomic migration before doing so.
  await db.raw(
    'ALTER TABLE user_items DROP CONSTRAINT IF EXISTS chk_recurrence_positive',
  );
  if (
    (await db.schema.hasColumn('user_items', 'recurrence_value')) &&
    (await db.schema.hasColumn('user_items', 'recurrence_unit'))
  ) {
    await db.raw(
      `UPDATE user_items SET recurrence_years = CASE WHEN recurrence_unit = 'YEAR' THEN recurrence_value ELSE 0 END, recurrence_months = CASE WHEN recurrence_unit = 'MONTH' THEN recurrence_value ELSE 0 END, recurrence_days = CASE WHEN recurrence_unit = 'DAY' THEN recurrence_value ELSE 0 END WHERE expiry_type = 'RECURRING' AND recurrence_years IS NULL AND recurrence_months IS NULL AND recurrence_days IS NULL`,
    );
  }
  const invalid = await db('user_items')
    .whereRaw(
      `expiry_type = 'RECURRING' AND (expiry_date IS NULL OR COALESCE(recurrence_years,0) < 0 OR COALESCE(recurrence_months,0) < 0 OR COALESCE(recurrence_days,0) < 0 OR COALESCE(recurrence_years,0)+COALESCE(recurrence_months,0)+COALESCE(recurrence_days,0) = 0 OR GREATEST(COALESCE(recurrence_years,0),COALESCE(recurrence_months,0),COALESCE(recurrence_days,0)) > 999)`,
    )
    .count('* as count')
    .first();
  if (Number(invalid.count))
    throw new Error(
      'Existing recurrence data needs review; no changes applied',
    );
  const invalidConfirmation = await db('user_items')
    .whereNotNull('renewed_through')
    .whereRaw(
      "(expiry_type <> 'RECURRING' OR renewal_mode IS DISTINCT FROM 'MANUAL' OR renewed_through <= expiry_date)",
    )
    .count('* as count')
    .first();
  if (Number(invalidConfirmation.count))
    throw new Error(
      'Existing confirmation data needs review; no changes applied',
    );
  await db.raw(
    "UPDATE user_items SET recurrence_years=COALESCE(recurrence_years,0), recurrence_months=COALESCE(recurrence_months,0), recurrence_days=COALESCE(recurrence_days,0), renewal_mode=COALESCE(renewal_mode,'AUTOMATIC') WHERE expiry_type='RECURRING'",
  );
  await db.raw(`ALTER TABLE user_items ADD CONSTRAINT lapse_schedule_rules CHECK (
    (expiry_type = 'RECURRING' AND expiry_date IS NOT NULL AND recurrence_years IS NOT NULL AND recurrence_months IS NOT NULL AND recurrence_days IS NOT NULL AND recurrence_years BETWEEN 0 AND 999 AND recurrence_months BETWEEN 0 AND 999 AND recurrence_days BETWEEN 0 AND 999 AND recurrence_years+recurrence_months+recurrence_days > 0 AND renewal_mode IS NOT NULL AND renewal_mode IN ('AUTOMATIC','MANUAL') AND (renewed_through IS NULL OR (renewal_mode='MANUAL' AND renewed_through > expiry_date))) OR
    (expiry_type IN ('ONCE','NEVER') AND recurrence_years IS NULL AND recurrence_months IS NULL AND recurrence_days IS NULL AND renewal_mode IS NULL AND renewed_through IS NULL AND ((expiry_type='ONCE' AND expiry_date IS NOT NULL) OR (expiry_type='NEVER' AND expiry_date IS NULL)))
  )`);
  if (!(await db.schema.hasColumn('master_users', 'timezone')))
    await db.schema.alterTable('master_users', (t) =>
      t.string('timezone', 100).nullable(),
    );
  if (!(await db.schema.hasColumn('master_users', 'token_version')))
    await db.schema.alterTable('master_users', (t) =>
      t.integer('token_version').notNullable().defaultTo(0),
    );
  const duplicate = await db.raw(
    'SELECT count(*) FROM (SELECT lower(email) FROM master_users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1) duplicates',
  );
  if (Number(duplicate.rows[0].count))
    throw new Error(
      'Duplicate account emails require review; no changes applied',
    );
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS lapse_users_email_unique ON master_users (lower(email))',
  );
  if (!(await db.schema.hasTable('password_reset_tokens')))
    await db.schema.createTable('password_reset_tokens', (t) => {
      t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      t.uuid('user_id').notNullable().references('id').inTable('master_users');
      t.string('token_hash', 64).notNullable().unique();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.timestamp('used_at', { useTz: true }).nullable();
      t.timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(db.fn.now());
      t.index(['user_id', 'created_at']);
    });
};
exports.down = async function () {
  throw new Error(
    'Automatic rollback would remove renewal/account data. Use a reviewed forward migration.',
  );
};
