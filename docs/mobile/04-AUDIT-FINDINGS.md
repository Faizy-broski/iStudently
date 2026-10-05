# Condensed audit (so nothing needs rediscovery)

## Backend (`backend/src`)
- Auth: Bearer only (`middlewares/auth.middleware.ts`), verified with `supabase.auth.getUser` on every request; profile cached 20 s. No cookies/CSRF/Origin dependence. No backend login/refresh/logout (Supabase). No password reset. `/auth/me/context` exists (campus/school/branding only). Username login via `POST /api/public/resolve-username` (`routes/public-pages.routes.ts`), no rate limit.
- Client-enforced states: `force_password_change`, user agreement (`/user-agreements/*`), but server blocks inactive account, `SCHOOL_SUSPENDED`, `TRIAL_EXPIRED`.
- 2FA (`routes/two-fa.routes.ts`, `services/two-fa.service.ts`): TOTP, recovery code, `two_fa_sessions` keyed on JWT `session_id`; expiry may follow token `exp` (unverified).
- Social login: `routes/social-auth.routes.ts` redirects to `FRONTEND_URL/auth/callback` with a magic link.
- `app.ts`: hand-rolled CORS (native unaffected), helmet installed but unused, JSON limit 2 MB, global 30 s timeout (quiz AI 120 s), routes mounted at `/api/x` and `/x`, no versioning, health at `/health`, `/api/status`. Rate limit only on `/fina/media`.
- Envelope: mostly `{success,data}` / `{success:false,error}` but 4+ variants; zod in ~14 files; no OpenAPI.
- Mobile-relevant routes: `/student-dashboard`, `/parent-dashboard` (requireRole parent), `/timetable/attendance/*`, `/messaging`, `/events`, `/grievances`, `/portal`, `/quiz/student/*`, `/library/e-library/*`, `/online-classes`, `/hifzi`, `/fina/*`, `/miqat/*`, `/media/upload*`, `/push/*`.
- Push: web-push only (`services/push-notifications.service.ts`, table from `migrations/220_create_push_subscriptions.sql`). Callers: grievance, inspection, inspector-broadcast, online-class, training, weather, fina, hifzi. Not wired: messaging, attendance, fees, grades, assignments, events.
- Files: multer memory storage -> Supabase Storage; signed URLs TTL 300 s (private) vs public URLs (media-recordings, school-assets, reading logs). Puppeteer PDFs return signed URL JSON.
- Tenant: school from profile; `X-School-Id` header only for super_admin; admin `campus_id` validated by `utils/campus-validation.ts`; plugin gates cached 60 s (`miqat-enabled`, `hifzi-enabled`, ...).
- Heavy: `gpa-rank` (`services/student-dashboard.service.ts` ~1522-1600), parent gradebook/homework N+1 (`parent-dashboard.service.ts`), students default limit 1000, miqat bootstrap full roster.
- Cron (node-cron, Asia/Karachi) and job runners run in the API process.

## Frontend (`frontend/src`)
- 747 pages: admin 372, teacher 128, student 91, parent 86, librarian 22, inspector 12, superadmin 11, public 7, auth 6.
- `lib/api/*` 131 modules: 51 duplicate `apiRequest`, 102 import `getAuthToken`, ~76 import `AuthContext.handleSessionExpiry`, 17 use browser APIs (downloads, FileReader, localStorage, window.open), none import `next/*`.
- `context/AuthContext.tsx` 1,384 lines, DOM-coupled. Zustand unused. SWR in ~176 files. `hooks/` 41 files.
- `config/sidebar.ts` (1,494 lines) and `config/plugins.ts` are the per-role feature source; role-to-dashboard map duplicated in 3 places.
- i18n: next-intl (ICU), `messages/en.json`, `ar.json` (~12.7k keys, one key out of sync); RTL via `dir`; 446 files use physical `ml/mr`.
- Theme: `app/globals.css` oklch tokens (convert to hex/hsl for NativeWind); brand navy `#022172`, blue `#003dd6`; fonts Inter / Cairo.
- Server code in Next is only a locale route/action; no business logic.
- Login page stores "remember me" credentials in localStorage (do not port).

## Scanner (`scanner-app/src`)
- Vite React 18 PWA. Device auth: ECDSA P-256 keypair, signed requests; staff rotating-code uses supabase-js password login. QR HMAC-SHA256 (symmetric; devices hold keys, known tradeoff). Offline queue in IndexedDB (idb). Sync with backoff. Reusable pure logic: `geofence.ts`, Base32/struct parse in `cardVerify.ts`, `sync.ts` batching/backoff, dedupe in `GateScan.tsx`. Browser-only: IndexedDB, WebCrypto, geolocation, camera (qr-scanner), service worker, wake lock, WebAudio.
- Existing icons are 1x1 placeholders; scanner brand colour `#0F3D2E`.

## Database / infra
- RLS enabled broadly in `backend/schema.sql` (dump may not match prod); backend uses service role anyway.
- Buckets: ~20 in migrations; public ones include fee-attachments, accounting-attachments (privacy concern).
- Realtime used directly by web for NotificationBell, Jitsi polls, whiteboard.
- Deploy: cPanel + Passenger, no CI. `.github/` has no workflows.
- Compliance gaps: no account deletion, no platform privacy policy.
- No payment gateway in code (fees are ledger-only).
