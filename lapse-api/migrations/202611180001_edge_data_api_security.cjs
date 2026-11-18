// Release prerequisite BEFORE exposing public to PostgREST. Custom Lapse JWTs
// are verified in Edge; browsers/anonymous Supabase roles never query these
// tables directly. Existing postgres API access and service-role RPCs remain.
exports.up = async (db) => {
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
  ];
  for (const table of tables) {
    await db.raw('ALTER TABLE public.?? ENABLE ROW LEVEL SECURITY', [table]);
    await db.raw(
      'REVOKE ALL ON TABLE public.?? FROM PUBLIC, anon, authenticated',
      [table],
    );
    await db.raw(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.?? TO service_role',
      [table],
    );
  }
};
exports.down = async () => {
  throw new Error(
    'Use a reviewed forward migration; do not reopen anonymous account access',
  );
};
