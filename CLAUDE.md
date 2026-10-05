# Studently (iStudently)

School management + LMS. `backend/` is Express + Supabase (TypeScript), `frontend/` is Next.js 16 (React 19.2.3, next-intl, SWR, shadcn). Mobile app work (Expo, Android + iOS) is planned in `docs/mobile/`.

## Mobile project: read first
- `docs/mobile/00-PROJECT-SCOPE.md`: scope, decisions already made (do not re-litigate), backend additions
- `docs/mobile/01-ARCHITECTURE.md`: target structure, auth flow, push, Miqat scanner
- `docs/mobile/02-SPRINT-PLAN.md`: 14 one-week sprints, "Must finish" / "Drop first" lists
- `docs/mobile/03-SCREENS-AND-ASSETS.md`: 94 mandatory screens
- `docs/mobile/04-AUDIT-FINDINGS.md`: backend/web/scanner audit
- `docs/mobile/PROGRESS.md`: update at the end of every session

## Layout
- `mobile/`: Expo app (Expo Router), npm workspace
- `packages/shared-types`, `packages/api-client`, `packages/shared-utils`, `packages/miqat-core`: npm workspaces, consumed by mobile and (via tsconfig path + `transpilePackages`) by the web
- `backend/` and `frontend/` are **not** workspaces: each keeps its own lockfile because cPanel deploys run `npm install` per folder.

## Decisions
- One app for all roles; multi-school (tenant discovery by school code needed).
- `scanner-app/` is not in this repo; Miqat logic is derived from `backend/src/services/miqat/*` until it is added.

## Do not
- Query Supabase tables directly from the app (API only, except supabase-js auth and optional Realtime).
- Put the service-role key or any backend `.env` in `mobile/`.
- Copy web UI components or `next/*` imports into mobile or packages.
- Store credentials in plain text (the web "remember me" localStorage password must not be ported).
- Use physical left/right styles; use start/end (RTL).
- Return `req.profile` to clients (it is `select('*')` and includes TOTP/password columns).

## Commands
- Backend: `cd backend && npm run dev` (port 5000), `npx tsc --noEmit`, `npx jest`
- Web: `cd frontend && npm run dev` (port 3000), `npm run build`
- Packages + mobile (root): `npm install`, `npm run typecheck`, `npm test`
- Mobile: `cd mobile && npx expo start`, `npx expo run:ios`, `npx expo run:android`
