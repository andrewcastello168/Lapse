# Implementation checklist

Approved: retain Knex, existing tables/IDs/contracts and NEVER; anchored combined-month recurrence; backend-derived expiration; explicit reset of confirmation on schedule edits; automatic/manual renewal; Expo local reminders; device IANA timezone; seven-day warning threshold; one-year maximum timeline; three-month dashboard; All lists tracked items.

- [x] Inspect the live schema before additive Knex migrations; preserve existing data.
- [x] Centralize calendar arithmetic, derived statuses, bounded timeline and reminder dates in the API.
- [x] Complete ownership-scoped CRUD, confirmed schedule edits and atomic renewals.
- [x] Fix authentication validation, refresh rotation and session lifecycle; complete account/reset flows.
- [x] Return optional catalog defaults and usable image URLs with category fallback.
- [x] Complete mockup-aligned navigation, dashboard, items, categories, calendar, forms and detail.
- [x] Complete settings, timezone, appearance, notifications and local reminder reconciliation.
- [x] Add meaningful regression/integration tests; run lint, types and rendered UI checks.
- [x] Reconcile documentation and record verification and external blockers.

## Verification / external dependencies

Implementation is complete; real SMTP delivery and native OS delivery need the external configuration/device described below.

## Verification performed

- API: 27 unit tests pass; full TypeScript check, type-aware lint and Nest build pass. The normal compiled entry point was also started against the configured database and returned HTTP 200 / Hello World, then stopped. Legacy auth POST success codes (201) and owned-item list ordering were retained; the final HTTP suite verifies compatibility.
- Live PostgreSQL HTTP integration: 5 tests pass. Real controllers, JWT/Argon2, ownership, catalog/custom CRUD, invalid inputs, manual/ONCE/NEVER/automatic renewal rules, stale confirmation, anchor preservation, descriptive edits, explicit confirmation resets, range limits, counts, reminders, refresh-family reuse and password resets are exercised. Actual SMTP transport is tested with a loopback SMTP server. Invalid legacy migration rollback and successful backfill are tested using temporary tables on the test connection.
- Mobile: 8 tests pass, covering date presentation/validation, single-flight refresh, logout/profile races and reminder reconciliation/deduplication. TypeScript and Expo lint pass.
- Real rendered browser verification: 29 screenshots/states at 390×844, backed by real NestJS + PostgreSQL rollback-only fixtures, with no API response mocks and no uncaught browser exceptions. Covers onboarding, login, dashboard windows, overdue/search filters, manual renewal, schedule reset, combined recurrence, create/detail/delete/cancel, calendar, timeline, notifications, profile, timezone, reminder settings and light/dark appearance. Main dashboard, form, category grid, settings and calendar renders were visually reviewed against the approved mockup.
- iOS and Android JavaScript/Hermes export succeeds. This verifies native bundle resolution; it is not an APK/IPA build or OS delivery test.
- Screenshot/report artifacts: `lapse-mobile/.expo/ui-check/`; native export: `lapse-mobile/.expo/native-export/` (both intentionally ignored).
- Git whitespace checks pass. The mobile `.env` remains on disk but is no longer tracked. Existing user branding/config/lockfile changes were preserved.

## Database reconciliation

Inspected actual tables, columns, constraints, indexes and bucket access before migration. Existing recurrence and manual SQL renewal columns were present. Migration `202611140001_renewals.cjs` was applied transactionally, normalizing unused recurring components to zero, reconciling constraints and adding account timezone/token version plus single-use reset tokens. Existing table names, numeric catalog IDs, UUID user/item IDs, NEVER values, anchors and confirmation values were retained. The bucket is public and exact stored object paths were checked. No populated database reset or data drop was performed.

After verification processes were stopped, the database still contained the original 7 user items, zero temporary UI accounts, the applied migration record and a validated schedule constraint. UI fixture credentials were removed from the local test artifacts; rendered screenshots/reports remain available.

## External verification still required

- [ ] Configure real SMTP_HOST/PORT/FROM/USER/PASSWORD and PASSWORD_RESET_URL in the ignored backend environment, then send a reset email through that actual transport. No credentials or provider account were supplied. The implementation returns a clear service-unavailable response when delivery is not configured, and never exposes reset tokens.
- [ ] Run a native development/production build on an iOS/Android device, grant permission and verify background/closed-app notification delivery, tap routing, cancellation, device settings and branding. Native OS delivery was not verified in this run; JavaScript/Hermes exports were verified. Web does not schedule native notifications.

The local reminder queue intentionally holds the nearest 60 future reminders and replenishes when the app opens/returns to foreground, preferences/items change, or periodically while active. Each device schedules independently. OS permission and periodic reopening are required; no cron advances expiration anchors.

## Tooling notes

Restricted-shell pnpm access required running repository scripts through the approved installed launcher. Initial integration attempts hit remote connection/test timeouts; connection setup and test timeouts were adjusted and final runs pass. Browser tests caught and fixed the Settings/detail route collision. Expo fell back to its bundled DevTools when the optional latest DevTools download was unavailable; application bundling and rendered checks succeeded.
