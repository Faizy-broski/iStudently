# Backend backlog for the mobile app

Checked against the code on 2026-10-05. Tick items when done. Sprint = when the app first needs it.

## P0 (blockers)
| # | Item | Sprint | Notes / where |
|---|---|---|---|
| 1 | [x] HTTPS API hostname | 1 | Production API answers at `https://istudent.ly/api` with a valid certificate (`/api/status` 200, checked 2026-10-05). Still needed: an HTTPS **staging** host. The old `http://102.213.183.100:8080` entries in `config/env.ts` and `app.ts:183` can be removed later. |
| 2 | [x] `GET /auth/me` | 2 | Done 2026-10-06: `controllers/auth.controller.ts` `getMe` (safe profile allow-list, `gates` {force_password_change, two_fa state, agreement}, `plugins`, `school` branding). Exempt from the 2FA block in `authenticate()` (exact path) so clients can learn the 2FA state. 10 jest tests incl. no-secret-leak. Still to add: per-school primary colour (none exists today). |
| 3 | [ ] Tenant discovery by school code/slug | 3 | **Multi-school confirmed.** Public endpoint that returns school id, name, logo and login background for a code. `resolve-username` is global today. |
| 4 | [ ] Forgot / reset password with an app deep link | 3 | Nothing exists today. |
| 5 | [x] Rate limit + fix `POST /public/resolve-username` (2026-10-06: wildcards escaped = case-insensitive exact match, ambiguous names refused, 20 failed lookups / 15 min per IP; response shape unchanged for the web. Still returns the email by design: the 404 for unknown names stays because the web shows it) | 3 | `routes/public-pages.routes.ts:201`: `ilike` on raw input means `%`/`_` are wildcards (`adm%` returns a matching user's email), plus no rate limit. Use exact `eq` on a lower-cased username, and return the same response for unknown users. |
| 6 | [ ] Phone push | 5 | `device_tokens` table, `POST /push/register-device`, `DELETE /push/device/:id`, FCM/APNs (or Expo push) branch in `dispatch()` (`services/push-notifications.service.ts:160`), stale-token pruning, `sendToRole` campus filter. |
| 7 | [ ] `GET /miqat/cards/mine` | 7 | `routes/miqat/cards.routes.ts`: all routes are `requireAdmin`. Reuse `signCardPayload` in `services/miqat/card-crypto.ts`. |
| 8 | [ ] Parent child-ownership audit | 8 | Every `parent-dashboard` method, with negative tests. |
| 9 | [ ] Account deletion request + anonymise | 9 | Store requirement. |
| 10 | [ ] Public privacy policy + terms pages | 9 | Store requirement. |

## Super admin prerequisites (Phase C0, 2026-10-06)
| Status | Item | Notes |
|---|---|---|
| **Done** | Billing API `/api/platform-billing/*` (plans CRUD, records list/paging/filters/search, create with server invoice number, update, mark-paid, delete), super_admin only | `services/platform-billing.service.ts`, `routes/platform-billing.routes.ts`, zod validation, 14 route tests (real role middleware). Onboarding now uses the same random invoice numbers. **The web still uses direct Supabase for billing**: switching `frontend/src/lib/api/billing.ts` to this API is a web change awaiting approval. RLS checked by the user (2026-10-06): writes on both tables are super-admin only (no tampering hole). One read leak: any profile in a school could read that school's invoices (policy had no role check). Fixed: `backend/migrations/fix_billing_records_rls.sql` (admins only) **applied by the user and verified 2026-10-06**. |
| **Done** | Dashboard `GET /api/dashboard/summary` | One call, real month-over-month numbers, revenue per currency. `services/platform-summary.ts`, 5 tests. |
| **Done** | Credentials read no longer has to reset the password | `GET /schools/:id/admin/credentials?regenerate=false` returns `has_password:false` instead of resetting; explicit `POST /schools/:id/admin/credentials/regenerate`. Web card unchanged (still uses the old auto-generate); switching it is a web change awaiting approval. 2 tests. |
| **Done** | `seed-defaults` target school | Super admin may pass `school_id`; admins stay on their own school. 4 tests. **Web onboarding page needs a 1-line change** to pass the new school's id (`seedDefaultRoles(roles, 'reset', result.schoolId)`), awaiting approval. |
| **Done** | custom-fields campus checks | Read/create/update/delete/reorder now validate `?campus_id` with `resolveSchoolId`; reorder requires admin/staff/super_admin. 6 tests. |
| **Done** | `/media/upload-image` | Rejects unlisted types and content that does not match its type (no store-anything fallback). 3 tests. |
| Decision | `POST /schools` allows school admins | Used by the web admin "academic years" page to create schools. Keep, or restrict to super admin? |
| Decision | SVG uploads | Still allowed into the public bucket (SVG can contain script). Keep for logos, or convert/forbid? |
| Note | `/media/upload-attachment` exists | May already cover message attachments (see "API upload paths" below); check before building a new one. |

## Security findings (found while porting, 2026-10-06)
| # | Status | Finding | Notes |
|---|---|---|---|
| S1 | **Fixed** | `POST /quiz/:quizId/submit` trusted `student_id` from the body: any signed-in user could submit/overwrite answers as any student. | `controllers/quiz.controller.ts`: only students, always as themselves (token); mismatched body id -> 403. Web unaffected (it sends the student's own id). 8 jest tests. |
| S2 | **Fixed** | `GET /quiz/:quizId/submissions/:studentId` had no check: anyone could read any student's answers. | Students: own only. Teacher/admin/super_admin/staff: allowed. Others: 403. |
| S3 | Open, partly | Teachers can view any student's quiz submission, even outside their classes/school. | Needs teacher-to-class scoping (same family as the parent ownership audit, #8). |
| S4 | **Fixed** (2026-10-06, user approved backend + web change) | Student quiz questions exposed correct answers (`answer` with `*` markers, matching pairs in order, `correct_answer`), in both `/quiz/student/:id/questions` and `/quiz/:id/submissions/:studentId`. | `services/quiz-student-view.ts`: students get options without markers, no model/gap answers (gap text with `____`), matching rights shuffled per student with an HMAC seed (secret `QUIZ_SHUFFLE_SECRET`, falls back to the service-role key) and answers mapped back before grading, anatomy = organ only. Revealed only after submission when `show_correct_answers`. Resubmission now 409 (it allowed submit, see answers, resubmit). Web: anatomy picker works without the correct hotspot (server grades), gap text shown. 11 + 9 jest tests. Note: a student mid-quiz during deploy who loaded the old matching order may be mis-graded on matching questions. |
| S5 | Fixed 2026-10-06 | `POST /public/resolve-username` `ilike` wildcard email leak (also P0 #5). | `services/resolve-username.service.ts` + test |

## P1 / P2
- [ ] **API upload paths for the app** (before Sprints 7 and 11): the web uploads message attachments (`/messaging/send` `attachments[]`) and class-diary files (`/class-diary/:id/files`) straight to Supabase Storage and then registers the URL. The app must go through the API, so add server-side upload endpoints like the existing `POST /grievances/:id/attachments/upload` (type/size/magic-byte checks). Also covers the audit's other direct uploads (learning resources, lesson plans, books, logos, profile photos) when the app needs them.
- [x] App-config endpoint (2026-10-06): `GET /public/app-config` from env vars `MOBILE_MIN_VERSION_*`, `MOBILE_LATEST_VERSION_*`, `MOBILE_STORE_URL_*`, `MOBILE_MAINTENANCE`, `MOBILE_MAINTENANCE_MESSAGE_EN/AR`, `MOBILE_FLAGS` (JSON); also returns `server_time` for scanner clock checks. Service `services/app-config.service.ts` (4 tests). No DB table; can move to super-admin settings in Sprint 13.
See `00-PROJECT-SCOPE.md` "Backend additions required". Additional findings:
- `POST /auth/change-password` takes `{ new_password }` only (no current password check).
- Miqat `TEMP DEBUG` key-fingerprint logs in `controllers/miqat/cards.controller.ts` and `devices.controller.ts`: remove when the sign/verify key mismatch they were added for is resolved.
- 8 backend jest suites fail before any mobile change (stale tests, e.g. `qaida/invariants.test.ts` imports a removed `generators` export). Miqat suites all pass.

## Done in Sprint 1
- Removed JWT preview from the malformed-token log (`middlewares/auth.middleware.ts`) and the push endpoint URL from the push send log (`services/push-notifications.service.ts`).

## Contracts the app relies on (verified)
- Device signatures: ECDSA P-256, SHA-256, raw r||s base64; public key as SPKI PEM at enrolment; read endpoints sign `${purpose}:${deviceId}:${timestamp}` (+-60 s); batches sign `JSON.stringify(events)`. Covered by `packages/miqat-core/src/device-signing.test.ts` against the real `verifyBatchSignature`.
- Special 403 codes: `TWO_FA_REQUIRED`, `TWO_FA_SETUP_REQUIRED`, `SCHOOL_SUSPENDED`, `TRIAL_EXPIRED`, `AGREEMENT_REJECTED`; 503 with `retryable: true` when Supabase auth is unreachable. Handled in `packages/api-client`.

## Cross-school access through campus_id / school_id (fixed 2026-10-07)
Found while building the admin app: about 89 controller/route files take `campus_id` (and 35 take
`school_id`) from the query or body and use it directly as the school to read or write, without
checking it belongs to the caller. Example: `GET /students?campus_id=<another school>` returned that
school's students to any admin/teacher/librarian/counselor; `/academics/grades?school_id=...` the same.
Fix, in one place: `authenticate` now rejects (403 `CAMPUS_FORBIDDEN`) any UUID `campus_id` /
`school_id` in the query or top-level body that is not in the caller's school family (same main
school; branches and sibling branches allowed). Super admins are exempt (impersonation). School roots
are cached 10 minutes. Tests: `utils/campus-family.test.ts`; `/school-dashboard` also checks per
handler (`routes/school-dashboard.routes.test.ts`). Not covered: ids nested deeper in bodies, or
other parameter names (e.g. `schoolId`); fix per endpoint as the waves reach them.

## Also fixed 2026-10-07 (found building Wave 1)
- `/default-field-orders` write routes (save, required toggle, reset) had no role check: any signed-in user, including students and parents, could change or reset the school's form-field settings. Now admin/super admin only; reading stays open (forms need it). Test: `routes/default-field-order.routes.test.ts`.
- `GET /auth/last-login/:profileId` returned any user's last sign-in to any school admin. Now limited to the caller's school family (404 otherwise; super admin unrestricted). Test: `controllers/auth.last-login.test.ts`.
- Student/parent responses embedded whole profile rows (`profiles(*)`: TOTP secret, recovery codes, encrypted login password) in 5 queries: get student by number, create/update student, create/update parent. Now `SAFE_PROFILE_COLUMNS` (`utils/profile-columns.ts`); a test fails if `profiles(*)` reappears in services/controllers/routes. Get-by-number also returns grade/section now.
- Known behaviour (not changed): `GET /students/:id` only searches the main school (`profile.school_id`), so branch students are "not found"; the web and app use `GET /students/number/:n?campus_id=` instead.
- `GET /id-card-templates/generate/teacher|staff?…_id=` let any signed-in user (students included) generate the ID card (name, photo, employee details) of any teacher/staff member at any school. Now only the person themselves, an admin of the same school family, or a super admin (404 otherwise). Test: `controllers/id-card-template.access.test.ts`.
- Campus check extended to camelCase `campusId`/`schoolId` (e.g. `POST /students/print-info` trusted `campusId`: any school's student sheets incl. medical). Email log now lists the selected campus or every campus of the school (sends are logged per campus; exact main-school match hid branch emails).
- Open: `POST /teachers/assignments` does not check that teacher/subject/section ids belong to the school (school_id itself is checked). Low impact; fix with the academics wave.
- `POST /fees/cron/apply-late-fees` and `/fees/cron/generate-monthly` run late fees / monthly fee generation for **every school**. The `CRON_SECRET` check only applied when the env var was set (it is not set in the dev `.env`), so any signed-in user (students included) could trigger them. Now fails closed (`utils/cron-secret.ts`, test). **To use these crons on the VPS, set `CRON_SECRET` and send it as `x-cron-secret`.** Nothing in the code calls them today.
- Open: `POST /fees/overrides` and billing-element assignment do not check that the student id belongs to the school (the record is created under the caller's school). Low impact; fix with a shared `assertStudentInSchool` helper.
- `POST /salary/automation/trigger` with no `school_id` generated last month's salaries for **every school**, and any school admin could call it. Now a school admin always runs it for their own school; only super admin may run all schools. Test: `routes/salary.trigger.test.ts`.
- `GET /salary/policies/:id` and `DELETE /salary/policies/:id/teachers/:staffId` had no school check (any admin could read or change another school's salary policy group), and `POST /salary/policies/:id/assign` accepted any group and any staff ids (its upsert on `staff_id` could move another school's staff into this school's group). Now the group must belong to the caller's school family (404) and every staff id must exist in it (403). `PUT /salary/advances/:id` took the approver (`admin_id`) from the body; now the signed-in user. Test: `controllers/salary.policy-scope.test.ts`.
- Fixed (2026-10-07): `/admin/salary` (dashboard, advances) and the advances page sent the main school as `school_id`, but salary records and advances are stored under the staff member's campus, so a branch's totals and advance requests didn't show on the web. Both pages now send `campusId || schoolId`.
- Grades were readable across schools by anyone signed in: `GET /final-grades/student/:id`, `/final-grades/breakdown/:id`, `/grades-reports/transcript/:id` (+ `/gpa`) had no check (a student could read any student's grades), and `GET /final-grades?course_period_id=` / `/grades-reports/course-class-rank` returned any class. `POST /final-grades` (teacher/admin) upserted grades for any student and course period. Now `utils/student-access.ts`: student = self, parent = linked children, other roles = own school family; class lists never for students/parents (404 otherwise). Tests: `utils/student-access.test.ts`.
- `PUT/DELETE /grading-scales/:id` and the nested `/grades/:gradeId` routes had no school check (any school's admin could edit or delete another school's scale). Now `router.param` checks the scale belongs to the caller's school family and the grade row belongs to the scale (404). Test: `routes/grading-scales.scope.test.ts`.
- Not checked yet in the grades area: other `/final-grades` writes (`/calculate`, `/import-gradebook`, `/completion`) and `/grades-reports/transcript/:id/generate` take ids without a family check. Fix when those screens are built.
- New: `GET /grades-reports/gpa-rank?marking_period_id&grade_level_id&campus_id&search` (admin) for the web GPA / class rank page, which called this missing route. Computed live from `student_final_grades` (not the `class_rank_cache`). Test: `services/grades-reports.gpa-rank.test.ts`. `GET /final-grades/student/:id` now also returns the course period's teacher name.
