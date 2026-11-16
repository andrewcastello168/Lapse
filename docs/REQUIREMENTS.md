# Lapse — Product Requirements

This document defines the target product, not the current implementation. The visual reference is `design/mobile-mockup.png`. The latest requested visual direction is the light, premium consumer-app design with mint accents. Generated mockup labels are illustrative; business rules below take precedence.

## 1. Product scope
Track personal expiration dates and renewal schedules for subscriptions, identity, vehicles, legal documents and other items. Lapse is not a payment processor and does not verify external renewals automatically. MVP: authentication, item management, catalogs, dashboard, calendar and reminders. Defer payment integration, OCR, custom image uploads and persistent renewal history.

## 2. Account
Welcome, login, register, forgot password, profile, logout. Use authenticated API access and isolate user records. Password reset delivery and token lifecycle must follow the actual auth implementation; do not invent a provider.

## 3. Dashboard and navigation
Home, Items, central Add action, Calendar, Settings. Home shows tracked-item summary, overdue items, upcoming items and category access. Default window: next 3 calendar months; selectable 7 days, 30 days, 3 months, 6 months, 12 months and All. Overdue is separate and not hidden by upcoming filters. Count unique items separately from scheduled occurrences. Sort overdue/upcoming by effective due date and group timeline by month. For All, show all items and their next relevant date rather than materializing infinite recurring occurrences. No-expiry items remain accessible in item lists.

## 4. Catalog and images
Read categories from `master_categories` and master items from `master_items`, without hardcoding the catalog in mobile. Categories discussed: Finance, Identity, Insurance, Legal, Membership, Others, Property, Subscription, Travel, Vehicle. Add flow: category → master item or custom item → configuration. Prefill master item defaults if present; user can configure their own schedule. Custom items use the selected category image automatically, including when category changes. No upload control in MVP.

Use `image_path` relative to Supabase bucket `lapse-bucket` and return usable `image_url` from API. Resolve master item image first for catalog-backed items, category image otherwise, then a local placeholder. Handle missing or failed images gracefully. Preserve actual storage filenames; do not generate paths from display names. Use public URLs only if bucket access is public; otherwise use authorized delivery.

## 5. Item management and expiry types
CRUD, search, category and status filters, item detail, edit, delete confirmation. User-specific records belong in `user_items`.

| Type | Expiry date | Recurrence | Renewal action |
|---|---|---|---|
| ONCE | Required | None | Renew with actual new date |
| RECURRING | Required, original anchor | Combined years/months/days | Depends on mode |
| NEVER | NULL | None | No renewal |

Only RECURRING shows recurrence and renewal mode controls. NEVER has no expiration reminders. For ONCE, expiry remains unchanged until explicitly edited or renewed.

## 6. Combined recurrence (required change)
Replace the single-unit limitation with simultaneous `recurrence_years`, `recurrence_months`, `recurrence_days`. Example: every 1 year, 1 month and 2 days. Three independent non-negative integer inputs, with at least one positive component for RECURRING. All three NULL for ONCE/NEVER; use zero for unused components on recurring records. Each component is bounded to 0?999. Timeline requests are bounded to one calendar year, page size 1?1000, and 100,000 generated occurrences; shorten the range if this work limit is reached.

Original `expiry_date` is the schedule anchor. Never advance it through a cron or scheduled update. Automatic next occurrence is the earliest scheduled date on or after the user's current local calendar date. On the due date itself it remains due today.

Approved deterministic mixed-interval policy: occurrence n is calculated from the original anchor by adding n × (12 × years + months) calendar months, clamping the original day to the last valid day of that target month, and then adding n × days calendar days. Do not sequentially chain clamped dates. Example: anchor 31 Jan 2027, monthly → 28 Feb → 31 Mar. Example mixed anchor 7 Jul 2026, interval 1y 1m 2d → 9 Aug 2027 → 11 Sep 2028. Use date-only arithmetic, never approximate months as 30 days or years as 365 days. Test leap years, multiple missed periods and dates before the anchor.

## 7. Renewal
`renewal_mode` applies only to RECURRING: AUTOMATIC or MANUAL. Existing rolling items default to AUTOMATIC after migration. `renewed_through` is nullable DATE, only populated for manual recurring items. It records confirmed validity until a date, not the timestamp of the confirmation.

- AUTOMATIC: dynamically roll schedule from anchor; no mandatory confirmation, no automatic database write and no claim that payment succeeded.
- MANUAL: effective expiration = renewed_through if present, otherwise expiry_date. Keep showing overdue until explicit renewal. Suggest the next anchored occurrence strictly after the effective expiration; user can enter the actual new validity date. A late renewal may still leave an item overdue if only one past period was covered. Do not silently skip missed periods.
- ONCE: Renew asks for actual new expiry date and updates expiry_date.
- NEVER: no renewal action.

Example: manual STNK anchor 7 Nov 2026, annual; on 14 Nov it is 7 days overdue. Confirmation through 7 Nov 2027 updates only renewed_through, preserving the anchor. No reset flag and no expiration scheduler.

