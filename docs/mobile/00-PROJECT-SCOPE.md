# Mobile app: complete project scope

## Goal
One React Native (Expo) app for Android and iOS, one login, role-based tabs, English + Arabic (RTL), light + dark, reusing the existing Express/Supabase backend. Delivered end to end in 14 one-week sprints by one developer working with Claude. This is very aggressive (a team of ~5 was estimated at ~29 weeks): protect the date with each sprint's "Must finish" / "Drop first" lists and the week-14 buffer.

## Decisions already made (do not re-litigate)
- **One app for all roles**, not one per role. Optional later split: a dedicated "Scanner" app if schools want kiosk devices.
- **Expo (dev client)** with Expo Router, NativeWind (or a ready UI kit), SWR, react-hook-form + zod, i18next (+ ICU plugin), expo-secure-store, expo-notifications, expo-camera, expo-location, expo-sqlite, NetInfo.
- **Same repo, monorepo**: `mobile/` + `packages/{shared-types,api-client,shared-utils,miqat-core}`. Web and mobile consume the same packages.
- **Backend is reused.** App talks only to the Express API with the Supabase access token as Bearer. Supabase auth via supabase-js with SecureStore adapter (`detectSessionInUrl: false`). Anon key only in the app.
- **Share logic, rewrite UI.** UI layer (Radix/shadcn/Tailwind, ~1,000 files) is not reusable.
- English + Arabic from the start; per-school logo (4 frame shapes) and login background; no per-school primary colour today.

## Roles and scope
| Role | In scope (mandatory screens in `03-SCREENS-AND-ASSETS.md`) |
|---|---|
| All | Sign-in, biometric, 2FA (code/recovery/setup), forgot/reset password, forced password change, user agreement, system states, notifications inbox, settings, profile, account deletion request |
| Student | Home, timetable, attendance, grades, report card, assignments (submit with photo/file), quizzes, diary, events, fees (view), messages, complaints, QR attendance card |
| Parent | Child switcher, attendance, excuse request, grades, homework (view), timetable, exams, fees and receipts, diary, messages, complaints, child QR card, gate attendance history |
| Teacher | Home, timetable, take attendance, diary, assignments, submissions and grading, messages, discipline referral, online class, staff rotating QR, classroom scan |
| Scanner (gate staff/teachers) | Device enrolment, gate scan, class scan, results (accepted/duplicate/rejected), offline queue, sync, permissions |
| Librarian / Inspector / Admin on the go | Minimum sets only (issue/return/search; visits; live attendance, approvals, alerts) |

Total mandatory screens: 94. Optional: e-library, Quran (hifzi), polls/notes, social wall (Fina), ID card, discipline/activities views, etc.

**Out of scope / stays on web:** admin back office (372 pages), timetable/exam/ID-card/certificate builders, bulk imports, 3D labs, circuit/physics simulations, Excalidraw whiteboard, TipTap editing, super-admin tools, public school pages.

## Backend additions required (ordered)
P0 blockers
1. Confirm prod API is on HTTPS with a valid hostname (guide/config reference `http://102.213.183.100:*`; scanner uses `https://istudent.ly/api`).
2. Phone push: `device_tokens` table (provider fcm/apns/expo, platform, app_version, device_id, locale), `POST /push/register-device`, `DELETE /push/device/:id`, branch in `dispatch()` of `backend/src/services/push-notifications.service.ts`, stale-token pruning, data payload with deep link; triggers: messages, absences, grades, assignments due, fee reminders, events; fix `sendToRole` (no campus filter). Existing `push_subscriptions` is web-push only (NOT NULL p256dh/auth).
3. `GET /auth/me` (profile, role, language, 2FA state, force-change flag, enabled plugins, branding). Web reads `profiles` via RLS today.
4. Forgot/reset password (none exists).
5. Account deletion request + anonymise process (store requirement).
6. Public platform privacy policy + terms pages.
7. `GET /miqat/cards/mine` (student self / parent for linked child): `/miqat/cards/*` are admin-only today; reuse `signCardPayload` in `backend/src/services/miqat/card-crypto.ts`.
8. Tenant discovery by school code/slug if multi-school (public endpoints assume one primary school; `resolve-username` is global).
9. Audit every `parent-dashboard` method for child-ownership checks (only some verify). Add negative tests.

