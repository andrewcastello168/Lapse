// public schema exposure must not make migration bookkeeping available to
// client roles. Keep the existing postgres migration runner/owner unchanged.
exports.up = async (db) => {
  for (const table of ['knex_migrations', 'knex_migrations_lock']) {
    await db.raw('ALTER TABLE public.?? ENABLE ROW LEVEL SECURITY', [table]);
    await db.raw(
      'REVOKE ALL ON TABLE public.?? FROM PUBLIC, anon, authenticated',
      [table],
    );
  }
};
exports.down = async () => {
  throw new Error(
    'Use a reviewed forward migration; do not reopen migration metadata access',
  );
};
