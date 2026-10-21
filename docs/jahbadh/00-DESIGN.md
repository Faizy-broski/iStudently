# Jahbadh Assessment Suite: design reply and Phase 1 (Grades core)

This answers the brief's request before Phase 1: the schema, the route list, the PDF pipeline with an Arabic report-card sample, and the points where the brief conflicts with the platform. Phase 1 is built: it covers the official distribution, grade entry, computation, the results sheet and the second-round sheet, on the web and in the mobile app.

Sample report card: [`sample-report-card.pdf`](sample-report-card.pdf). It uses the brief's worst case: grade 10 with 11 subjects, all 12 options on, a long four-part name. It fits on exactly one A4 page.

---

## 1. Where it lives in the platform

| Brief assumes | Platform reality | What we did |
|---|---|---|
| Next.js `app/api` route handlers | The API is a separate **Express + Supabase** backend, shared by the web and the mobile app | All routes are in Express under `/api/jahbadh-grades/*`. The web and the app call the same API. |
| A new module | Schools switch features on per school or campus as **plugins** | The plugin is `jahbadh_grades`, activated in Settings → Plugins. When it is off, every route returns 403 and the menu entries are hidden. |
| Granular permissions (`grades.enter`, …) | Roles plus per-module grants on user profiles (`can_use` / `can_edit`) | See the mapping in section 5. |
| Web only | Web plus the Expo app (Android and iOS) | Every Phase 1 screen exists on both. |

**Rules are data, not code (B2).** The memo is stored as tables, seeded from Appendix A. Each school receives its own editable copy when it runs Setup, so a new memo is a data edit, not a code change. Totals, results, ranks and decisions are **never stored**: they are computed on every read by a single engine (B5). The server, the web grid (live totals) and the app all use that same engine.

---

## 2. Schema

Migration files: `backend/migrations/jahbadh_grades.sql` (tables) and `jahbadh_grades_seed.sql` (Appendix A, generated from the same source file the engine tests use).

| Table | Purpose |
|---|---|
| `jg_grade_rules` | One row per grade or track (codes 1–14) and memo version. Holds the system name, `no_fail`, `total_min`, `exam_min`, stage names, the official rule text, the certificate name and the next grade name. `school_id NULL` marks the platform template. |
| `jg_grade_subjects` | The subjects taught in a grade: official name, short key, weekly periods, display order. |
| `jg_components` | The components of each subject: stage (1–3), order, official name, max score (decimal, e.g. 7.5) and the `is_exam` flag. |
| `jg_grade_level_map` | Links each school grade level to its official grade code. Suggestions are made from the level names. |
| `jg_subject_links` | Links each memo subject to the school's own subject, so the teachers who teach it can enter marks. |
| `jg_marks` | One mark per student × component × year: `value` (nullable), `is_absent` (kept separate from 0), `source` (`teacher` / `control_import`), who entered it and when. |
| `jg_round2_marks` | One second-round exam mark per student × subject × year. |
| `jg_stage_locks` | Stage locks per section, either for one subject or for all subjects. |
| `jg_settings` | Per school or campus: FollowRate, ExcelRate, the grading scale, and print header lines (education office, municipality, principal, homeroom teacher, logo). |
| `jg_audit_log` | Append-only audit log. A database trigger blocks UPDATE and DELETE. It records who, when, the action, the before state and the after state. |
| `students` + 4 columns | `nationality`, `mother_name`, `place_of_birth`, `registration_number`, which are printed on report cards. They are editable in the student form on the web and in the app. |

Existing platform data is reused as is: students (names, gender, date of birth), sections, grade levels, subjects, course periods (to know which teacher teaches what), academic years and campuses.

---

## 3. Routes (Phase 1)

