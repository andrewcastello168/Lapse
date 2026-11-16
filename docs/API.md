# API and runtime guide

Existing routes/envelopes are preserved. Item responses retain database field names; create/update requests use camelCase. Dates are YYYY-MM-DD calendar strings. Send the validated device/preference timezone in X-Timezone; saved account timezone is the fallback, then UTC for legacy API callers.

The existing signup/login/refresh/logout POST routes retain their legacy 201 success status. New account/reset commands use 200. Existing owned-item list order is retained; mobile sorts displayed overdue/upcoming items by the API-derived effective date.

| Route | Behavior |
|---|---|
| POST /auth/signup | Name, email, password; existing message/user response |
| POST /auth/login | Existing accessToken, refreshToken, user response |
| POST /auth/refresh | Rotate refreshToken within its device family |
| POST /auth/logout | Revoke the current device family |
| GET/PATCH /auth/me | Profile; PATCH name and/or timezone |
| POST /auth/password | currentPassword, newPassword; invalidate existing sessions |
| POST /auth/forgot-password | Email; generic account-independent response |
| POST /auth/reset-password | Single-use token, password |
| GET /categories | Active database categories and image_url |
| GET /items?categoryId=&search= | Active master items; image_url and category_image_url |
| GET/POST /user-items | Owned list/create; array/item response |
| GET/PATCH/DELETE /user-items/:id | Owned detail/update/delete; delete returns deleted: true |
| POST /user-items/preview | Validated schedule; derive dates without persisting |
| POST /user-items/:id/renew | expected_expiry_date, new_expiry_date; return updated item |
| GET /timeline | from/to, or window=7D/30D/3M/6M/12M; limit/offset pagination |
| GET /reminders | offset=1/3/7/30, hour=0–23; nearest 60 future reminder instants |

Item input: expiryType (ONCE/RECURRING/NEVER), expiryDate, recurrenceYears, recurrenceMonths, recurrenceDays, renewalMode (AUTOMATIC/MANUAL). Catalog creation supplies miId; custom creation supplies mcId/itemName. Custom descriptions/categories can be edited. Supplying expiryType replaces the schedule for legacy compatibility; partial descriptive patches preserve it. Recurring components accept 0–999 with a positive total. Non-recurring recurrence/mode/confirmation fields are NULL.

Responses add effective_expiry_date, next_scheduled_date, days_remaining, expiration_status and can_renew. Automatic dates describe schedules and do not verify payment. Manual effective dates remain overdue until confirmed; suggested renewal follows the anchor strictly after current validity. ONCE renewal changes expiry_date; manual recurring changes renewed_through only.

Material schedule edits with existing confirmation require resetConfirmation=true and expectedRenewedThrough matching current confirmation. Descriptive edits preserve it. Renewal and edit writes take owned row locks; renewal also compares the expected effective date in its update. Stale changes return 409; unsupported/invalid input returns 400; inaccessible owned records return 404.

Timeline envelopes retain from, to, total, data and add itemCount, offset, limit, hasMore. total counts occurrences; itemCount counts unique items. Range is at most one calendar year, page size at most 1000, generation at most 100,000 occurrences. Manual items contribute their actionable effective due date only. All is implemented by the owned item list, including NEVER, with next relevant dates rather than infinite schedules.

The current lapse-bucket was verified public; SUPABASE_URL supplies its origin and filenames remain unchanged. Configure STORAGE_BUCKET_PUBLIC=false plus backend-only SUPABASE_SERVICE_ROLE_KEY for private signed delivery. Mobile tries master artwork, category artwork, then a bundled vector placeholder.

SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASSWORD and PASSWORD_RESET_URL configure actual reset delivery. Port 465 uses TLS; other ports require STARTTLS. SMTP_ALLOW_INSECURE is exclusively for loopback tests. No reset token is returned/logged. Tokens are hashed, expire after 30 minutes and can be consumed once. Password changes increment token_version and revoke refresh sessions. Login/refresh/reset share account locks to prevent session recreation during password changes.

Auth endpoints have an in-process 20-attempt/15-minute IP/path limit; reset delivery also has a per-account 60-second persistent throttle. Multi-instance deployments should replace the in-process rate limit with shared infrastructure when needed; MVP adds none.

Local notification delivery is independent of expiration. Each device reconciles deterministic account/item/occurrence/offset keys against its OS queue, cancels changed/deleted reminders, avoids replaying delivered keys and replenishes the nearest 60 future reminders. Preference changes also reconcile. Signout cancels this app's queue; other apps' scheduled notifications are preserved. OS permissions, native builds and periodic reopening govern actual delivery.
