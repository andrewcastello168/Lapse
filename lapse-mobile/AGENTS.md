# AGENTS.md — Lapse

## 1. Project Overview

Lapse is a personal expiration and renewal management application.

Its purpose is to help users track items that have expiration dates, renewal schedules, or validity periods.

Examples:
- Subscriptions: Netflix, Spotify, YouTube Premium, Disney+
- Identity: KTP, SIM, Passport
- Vehicle: STNK, Vehicle Tax
- Legal: Licenses and legal documents
- Others: Any item with an expiration date

### Core Principles

- Keep the architecture simple and maintainable.
- Follow clear separation of concerns.
- Avoid unnecessary abstractions.
- Keep business logic out of controllers.
- Database must remain the source of truth.
- Avoid unnecessary background jobs.
- Prioritize correctness, readability, and maintainability.

## 2. Technology Stack

### Mobile Application
- Expo
- React Native
- TypeScript

### Backend
- NestJS
- TypeScript

### Database
- PostgreSQL
- Supabase

### ORM
- Knex

### Authentication
- JWT
- Argon2 or bcrypt for password hashing

Do not introduce additional technologies or dependencies without a clear technical reason.

## 3. Repository Structure

The intended repository structure:

```text
lapse/
├── AGENTS.md
│
├── lapse-api/
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── categories/
│   │   ├── items/
│   │   ├── reminders/
│   │   └── prisma/
│   └── package.json
│
└── lapse-mobile/
    ├── app/
    ├── components/
    ├── services/
    ├── hooks/
    ├── stores/
    └── package.json
```

This is the intended logical structure, not a requirement to create every directory immediately.

Follow the existing repository structure when implementing features.

## 4. Architecture Guidelines

### Backend

Use NestJS modular architecture.

Each feature should have clear responsibilities:

- Controller: Handle HTTP requests and responses.
- Service: Handle business logic.
- Repository / Knex: Handle database operations.
- DTO: Validate and define request payloads.
- Guard: Handle authentication and authorization.

Avoid placing database queries and complex business logic directly inside controllers.

### Mobile

Use a modular React Native architecture.

Separate:
- Screens and navigation.
- Reusable UI components.
- API services.
- State management.
- Custom hooks.
- Type definitions.

Avoid duplicating business logic across screens.

## 5. Database Guidelines

Preserve existing PostgreSQL IDs: UUID users/user items and numeric catalogs.

Use Knex for database access and migrations.

Database conventions:
- Use snake_case for database column names.
- Define appropriate foreign keys.
- Add indexes for frequently queried columns.
- Use timestamps where appropriate.
- Use nullable fields only when logically necessary.
- Avoid unnecessary duplicated data.

### Core Tables

The initial database domain consists of:

1. `master_users`
2. `master_categories`
3. `master_items`
4. `user_items`

`master_items` contains reusable item definitions.

`user_items` contains items owned and managed by individual users.

Users must only access their own records unless explicitly authorized otherwise.

## 6. Expiration Management ? Approved Rules

- Preserve the existing ONCE, RECURRING and NEVER values.
- ONCE requires an expiry date. NEVER has no expiry date, recurrence or reminders.
- RECURRING has three components: recurrence_years, recurrence_months, recurrence_days, each 0?999 with at least one positive. Unused components are zero; non-recurring components are NULL.
- The backend computes each occurrence from the original anchor: multiply components by the index, combine years/months, clamp once to the target month, then add multiplied days.
- Never advance anchors in scheduled jobs. Mobile consumes API-derived dates/statuses and only formats them.
- AUTOMATIC dynamically rolls schedules; it does not verify payment. MANUAL retains effective validity until explicitly confirmed.
- Renewals use owned atomic conditional writes with the expected current date. ONCE changes expiry_date; MANUAL recurring changes only renewed_through.
- Descriptive edits preserve confirmation. Material schedule edits reset confirmation only after explicit user confirmation.
- Use the selected IANA timezone and a seven-day expiring-soon threshold.
- Timeline requests cover at most one calendar year. All lists all tracked items and their next relevant dates.
- See ../docs/REQUIREMENTS.md for the complete approved behavior.

## 7. Reminder Management

Reminder functionality should be separated from expiration calculation.

Expiration calculation should work independently of scheduled jobs.

Background jobs may eventually be used for:
- Sending push notifications.
- Processing scheduled reminders.
- Delivering recurring notifications.

Do not use background jobs to continuously update the original expiration dates.

Prevent duplicate notifications through appropriate reminder tracking.

## 8. API Guidelines

Follow RESTful API conventions.

Use:
- Appropriate HTTP methods.
- Consistent response structures.
- DTO validation.
- Proper HTTP status codes.
- Centralized exception handling.

Never expose internal database errors directly to clients.

Validate ownership of user-specific records.

Never trust `user_id` supplied by the client when the authenticated identity can be obtained from the JWT.

## 9. Coding Standards

- Use TypeScript strict typing.
- Avoid `any` unless absolutely necessary.
- Prefer readable and maintainable code.
- Use descriptive variable and function names.
- Avoid deeply nested conditions.
- Keep functions focused on one responsibility.
- Avoid premature optimization.
- Avoid unnecessary design patterns.
- Reuse existing utilities when appropriate.

Do not introduce abstractions without a real need.

## 10. Security

- Hash passwords securely.
- Never store plaintext passwords.
- Never expose secrets or environment variables.
- Validate all user inputs.
- Enforce user-level data isolation.
- Protect private API endpoints.
- Avoid exposing sensitive information in logs.

Use environment variables for configuration.

Never commit `.env` files or credentials.

## 11. Testing Guidelines

Write tests for important business logic.

Prioritize:
- Authentication.
- User authorization.
- Item CRUD operations.
- Expiration calculation.
- Recurrence calculation.
- Month-end handling.
- Leap-year handling.
- NULL expiration behavior.
- Reminder scheduling.

For recurring expiration calculations, include tests for dates that are already in the past and multiple missed recurrence periods.

Do not consider a feature complete without appropriate validation and tests.

## 12. Development Workflow

Before implementing a feature:

1. Inspect the existing project structure.
2. Understand existing conventions.
3. Identify affected modules.
4. Check database relationships.
5. Understand the business requirements.
6. Implement the smallest maintainable solution.
7. Add or update tests.
8. Verify the implementation.

Do not unnecessarily rewrite existing working code.

Do not modify unrelated modules.

Do not introduce breaking database changes without considering existing data and migrations.

## 13. Instructions for AI Coding Agents

When working on Lapse:

- Understand the existing code before making changes.
- Follow this document and any more specific instructions in nested `AGENTS.md` files.
- Do not invent business requirements.
- Ask for clarification when an important business rule is ambiguous.
- Explain architectural trade-offs when proposing significant changes.
- Prefer simple solutions over unnecessarily complex implementations.
- Do not claim tests passed without actually running them.
- Do not silently change established business logic.
- Keep implementation consistent across backend and mobile.

The objective is to build a reliable, maintainable, and scalable application without unnecessary complexity.

---

**Project Philosophy:**

Build simple. Keep the source of truth consistent. Separate business logic from infrastructure. Make every feature purposeful.