| Method and path | Who | Purpose |
|---|---|---|
| `GET /rules`, `GET /rules/:gradeCode` | admin, teacher | Read the official distribution (the school copy, or the template before Setup). |
| `PUT /rules/:gradeCode` | admin | Edit the school copy. Components that already have marks cannot be removed, and their max cannot go below an existing mark. Audited. |
| `POST /setup` | admin | Copy the template to the school. |
| `GET/PUT /settings` | admin (teachers can read) | Thresholds, grading scale, header lines. |
| `GET/PUT /grade-map`, `GET/PUT /subject-links` | admin | Link the school's structure to the memo. |
| `GET /sections` | admin, teacher | Mapped sections. Teachers get only the sections they teach. |
| `GET /sections/:id/subjects` | admin, teacher | Only the subjects taught in that grade, each with a `can_enter` flag. |
| `GET /sections/:id/subjects/:sid/grid` | admin, teacher | Students in Arabic alphabetical order, components with their max, marks, locks, the computed rows and the footer summary. |
| `PUT /sections/:id/subjects/:sid/marks` | admin, the subject's teacher | Bulk cell save. Checks: 0 ≤ value ≤ max, absent ≠ 0, stage not locked, student enrolled in the section, ownership. Errors name the max. Audited. |
| `PUT /sections/:id/subjects/:sid/round2` | admin, the subject's teacher | Second-round mark, accepted only for referred students and capped at the exam max. |
| `GET/POST/DELETE /sections/:id/locks` | admin | Lock or unlock a stage. Audited. |
| `GET /sections/:id/results` (+ `.pdf`) | admin, teacher | Results sheet (B6-4). |
| `GET /sections/:id/second-round` (+ `.pdf`) | admin, teacher | Failing and second round (B6-5), with the «≥ n», «✓», «✗» and «متعذر» cells. |
| `GET /sections/:id/audit` | admin | Audit trail of the section. |
| `GET /sample-report-card.pdf` | admin | The design sample. |

---

## 4. PDF pipeline

