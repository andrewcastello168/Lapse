# Lapse

Personal Expiration & Renewal Manager — keep track of subscriptions, documents, memberships, vehicle taxes and other important dates in one place.

## Product scope
Lapse is designed to support one-time, recurring and no-expiration items, automatic schedule rolling, manual renewal confirmation, category and master-item catalogs, custom items, a dashboard with date filters, calendar and reminders. See the requirements for target behavior; this list is not a claim that every feature is implemented.

## Stack
- Mobile: Expo, React Native, TypeScript, Expo Router.
- API: NestJS, TypeScript, JWT.
- Database: PostgreSQL on Supabase, Knex.
- Storage: Supabase Storage (`lapse-bucket`).
- Package manager: pnpm.

## Structure
```text
Lapse/
├── AGENTS.md
├── README.md
├── docs/
│   ├── REQUIREMENTS.md
│   └── design/mobile-mockup.png
├── lapse-api/
└── lapse-mobile/
```

## Local development
Install compatible Node.js and pnpm versions according to the repository's package manifests. Obtain access to the development Supabase project. Review existing environment examples and package scripts before starting.

### Backend
```bash
cd lapse-api
pnpm install
pnpm run db:inspect
pnpm run db:migrate
pnpm run start:dev
```
The API scripts are defined in lapse-api/package.json. Configure database connection, JWT secrets and storage URL using the actual environment variables in the code. Do not commit credentials. Inspect migration status before applying migrations; reconcile existing manual SQL changes first.

### Mobile
```bash
cd lapse-mobile
pnpm install
pnpm exec expo start
```
Set the API base URL according to the existing configuration. A physical device must be able to reach the API; localhost on a phone is not the development computer. For cache troubleshooting use `pnpm exec expo start --clear`. Native notification and branding changes require a compatible native build, not only Expo Go.

### Images
App branding belongs in `lapse-mobile/assets/images/`. The bucket stores category and master-item images; database records hold `image_path`, API responses expose `image_url`. UI mockups belong under `docs/design/`, not runtime assets.

## Documentation
- [Agent guidelines](AGENTS.md)
- [Product requirements](docs/REQUIREMENTS.md)
- [Mobile design reference](docs/design/mobile-mockup.png)

Actual environment names, scripts, ports, migration state and implemented endpoints must be verified against source code; they were not available when this document was drafted.

## Implementation and verification

See [implementation checklist](docs/IMPLEMENTATION.md) and [API/runtime guide](docs/API.md). The live Supabase schema was inspected and reconciled with an additive Knex migration. Preserve existing IDs and the NEVER value.

Set backend SUPABASE_URL for image delivery and configure SMTP plus PASSWORD_RESET_URL for real password-reset email. Mobile needs only EXPO_PUBLIC_API_URL. Native reminders use a rolling queue of 60 local notifications per device and need OS permission and a native build.
