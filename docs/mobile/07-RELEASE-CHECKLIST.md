# Release checklist (mobile app)

What has to be true before a store build goes out. Items marked **(client)** need an account,
a decision or a value from the client; everything else is in the code already.

## 1. Accounts and project (client)
- [ ] Expo account; run `npx eas init` in `mobile/` once (adds `extra.eas.projectId` to `app.json`).
      Then turn on over-the-air updates: `npx eas update:configure` (adds `updates.url`; `runtimeVersion`
      is already `appVersion`, and `eas.json` already has the `preview` / `production` channels).
- [ ] Apple Developer account (bundle id `ly.istudent.app`), App Store Connect app record.
- [ ] Google Play Console (package `ly.istudent.app`), Play app signing.
- [ ] Firebase project for Android push: `google-services.json`, FCM key uploaded to Expo.
- [ ] APNs key uploaded to Expo for iOS push.

## 2. App build settings (EAS environment "production") (client values)
Set in the Expo dashboard (Environment variables, environment `production`), not in a file:
- `EXPO_PUBLIC_API_URL`: the HTTPS API, e.g. `https://api.example.ly/api`
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`: public values only
- `EXPO_PUBLIC_WEB_URL`: the website (default `https://istudent.ly`)

A production build stops (`scripts/check-release-env.js`, run by EAS after install) if any of these
is missing, not `https://`, points at a local address, or if a service-role key is present.

## 3. Server settings (VPS backend `.env`) (client values)
- `MOBILE_MIN_VERSION_IOS/ANDROID`, `MOBILE_LATEST_VERSION_IOS/ANDROID`: forces / suggests updates.
- `MOBILE_STORE_URL_IOS/ANDROID`: store pages (the "Update" button).
- `MOBILE_PRIVACY_URL`, `MOBILE_TERMS_URL`, `MOBILE_SUPPORT_EMAIL`, `MOBILE_ACCOUNT_DELETION_URL`:
  shown in Settings. **Both stores require a privacy policy and an in-app account deletion path**
  (the app's "Delete account" uses the URL, else the support email).
- `MOBILE_MAINTENANCE`, `MOBILE_MAINTENANCE_MESSAGE_EN/AR`: maintenance screen switch.
- `CRON_SECRET`: required for the fee cron endpoints (they fail closed without it).
- Supabase Auth: add `studently://**` to Redirect URLs (password reset links open the app);
  custom SMTP for auth emails (the built-in mailer sends only a few an hour).

## 4. Database (run by the client, in order)
- [ ] `backend/migrations/historical_grades.sql`
- [ ] `backend/migrations/qirtasi_curriculum_per_school.sql`
- [ ] `backend/migrations/inspection_media_phone_audio.sql` (voice notes from phones)
- [ ] `backend/migrations/discipline_library_related.sql` (library incidents; run before the backend that
      uses it, or librarians' Discipline page and the "Library-related" filter fail until it runs)

## 5. Crash and error reporting
- The app reports crashes (screen errors and uncaught JS errors, release builds only) to
  `POST /client-errors`; the backend writes one `[client-error] {...}` line per report to its log.
  Search the server log for `[client-error]`. Rate limited per IP; nothing is stored.
- Native crashes (outside JS) are not captured. Moving to a hosted service (e.g. Sentry) only means
  replacing `send` in `mobile/src/lib/monitoring.ts` and adding its Expo plugin. **(client decision)**

## 6. Quality gates (all must pass)
- `npm run typecheck` and `npm test` at the root (packages + mobile)
- `cd mobile && npx expo lint` (0 errors; `react-hooks/set-state-in-effect` is a warning for the
  remaining admin form-prefill effects, see `eslint.config.js`)
- `cd backend && npx tsc --noEmit && npx jest` (7 suites fail in untouched code: qaida,
  hadith-forty, timetable solver/generation, user-profiles reset; see `06-BACKEND-BACKLOG.md`)

## 7. Device test before submitting (preview build on real phones, iOS and Android)
- Sign in as every role: super admin, admin (school with branches; switch campus), staff, teacher,
  student, parent, librarian, inspector. Check the menu and three screens per role.
- Arabic and English, light and dark, a small Android phone.
- Gates: forced password change, 2FA setup / code / recovery, agreement, suspended school.
- Offline: airplane mode shows the offline bar; screens recover when back online.
- Camera / photos / microphone / location permission prompts (deny once, then allow).
- Print / PDF share, file upload, password reset link opening the app.
- Kill the app during a screen; a crash screen offers Retry / Home (force one in a dev build).

## 8. Store submission
- Store listing in EN and AR, screenshots (phone), app icon, feature graphic (Android).
- App Privacy (iOS) / Data safety (Android): account data, photos and voice notes the user uploads,
  approximate location (Miqat check-in), crash reports (no third party).
- Review account for Apple / Google with a demo school (read-only data).
- `npx eas build --profile production --platform all`, then `npx eas submit`.

## 9. Rollback
- JS-only fix: `npx eas update --channel production` (after step 1 is done).
- Native change or bad build: raise `MOBILE_MIN_VERSION_*` only after the fixed build is live; use
  `MOBILE_MAINTENANCE=true` to stop use during an incident.
