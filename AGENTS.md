# AGENTS.md — Lapse

## Project and references
Lapse is a personal expiration and renewal manager. Read `docs/REQUIREMENTS.md` before changing business behavior and `docs/design/mobile-mockup.png` before implementing mobile UI. Read nested AGENTS.md files where present. Inspect existing code, package scripts, Prisma schema and migrations first. Requirements describe intended behavior, not proof of implementation. Report conflicts rather than silently changing rules.

## Stack and structure
- `lapse-api/`: NestJS, TypeScript, Knex, PostgreSQL hosted on Supabase; JWT authentication and Argon2 password hashing.
- `lapse-mobile/`: Expo, React Native, TypeScript, Expo Router, SecureStore, expo-notifications.
- Use pnpm and existing lockfiles. Do not introduce dependencies or infrastructure without a clear need.

## Architecture
- Prefer a modular monolith. Controllers handle HTTP; services own business logic; Knex handles persistence; DTOs validate inputs; guards enforce access. Avoid redundant repository wrappers.
- Mobile routes/screens, reusable components, hooks, API services and state should have clear responsibilities. Follow existing directory conventions rather than creating empty structures.
- Backend owns expiration and renewal logic. Mobile displays API results; do not duplicate authoritative calculations.
- Database is the source of truth. No scheduled jobs to advance expiration dates. Reminder delivery is a separate concern.

## Database and API
- Preserve existing physical table names and mappings (`master_categories`, `master_items`, `user_items`); inspect other names rather than guessing.
- Preserve existing IDs: UUID users/user items and numeric catalogs. Use snake_case database columns, foreign keys, indexes and constraints. Use DATE for calendar dates and timezone-aware timestamps for events.
- Use Knex migrations; reconcile manual Supabase changes with migration history. Never reset a populated database or drop data without explicit approval.
- Follow existing REST routes, response envelopes and naming conventions. Validate DTOs, use correct HTTP status codes and centralized exception handling. Never expose database errors.
- Derive user identity from JWT; scope every user-specific read/write by ownership. For renewals use atomic conditional writes to prevent stale or duplicate changes.

## Mobile and UI
- Follow the approved mockup: neutral surfaces, generous spacing, mint accents, readable typography, real item/category images. Do not copy illegible generated text literally.
- Use shared theme tokens and reusable components; support light/dark appearance, safe areas, accessible controls and loading/error/empty states.
- Use backend `image_url`; custom items inherit category images. No user image uploads in MVP.
- Centralize environment-based API configuration; store sensitive tokens with SecureStore. Never embed backend secrets in mobile bundles.
- Keep notification handling separate from screens. Native icon, splash and notification config changes require a native rebuild for accurate verification.

## Security and quality
- Strict TypeScript; avoid any, unnecessary abstractions, deep nesting and unrelated rewrites.
- Hash passwords; validate user input; isolate user data; avoid logging secrets; never commit real .env files or credentials.
- Test auth, ownership, item CRUD, expiry types, combined recurrence, month-end, leap years, timezone, manual renewal, stale requests, image fallback and reminder deduplication.

## Workflow
1. Inspect existing implementation and relevant requirements.
2. Identify affected modules, schema and compatibility risks.
3. Implement the smallest maintainable change across backend and mobile.
4. Add tests and run available checks using actual repository scripts.
5. Update documentation when behavior changes; report changes, tests actually run, failures and remaining work.

Do not invent business requirements, silently change established behavior, claim unrun tests passed or redesign approved screens without approval. Flag important unresolved business decisions before implementing them.
