import { connect } from '../src/database/connection.mjs';
const db = connect();
try {
  await db.transaction(async (trx) => {
    await trx.raw('SET TRANSACTION READ ONLY');
    const items = await trx('user_items').count('* as count').first();
    const fixtures = await trx('master_users')
      .where('email', 'like', 'ui-%@example.test')
      .orWhere('email', 'like', 'lapse-test-%@example.test')
      .count('* as count')
      .first();
    const phase2Applied = await trx('knex_migrations')
      .where('name', '202611160001_notifications.cjs')
      .first();
    console.log(
      JSON.stringify(
        {
          userItems: Number(items.count),
          testAccounts: Number(fixtures.count),
          phase2MigrationApplied: !!phase2Applied,
        edgeFunctionsPresent: Number((await trx("pg_proc").where("proname", "like", "lapse_push_%").count("* as count").first()).count),
          notificationTablesPresent: await trx.schema.hasTable(
            'notification_preferences',
          ),
        },
        null,
        2,
      ),
    );
  });
} finally {
  await db.destroy();
}
