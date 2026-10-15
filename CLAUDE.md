# Studently (iStudently)

School management + LMS. `backend/` is Express + Supabase (TypeScript), `frontend/` is Next.js 16 (React 19.2.3, next-intl, SWR, shadcn). Mobile app work (Expo, Android + iOS) is planned in `docs/mobile/`.

## Mobile project: read first
- `docs/mobile/00-PROJECT-SCOPE.md`: scope, decisions already made (do not re-litigate), backend additions
- `docs/mobile/01-ARCHITECTURE.md`: target structure, auth flow, push, Miqat scanner
- `docs/mobile/02-SPRINT-PLAN.md`: 16 one-week sprints, "Must finish" / "Drop first" lists
- `docs/mobile/03-SCREENS-AND-ASSETS.md`: 105 mandatory screens
- `docs/mobile/04-AUDIT-FINDINGS.md`: backend/web/scanner audit
- `docs/mobile/PROGRESS.md`: update at the end of every session

## Layout
- `mobile/`: Expo app (Expo Router), npm workspace
- `packages/shared-types`, `packages/api-client`, `packages/shared-utils`, `packages/miqat-core`: npm workspaces, consumed by mobile; the web uses only the shared types for now ("mobile first", 2026-10-06)
- `backend/` and `frontend/` are **not** workspaces: each keeps its own lockfile and is deployed separately (VPS; the user confirmed 2026-10-06). The web does **not** import `packages/` at runtime yet (only `export type *`); switching it would require deploying `packages/` with the web.

## Decisions
- One app for all roles; multi-school (tenant discovery by school code needed).
- Super admin: all 11 web pages natively in the app, but **no school impersonation** (`X-School-Id`) in the app; that stays on the web.
- School admin (2026-10-07): **every admin module natively**, built in waves (People, Fees & accounting, Academics, Attendance & discipline first; plan in `/Users/meticuloustech/.claude/plans/merry-mixing-donut.md`). Campus switcher like the web: the selected campus goes as `campus_id` (query/body) per endpoint, never `X-School-Id`. Staff use the admin shell, limited by permissions and their own campus. Modules not built yet show "Open on website".
- Librarian and inspector (2026-10-12): their web pages natively, each in its own shell (`/librarian`, `/inspector`; the old shared "extra" placeholder is gone). Librarians reuse the admin library screens through `useRoleBase`; inspectors are not tied to one campus.
- Librarians see discipline referrals only when marked library-related (2026-10-12): `discipline_referrals.library_related`; the server forces the filter for librarians and forces the flag on referrals they file (students only). Admins and teachers can set the flag.
- Teachers work only on their own classes (2026-10-12): gradebook and final-grade routes check `requireOwnCoursePeriods` (`teacher_id` or `secondary_teacher_id` = the teacher's staff id); admins are not limited. Use it on any new route that takes a course period for teachers.
- First release is super admin only (2026-10-15): every other role signs in to a "Coming soon" page for its role (`mobile/src/app/coming-soon.tsx`); their route groups are guarded. Release a role by adding it to `RELEASED_ROLES` in `mobile/src/features/auth/release.ts`. Dev builds can open all roles with `EXPO_PUBLIC_ALL_ROLES=1`.
- `scanner-app/` is not in this repo; Miqat logic is derived from `backend/src/services/miqat/*` until it is added.

## Do not
- Query Supabase tables directly from the app (API only, except supabase-js auth and optional Realtime).
- Put the service-role key or any backend `.env` in `mobile/`.
- Copy web UI components or `next/*` imports into mobile or packages.
- Store credentials in plain text (the web "remember me" localStorage password must not be ported).
- Use physical left/right styles; use start/end (RTL).
- In mobile screens (React Compiler is on), read possibly-missing data inside hooks or render-time callbacks (`useApi` keys, `useAction`, `onPress`) through `x!.prop` or `x?.a ? [x.a] : null`: the compiler reads `x.prop` during render and crashes while `x` is still loading. Copy it into a local first (`const id = s?.id ?? null`), or read ids from the SWR key in the fetcher.
- Select `profiles(*)` in anything returned to clients (use `SAFE_PROFILE_COLUMNS`), or return `req.profile` to clients (it is `select('*')` and includes TOTP/password columns).

## Commands
- Backend: `cd backend && npm run dev` (port 5000), `npx tsc --noEmit`, `npx jest`
- Web: `cd frontend && npm run dev` (port 3000), `npm run build`
- Packages + mobile (root): `npm install`, `npm run typecheck`, `npm test`
- Mobile: `cd mobile && npx expo start`, `npx expo run:ios`, `npx expo run:android`