- **Engine:** HTML rendered to A4 by headless Chromium (Puppeteer). This pipeline already runs other Arabic documents on the platform. Chromium handles Arabic shaping and RTL natively.
- **Font:** Cairo, embedded with the backend (OFL licence), so the output is identical on every server and needs no network access.
- **Mixed text:** numbers that carry a sign or a percent are isolated inside Arabic sentences so they don't flip direction.
- **Branding:** the Jahbadh palette (#0C285C / #1548A0 / #256ED6 / #F4B41A) is defined once as print tokens. Screens use the app theme.
- **Footer:** «جهبذ للخدمات التعليمية والتطبيقات والوسائل التفاعلية — www.jahbadh.com». The school logo is supported.
- **Sample:** the report card sample covers the B7 layout:
  - header band, info block and the full grades table (works / exam / total per stage, minimum pass mark, final, second round, estimate, class average, performance bar, trend);
  - result tiles, a badge, activities, attendance and the «قراءة جهبذ» insight (gender-aware);
  - notes, guardian tips, signatures and stamp, rule text and quote.

  The sample uses demo marks; real report cards come in Phase 2.

---

## 5. Points we need you to confirm

1. **Thresholds for 2nd secondary (B5 note b).** We load Appendix A exactly: 50% of the subject total and 40% of the exam marks for codes 11–12, and 50% / 50% for 3rd secondary (codes 13–14). The official card's 50% versus the memo's 60% is still open. Both values are editable per grade in «التوزيع الرسمي», so a school can change them once the ministry confirms.
2. **Limit on second-round subjects (B5 note a).** None, as in the prototype. Tell us if a cap is needed.
3. **Permissions mapping.** The platform has roles plus module grants per user profile instead of named permissions:

   | Brief permission | Platform |
   |---|---|
   | `grades.enter` | Teacher, for the subjects they teach in that section (from the timetable or course periods) |
   | `grades.view_section` | Admin, or staff granted the module. There is no "homeroom teacher" flag in the platform yet; adding one is a small follow-up if you want homeroom teachers to see all subjects. |
   | `grades.lock_stage`, `grades.rules.manage` | Admin |
   | `grades.report_cards.publish`, `grades.analytics.view` | Phase 2 and Phase 3 |

4. **Absence pre-fill from the attendance module (B6-9).** This needs dates for each stage (or a link to marking periods). Tell us which you prefer.
5. **Grade 12 codes.** We use codes 13 and 14 for 3rd secondary science and humanities, as in A3. Appendix A labels those tables "Grade 12"; the content is the same.

---

## 6. What Phase 1 includes

- **Official distribution:** all 14 grades and tracks. Tests check the brief's acceptance figures:
  - grade totals 720…1280;
  - semesters of 620 / 600;
  - subject counts 5 / 6 / 9 / 10 / 11;
  - ★ exam flags, including the two physics papers.
- **Setup:** copy the memo, map grade levels to the 14 codes (with suggestions), link subjects (with suggestions), settings.
- **Grade entry (web grid):**
  - stage-grouped columns with each max and «امتحان» under exam components;
  - live totals, recorded max, %, exam total, second round, final mark, estimate and result chip;
  - Enter / Tab / arrow-key navigation, paste of a column from Excel, «غ» for absent;
  - autosave with a status indicator, undo, red highlight below FollowRate, stage locks;
  - footer averages, highest and lowest, and the summary line.
- **Grade entry (app):** a student list with total, % and result, and a per-student form grouped by stage (max shown, absent toggle, second round) with previous / next navigation.
- **Results sheet and second-round sheet:** on screen and as printable A4 landscape PDFs.
- **Engine (B5):** stage totals, TOT / EMX / PCT / EXS, results in the official order, FIN after the second round, «≥ need» rounded up to 0.5, «متعذر», competition ranking (1, 1, 3) and the exact decision wording, with the مادة واحدة / مادتين / n مواد / n مادة forms.
  - Tested at the boundary: entering exactly the need passes; 0.5 less fails.
- **Audit:** every mark, second-round mark, lock, rules edit, setup and settings change is written to the append-only log.

## 7. Phase 2: report cards (built)

Migration file: `backend/migrations/jahbadh_report_cards.sql`.

| Table | Purpose |
|---|---|
| `jg_activity_records` | Art, music and PE levels (ممتاز / جيد جداً / جيد / مقبول), excused and unexcused absence days, and the teacher's note, per student and stage. |
| `jg_school_days` | School days per section and stage, used for the attendance %. |
| `jg_report_card_settings` | Per section: the 12 options (all on by default), the guardian tips and the quotes (rotated per student). |
| `jg_publications` | Which scope of which section has been released to families. |

| Method and path | Who | Purpose |
|---|---|---|
| `GET/PUT /sections/:id/activities` | admin, the section's teachers | Activities and behaviour (B6-9). Absence days cannot exceed the school days. |
| `GET/PUT /sections/:id/report-card-settings` | admin, the section's teachers | The 12 options, tips and quotes. |
| `GET /sections/:id/report-cards?scope=` | admin, teachers | Preview data. |
| `GET /sections/:id/report-cards.pdf?scope=&from=&to=` | admin, teachers | One A4 page per student, the whole section in one PDF, or a range. |
| `GET/POST/DELETE /sections/:id/publications` | admin (listing open to teachers) | Release or withdraw a scope. Releasing notifies the students and their parents. |
| `GET /my/report-cards`, `GET /my/report-cards/:studentId/:scope` | students, parents | Released cards of their own children only. |

How scopes work:
- **Stage 1, 2 or 3:** only that stage's columns. The estimate and the rank are computed on that stage, and the decision tile reads «نتيجة <stage>: <estimate>».
- **Final year result:** all stages, the second-round column, and the official decision.

Options that are switched off disappear and the layout closes the gap. The second-round column is shown only on final-year cards of grades that have a second round.

Not in this phase:
- the optional secondary cover page and guardian-guidance page;
- absence days pre-filled from the attendance module. The stages have no dates yet, so they can't be mapped to attendance periods.

## 8. Phase 3: analytics (built)

Migration file: `backend/migrations/jahbadh_analytics.sql`. It adds two tables, `jg_test_analyses` and `jg_rubrics`, for the only tools that store input. Everything else is computed from the marks on every read, by the shared engine (`analytics.ts`).

| Tool (brief) | Route | What it shows |
|---|---|---|
| Performance dashboard (B6-6) | `GET /sections/:id/dashboard` | Tiles: students, recorded, overall average, pass/promotion rate, excellent, need support. Per subject: max, recorded, mean, mean %, median, SD, highest/lowest, pass rate, count per estimate, stage averages, coursework vs exam mastery and the gap, boys vs girls. Also the strongest and weakest subject, plus charts. |
| Student profile (B6-7) | `GET /sections/:id/students/:sid/profile` (+ `/pdf`) | Per subject: stages, final, %, estimate, result and class average. A student vs class chart, and gender-aware automatic feedback. |
| Early warning (B6-10) | `GET /sections/:id/early-warning` | Risk score /100 using exactly the brief's formula, level, the first matching indicator and the suggested intervention, the top 5 most improved and the top 5 priority. |
| Learning groups (B6-11) | `GET /sections/:id/groups?subject=` | Enrichment ★ / reinforcement ◆ / remedial ●, with the strategies for each group. |
| Test item analysis (B6-12) | `…/tests` CRUD (+ `/pdf`) | Up to 20 questions with Bloom levels. Per question: p, D with the 27% groups, and a verdict. For the test: Cronbach's alpha, SEM, reliability verdict and Bloom mastery. **It reproduces the prototype's sample test exactly** (α 0.41, SEM 1.79, every p and D), which is checked by a unit test. |
| Subject analysis card (B6-13) | `GET /sections/:id/subject-analysis` (+ `/pdf`) | Any subject and any measure (final mark, a stage, or a single component). General statistics, level bands from the school's scale, boys vs girls, comparison with a second measure (who improved and who declined), an automatic reading, the top students and the remedial list. An untaught subject falls back to the first taught one. |
| Rubric builder (B6-14) | `…/rubrics` CRUD, `POST …/rubrics/:id/apply` | Weighted criteria with four descriptors, levels 1–4 per student, and the mark. **"Copy to a component" writes the marks into the grade sheet** through the normal save, so locks, ownership and the audit log apply, and marks are scaled when the maxima differ. |
| Assessment ideas (B6-15) | — (static content) | The prototype's principles and its 20 ideas, each linked to its component, grades and suggested Jahbadh tool. |

These are available to admins, and to teachers for the sections they teach. All pages exist on the web (admin and teacher) and in the app.

## 9. Phases 4–5: Exam Control (built)

Migration file: `backend/migrations/jahbadh_control.sql` (tables `jc_*`). Routes live under `/jahbadh-control/sessions/:id/…`, behind the same **Jahbadh Grades** plugin. On the web the module is at **Exam control** (`/admin/exam-control`, and `/teacher/exam-control` for members). In the app it is under the same menu entry.

### Who can do what

| Role | How it is given | What it opens |
|---|---|---|
| Control chief | Every school administrator | Everything: sessions, unlocking, unmasking, score changes after unmasking, export to Grades, audit log |
| Control member | Added by the chief to a session | Setup, students, committees, schedule and invigilation, alerts, prints, quality |
| Score entry | Added by the chief | Blind entry (1st or 2nd), mismatches, quality report |
| Invigilator | Added by the chief | Exam day: attendance, violations, envelopes |
| Secret numbers | Added by the chief | Generating numbers, the encryption key, and the documents that show secret numbers |

Anonymity is enforced by the server, not only hidden on screen. Before unmasking, the score endpoints return no names, seat numbers or student ids to anyone entering scores.

### Workflow (brief C12)

1. **Session:** name, stage, issue date, the grades sitting the exam. Each paper of the stage becomes one control subject, with its maximum taken from the official distribution.
2. **Students:** pulled from the school. Mark exemptions, withdrawals and special cases (extra time, reader, scribe).
3. **Numbers:** seat numbers (grade code × multiplier, alphabetical or by registration number) and secret numbers. Three modes:
   - random;
   - encrypted (KEY/OFFSET, stored encrypted and never shown again; it reproduces the prototype: 6001 → 60078, 6002 → 67997);
   - simple.
   Every number carries a Luhn check digit.
4. **Committees:** capacity and seat columns. Then:
   - **mixed or sequential distribution**;
   - **serpentine seating** with alternating **A/B paper models**;
   - special cases placed last.
   **Locking** freezes numbers, seats and models before printing.
5. **Schedule and invigilation:** exam days, invigilators with their subject and unavailable days, and a **fair rota**:
   - equal loads;
   - no teacher invigilates their own subject;
   - reserves each day;
   - manual changes are kept and marked.
6. **Alerts (C6.4):** 27 checks, grouped as before / exam day / after, with the names behind each one. They include:
   - capacity, invigilators booked twice, same-grade neighbours, duplicate numbers;
   - envelopes that do not match attendance, repeat offenders;
   - missing or double-entry scores, clustering at the pass mark, marker bias.
7. **Prints (C8, Arabic, A4, with QR where enabled):**
   - general list, secret lists, committee mirror, seating map, student cards;
   - booklet covers with a detachable stub;
   - timetable, invigilation rota;
   - attendance sheet, envelope labels, delivery sheet;
   - minutes of opening, absence, sealing and incidents;
   - results, honor board, certificates.
   Documents that show secret numbers are for the secret-numbers role only.
8. **Exam day:**
   - a live dashboard (refreshes every 10 s);
   - attendance (absent غ, late ت, out خ, minutes late);
   - violations by seat number, with the action taken;
   - envelope count and seal, checked against the students present.
9. **Blind entry:**
   - scores by secret number, entered twice by **different people**; the server refuses the same person doing both entries of a subject;
   - autosave, «غ» for absent;
   - a booklet QR scan jumps to its secret number.
10. **Unmasking gate:** names appear only when all four conditions hold:
    1. all scores entered;
    2. both entries match;
    3. the chief approved;
    4. «show names» is switched on.

    Each step is logged. After unmasking, a score changes only through the **appeals log**, with a reason and the chief's approval. The log cannot be edited.
11. **Quality:**
    - per subject: completion, mean, pass / excellence / weak rates, level bands, a verdict;
    - top 10 and the support list;
    - a reproducible **audit sample** (same seed, same sample);
    - **marker bias** per grader;
    - **clustering** at the pass mark.
12. **Results:**
    - results and the honor board (top N per grade);
    - second-round candidates, from which a linked second-round session is created;
    - guardian messages (WhatsApp link, or an in-app notification);
    - **export to Grades**: a preview of new and changed marks, then a commit into the exam components (`source = control_import`). It goes to the second-round marks when the session is a second round.

### QR codes (C7.3)

Digits only, so keyboard-wedge scanners work under an Arabic keyboard layout. Each code has:
- a type prefix and the session code;
- a Luhn check digit;
- a 6-digit HMAC signature that only the server can make. The key comes from `JC_QR_SECRET`, or `CREDENTIALS_ENCRYPTION_KEY` when that is not set.

| Code | Layout | Length |
|---|---|---|
| Booklet | 11 + session + secret + check + signature | 20 |
| Stub | 12 + session + secret + seat + check + signature | 26 |
| Card | 13 + session + seat + check + signature | 19 |

`POST /sessions/:id/scan` validates a code and rejects:
- a wrong format, prefix, length or check digit;
- a forged signature;
- a code from another session.

Booklets resolve to the secret number only.

## 10. Phase 6: QR scanning and the Exam Room Timer (built)

### QR scanning screens (C7.4, C7.5)

One scan field is used everywhere, on the web and in the app.
- **Input:** it takes a USB or Bluetooth 2D scanner in keyboard mode (a fast burst of digits and Enter, or a complete code without Enter), or the camera:
  - in the app, always;
  - on the web, in browsers that have a built-in QR reader (Chrome, Edge, Android). It is switched on by the session's "camera scanning" setting.
- **Checks before sending:** prefix, kind, length and check digit, so a partial or misread code never reaches the server.
- **Checks on the server:** the session and the signature.
- **Feedback:** each scan flashes green or red with the reason. The web also beeps.

| Screen | What scanning does |
|---|---|
| Score entry (1st and 2nd) | A booklet jumps to its secret number and the cursor lands in the score. With a **subject lock**, Enter goes back to the scan field for the next booklet. |
| Envelope receipt | Pick the committee and scan every booklet. The live lists show received ✔, missing ✖, duplicate ⚠ and misplaced ⚠ booklets (another committee, a student marked absent, not sitting today, unknown). Then **seal**: the count and the scanned list are logged. The list survives a page reload. |
| Attendance at the door | Scan cards as students enter. **Finish** marks everyone not scanned absent, after a confirmation. A card from another committee or another exam is refused. |
| Violations | Scanning a card fills in the seat number. |
| Stub check (unmasking reconciliation) | A stub shows its student. Secret-numbers role only. |

**Regenerate session code** (chief, logged) invalidates every printed code of the session. Session codes are now unique within a school, so a cover from one session can never pass another's check.

### Exam Room Timer (Part D)

The timer is at `/admin/exam-timer` and `/teacher/exam-timer`, on the web and in the app. It is a full-screen board for the classroom screen or a tablet.

**Exam selection**
- Stage, grade (from the official distribution) and subject, plus free text for both.
- Period or semester.
- The assessment type: final / end-of-term / certificate / second-round exam, or short / monthly / oral / practical test. The title and the rules shown on the board follow the type.

**Countdowns**
- Up to **3 parallel tracks**, each with its own countdown, pause, +5 / +10 / −5 minutes, end and reset.
- **Extra time per seat**, entered as «6012 15». It can also be imported from the special cases in Exam Control.

**Schedule**
- **Import** from Exam Control (session → date → start time → committee) or paste a timetable.
- **Auto-start** at the scheduled time. Opened late, the timer counts from the scheduled start, so it shows the real time left.

**Room controls**
- Announcement banner.
- **PIN lock**: the PIN unlocks the controls for 2 minutes.

**Display and sound**
- Voice alerts at 30, 15, 5 and 1 minutes left, at the start, at the end and when exit is allowed. They can be a beep, Arabic or English speech, or the school's recorded clips.
- Display as large digits or a countdown ring. "Automatic" uses the ring for grades 1–3.
- **Exit-allowed sign** after ½, ⅓ or ¼ of the time.
- The screen stays on, with an optional noise meter, an attendance counter (it can be pulled from the control) and the school logo.
- English screen for a single English exam (on by default).

**Minutes and continuity**
- **Event log** with printable minutes and copy. **Attach** sends the minutes to the committee's exam-day record, where they are visible under *Exam day › Timer minutes*.
- **Reload continuity**: the full state is kept on the device, so a refresh or crash resumes exactly. Once loaded, the timer runs without a network connection.

## 11. Going live (school side)

1. Run `jahbadh_grades.sql`, `jahbadh_grades_seed.sql`, `jahbadh_report_cards.sql`, `jahbadh_analytics.sql`, then `jahbadh_control.sql`, in the database. Set `JC_QR_SECRET` on the server (any long random string) so QR signatures do not depend on another key.
2. Activate the **Jahbadh Grades** plugin for the school.
3. Open **Setup**:
   - copy the official tables;
   - confirm the grade-level codes;
   - link the subjects;
   - set the thresholds and header lines.
4. Teachers find **Classes & grade entry** under Grades.
5. For exams, an administrator opens **Exam control**, creates a session, chooses its grades and adds the members (score entry, invigilators, secret numbers). The session home lists the steps in order.
6. For each exam room, open **Exam timer** on the room screen, load the schedule from Exam control (or type it), set a PIN and leave it running.
