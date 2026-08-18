# Frontend Tasks

## High priority
- Wire splash/startup screen to `GET /api/engine/startup`.
- Replace static dashboard cards with `GET /api/engine/context` and `GET /api/dashboard/home` data.
- Update notifications UI to support categories, unread counts, mark-all-read, and clear-all.
- Rebuild meal logging flow for grouped meal sessions and manual entry validation.
- Update workout flow for start/pause/complete/skip and completion summaries.
- Update sleep/recovery screens to use new split sleep, interruption, and readiness fields.

## Medium priority
- Update auth screens to handle `nextRoute`, locked/disabled accounts, OTP resend throttling, and clearer errors.
- Update profile forms to match backend validation for DOB, height, weight, phone, emergency contact, and units.
- Update subscription screen to reflect live entitlement state.
- Update support form to capture category, attachment, and ticket ID.

## Low priority
- Replace remaining static menu items with routes backed by maintained pages.
- Add better loading, empty, and error states across all connected views.
- Remove stale client-side assumptions about field names and response shapes.