Renewal confirmation must show old/new dates. New date must be strictly later than current effective expiration. Reject stale or duplicate confirmation using atomic comparison to expected effective date and ownership. Approved edit policy: descriptive edits preserve confirmed validity. Material changes to expiry type, recurrence, anchor or mode reset confirmation only after explicit user confirmation. Reject a reset when its expected confirmation no longer matches.

## 8. Derived values and statuses
Backend derives effective_expiry_date, next_scheduled_date, days_remaining, expiration_status and can_renew; field names may follow existing API conventions. Do not persist derived fields. Use user IANA timezone and date-only comparison. Approved expiring-soon threshold: 7 days. Status: NO_EXPIRY, OVERDUE (negative), DUE_TODAY (zero), EXPIRING_SOON (1–7), UPCOMING (>7). Automatic status describes schedule, not verified validity. For manual items, scheduled date and confirmed validity are distinct.

## 9. Calendar and timeline
Show monthly calendar and date-grouped events. Automatic recurring items contribute all occurrences in the bounded selected range. Manual current due date is actionable; future projected occurrences, if shown, must be labeled as projections, not confirmed renewals. ONCE contributes its effective due date; NEVER contributes none. Distinguish item counts and occurrence counts. Bound query windows and paginate results where needed.

## 10. Notifications and settings
Reminder delivery is independent of expiration calculation. Provide notification permission handling, notification list, account settings, appearance and timezone. Approved delivery: Expo local notifications, independently scheduled on each device, using API-generated instants. Offsets: 1, 3, 7 or 30 days before due date; default 7. Initial timezone is the device IANA timezone; default delivery is 09:00 with an adjustable delivery hour. Prevent duplicate notifications by tracking item, occurrence, reminder offset and recipient/device as appropriate. Reschedule or cancel reminders after item edits, deletes and manual renewals. Do not use jobs to update expiry anchors. Respect OS permissions and user preferences.

## 11. Database and migrations

The live schema was inspected before migration. Persistence remains Knex; preserve master_users, master_refresh_tokens, master_categories, master_items and user_items. User/user-item IDs are UUID; catalog IDs are numeric. Existing recurrence columns and manually added renewal_mode / renewed_through were verified and reconciled by migration 202611140001_renewals.cjs. No existing IDs, table names, anchors or confirmations are removed.

Use checked-in Knex migrations. Recurring components are non-negative integers with a positive total; zero fills unused components. ONCE/NEVER recurrence fields are NULL. renewal_mode is required for recurring and NULL otherwise; renewed_through belongs only to manual recurring items. Legacy recurrence_value/unit columns, when present, are backfilled without dropping them. A failed data preflight rolls the migration back.

## 12. API changes
Preserve existing endpoint paths/envelopes after inspecting code. Required capabilities: catalog reads with image_url, user item CRUD with combined recurrence and renewal mode, bounded upcoming occurrences, calendar data and renewal confirmation. Implemented route `POST /user-items/:id/renew`:
```json
{
  "expected_expiry_date": "2026-11-07",
  "new_expiry_date": "2027-11-07"
}
```
Validate dates, ownership, mode and expected current value atomically; return updated item and derived values. Reject unsupported renewals and stale writes with appropriate status. Create/update DTOs accept combined recurrence fields; coordinate mobile/API transition from legacy fields. No unverified endpoint is assumed to exist.

## 13. UI acceptance criteria
Cover welcome/login/register/reset, dashboard and date filter, item list/search/filter/empty, category and master item picker, custom item, create/edit forms for all expiry types, combined recurrence picker, automatic and manual modes, item detail, renewal and delete confirmation, calendar/timeline, notifications, settings/profile. Show loading/error/empty states. Use real bucket images, category fallback, and cohesive light/dark theme. No custom image upload. Use neutral backgrounds, mint accents, uncluttered lists and legible countdowns.

## 14. Verification and open decisions
Tests must cover ownership, invalid configurations, legacy migration, mixed recurrence, month-end/leap-year, due today, multiple missed periods, timezone, manual overdue, late renewal, stale/duplicate updates, NEVER behavior, images and range counts. The recurrence policy, confirmation reset policy, local reminder delivery, Knex persistence and existing NEVER enum/IDs are approved. Inspect the live schema before subsequent migrations. Mockup is a visual reference, not an executable or verified specification.

## 15. Runtime boundaries

Local reminder scheduling maintains the nearest 60 future reminders to fit native limits and refills on foreground, mutations, preference changes and periodically while active. Users must reopen the app to replenish this bounded queue; no expiration anchors are updated by a scheduler. Delivered reminders are retained locally in a bounded inbox. OS permission and native builds govern actual delivery.

Password reset uses configurable SMTP, hashed 30-minute single-use reset tokens and the existing JWT account system. SMTP credentials and a reset URL must be configured server-side; tokens are never returned or logged. Password changes invalidate existing access/refresh sessions. Web sessions use browser storage; native sensitive tokens use SecureStore.
