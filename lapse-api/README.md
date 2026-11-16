# Lapse API

NestJS + Knex + PostgreSQL, with JWT access tokens, rotating refresh tokens and Argon2 passwords. Existing Supabase tables and IDs are preserved.

Copy .env.example to .env and configure the existing database, JWT secret, storage project URL and optional existing Observe credentials. SMTP settings and PASSWORD_RESET_URL are required for password-reset email. No provider is inferred.

Use pnpm install, pnpm run db:inspect, pnpm run db:migrate, then pnpm run start:dev. Migrations reconcile the existing populated schema; they do not reset it. Automatic down migration is intentionally refused to preserve data.

Checks: pnpm run test, pnpm run typecheck, pnpm run lint, pnpm run build. For rollback-only integration checks set RUN_DB_TESTS=1 and invoke node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts. These tests use the configured database and a loopback SMTP server; fixtures roll back.

See ../docs/API.md and ../docs/IMPLEMENTATION.md.