P1: standard envelope + error codes for mobile subset; zod contracts (+OpenAPI) for mobile subset; clamp `limit` (students default 1000) and add paging; fix slow `gpa-rank` (loads all section grades into JS), parent gradebook N+1, parent homework N+1; upload timeouts/size (global 30 s timeout, 200 MB memory multer); direct-to-Supabase uploads by web (learning-resources, lesson-plan-files, books, school-logos, profile photos) need API paths or policies; media streaming (no Range); social login deep link (browser redirect only; `listUsers()` unpaginated); app-config endpoint (min version, maintenance, flags); deep-link files (`assetlinks.json`, `apple-app-site-association`).

P2: rate limits (only fina/media has one): `resolve-username` (also an enumeration oracle), public-signup, miqat enrol, `/two-fa/verify` and recovery, change-password; verify 2FA session expiry vs access-token `exp` (may re-prompt hourly); `helmet` unused; remove debug logs (token prefixes, Miqat key fingerprints, push endpoints); consider local JWT verification (each request calls Supabase `getUser`).

## Reuse map
| Piece | Reuse | Path |
|---|---|---|
| Express API (student/parent/teacher dashboards, messaging, grievances, events, timetable attendance, quiz, library) | ~90% as-is | `backend/src/routes/*` |
| Types | 100% after reconciling `.ts` vs `.tsx` | `frontend/src/types/` |
| API modules | ~70% verbatim; fix plumbing | `frontend/src/lib/api/*` (base: `index.ts`, `schools.ts` getAuthToken, `abortable-fetch.ts`) |
| SWR hooks (41) | ~80% | `frontend/src/hooks/*` |
| Sidebar/plugin/role config | as data (split icons) | `frontend/src/config/sidebar.ts`, `plugins.ts` |
| i18n JSON (en ~625 KB, ar ~796 KB, 69 namespaces) | with ICU check, split by namespace | `frontend/messages/` |
| Scanner logic (geofence, Base32/card parse, sync/backoff, dedupe, API shapes, tests) | ~70% to `packages/miqat-core` | `scanner-app/src/lib/` |
| Contexts (Auth 1,384 lines) | rewrite DOM parts, keep state machine and `useAuth` shape | `frontend/src/context/` |
| UI components | rewrite | `frontend/src/components/ui` |

## Known issues found (fix or be aware)
- Reversible encrypted user passwords (`profiles.login_password_enc`).
- `req.profile` is `select('*')` (includes TOTP/password columns): never return it.
- Web "remember me" stores email and plaintext password in localStorage: do not port.
- Fee/accounting attachments in public-URL buckets; service-role key everywhere so tenant isolation relies on every query's `school_id` filter.
- No CI/CD; manual cPanel/Passenger deploys; web has `ignoreBuildErrors: true`.
- 2FA check fails open on error; no lockout.
- Roles `counselor` and `financial_admin` have no login destination on web.
- Hard-coded English on parent dashboard, change-password, ID card, student assignment submit.

## Store and compliance
Public privacy policy URL, in-app account deletion, accurate data-safety labels (camera, location for scanner, photos, minors' data), HTTPS only, no payment gateway exists (no in-app purchase issue), store listing + en/ar screenshots, reviewer test accounts (include a 2FA account).

## Assumptions
~50 focused hours/week with Claude; designs (or a UI kit) one week ahead; staging server with sample data for all roles, Apple/Google/Firebase accounts in week 1; pilot school from week 7; scope fixed; store review outside the 14 weeks (student+parent submitted week 9, full app week 13).

## Open decisions
Single vs multiple schools; scanner brand; per-school colours; tablet support; Google/Microsoft sign-in on mobile; whether to ship scanner as a separate app later.
