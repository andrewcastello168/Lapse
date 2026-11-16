# Lapse mobile

Expo / React Native / Expo Router. Use pnpm install and configure EXPO_PUBLIC_API_URL in an ignored .env file. The API owns expiration, recurrence, statuses and reminder timestamps. Catalog images use API image_url fields and category fallback.

Run pnpm run start, pnpm run android, pnpm run ios or pnpm run web. Checks: pnpm run lint, pnpm run typecheck and pnpm run test.

Navigation: Home, Items, central Add, Calendar and Settings. The Settings tab uses the internal /preferences path; /settings?section=... remains the detail route so navigation has no path collision.

Native access/refresh tokens use SecureStore; browser sessions use browser storage. Appearance, timezone and local reminder preferences are scoped to each account on this device.

Local notifications need OS permission and a compatible native build. Icon, splash and notification configuration changes require a rebuild. Web supports the application screens and inbox but does not schedule native local reminders. Reminders are reconciled after mutations, settings changes, foregrounding and periodically while active; reopen Lapse to replenish the nearest-60 queue.

Rendered verification uses real NestJS routes and PostgreSQL in a rollback-only transaction, not API mocks: build the API, start its scripts/ui-api.mjs with .env, start Expo web with EXPO_PUBLIC_API_URL=http://localhost:3100 on port 8081 or 8082, start an isolated headless Chrome with CDP on port 9222, then run node scripts/rendered-ui.cjs. Screenshots/report are written under ignored .expo/ui-check. See ../docs/IMPLEMENTATION.md for actual results.
