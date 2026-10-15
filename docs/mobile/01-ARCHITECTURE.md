# Target architecture

```
studently/
  backend/  frontend/  scanner-app/  supabase/
  mobile/                 Expo app (Expo Router)
    app/                  routes: (auth)/, (student)/, (parent)/, (teacher)/, (scanner)/, (extra)/
    src/{components,features,theme,i18n,adapters}
  packages/
    shared-types/         types, role + permission + menu data (titleKey/href/iconName), constants
    api-client/           ONE apiRequest + all lib/api modules, adapter-injected
    shared-utils/         pure helpers, zod schemas, i18n JSON
    miqat-core/           geofence, card parse, sync/backoff, dedupe; crypto + storage via interfaces
```
Tooling: npm workspaces (matches existing npm lockfiles) or pnpm + Turborepo; decide in Sprint 1. Shared packages declare `react` as a peer dependency; keep Metro on the mobile React version (check Expo SDK React vs web's pinned 19.2.3).

## api-client adapters (injected per platform)
`getToken()`, `onUnauthorized()`, `onTwoFARequired()/onTwoFASetupRequired()`, `storage` (async key-value), `baseUrl`, `fileFromUri()`, `download()`. Replaces the web's coupling to `AuthContext.handleSessionExpiry`, `window.dispatchEvent('studently:two_fa_*')`, `sessionStorage` (impersonation header, not needed on mobile), `localStorage`, `URL.createObjectURL`. `viewOnlyGuard` (monkey-patches `window.fetch`) becomes a client interceptor.

## Auth flow
1. Username? `POST /public/resolve-username` -> email (two steps, same as web).
2. `supabase.auth.signInWithPassword` (supabase-js, SecureStore adapter, autoRefreshToken, AppState-driven refresh).
3. `GET /auth/me` (new) -> profile, role, language, flags, plugins, branding.
4. Gates: force password change, user agreement, 2FA (`/two-fa/*`), special 403 codes (`TWO_FA_REQUIRED`, `TWO_FA_SETUP_REQUIRED`, `SCHOOL_SUSPENDED`, `TRIAL_EXPIRED`, `AGREEMENT_REJECTED`), 503 `retryable`.
5. Biometrics unlock the stored session; never store passwords.
6. Optional social login: deep link + expo-auth-session (backend flow is browser redirect today).

## Data
Bearer token to Express. SWR with NetInfo/AppState focus and reconnect. Role-based tabs from shared menu data filtered by enabled plugins from `/auth/me`. Multi-child parent state ported from `ParentDashboardContext`.

## Push
expo-notifications -> `POST /push/register-device` -> backend `dispatch()` (FCM/APNs). Payload `{title, body, data:{type, entityId, route}}`. Tap -> deep link (scheme + universal links).

## Miqat scanner (inside the app, device mode)
Device enrolment with one-time admin code; non-extractable ECDSA P-256 key per device (signatures ieee-p1363 base64, +-60 s timestamp window, canonical JSON signing). Card QR = Base32 of packed 41-byte struct + 16-byte HMAC-SHA256 truncated signature; keys arrive in signed `/bootstrap` (refresh every 15 min); revocation list; 120 s dedupe; direction toggle; batches of 50 with exponential backoff 2 s -> 60 s; offline queue in expo-sqlite; photos 480 px JPEG 0.6; geofence with mock-location flag. Hermes lacks WebCrypto: use `@noble/hashes` / `@noble/curves` or a native keystore module; **signature bytes must match the backend verifier** (`backend/src/services/miqat/card-crypto.ts`, `controllers/miqat/devices.controller.ts`). Reference implementation: `scanner-app/src/lib/*`.

## Do not
- Query Supabase tables directly from the app (web does for a few things; mobile uses the API only, except supabase-js auth and optional Realtime).
- Put the service-role key, or any `.env` with it, in the mobile project.
- Copy web UI components or `next/*` imports.
- Store credentials in plain text.
- Use physical left/right styles; use start/end.
