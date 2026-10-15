# 16-week sprint plan (one-week sprints, one developer + Claude)

Tick items as they finish. Update `PROGRESS.md` at the end of each session. "Drop first" = postpone in this order if behind. Design runs one week ahead of building. Store review time is outside the 16 weeks.

## Change 2026-10-07: school admin gets every module
The admin "on the go" set in Sprint 15 is replaced by a separate admin track: a 2-week foundation
(Wave 0: campus switcher, admin menu filtered like the web, native 2FA/agreement/forced password,
dashboard) and seven waves (People 4 wk, Fees & accounting 4, Academics 5, Attendance & discipline 4,
School & settings 4, Resources & services 3, Plugins 4), about 30 weeks. Modules not built yet open
"Open on website". Order versus student/parent/teacher is decided after Wave 2. Plan:
`/Users/meticuloustech/.claude/plans/merry-mixing-donut.md`.

## Milestones
| Milestone | Week |
|---|---|
| M0 Foundations | 2 |
| M1 Sign-in and push | 5 |
| Alpha 1 (about 5 students) | 7 |
| Student + parent app submitted to stores | 9 |
| Teacher app complete | 11 |
| Super admin complete | 13 |
| Full app submitted | 15 |
| Handover | 16 |

## Sprint 1 (Week 1): Setup, shared foundations and decisions  [milestone: Project start]

**Goal:** Remove every unknown and put the shared project structure in place so building can start at full speed in week 2.

**Design needed**
  - [ ] Agree the visual direction: colours, type, icon style, and decide whether to buy a ready-made mobile UI kit or design from scratch.
  - [ ] Set up the design file structure (pages for foundations, components, each role, flows, asset export).
  - [ ] Start the app icon and splash screen concepts.
  - [ ] Convert the website palette into mobile colour tokens (light and dark).

**Server (backend)**
  - [ ] Confirm the live server has a secure (HTTPS) address with a valid certificate; fix before anything else if not.
  - [ ] Prepare a staging copy of the server and database with sample data for every role: student, parent, teacher, librarian, inspector, admin, gate staff.
  - [ ] Remove debug messages that print token fragments, key fingerprints and push addresses from server logs.
  - [ ] Write the list of server additions needed (push device tokens, user-profile service, forgot-password, own QR card, account deletion) and confirm each with the client.

**Shared code**
  - [ ] Create the shared project folders (data types, communication layer, helpers, scanner logic) and connect the website, server and mobile app in one repository.
  - [ ] Set up automatic build and type checks so a change for the app cannot silently break the website.
  - [ ] Merge the two conflicting copies of the shared data types (one is out of date and lacks a role).
  - [ ] Start the single shared server-communication client that replaces the 51 duplicated copies used by the website today.

**Mobile app**
  - [ ] Create the mobile app (Expo) with Android and iPhone builds.
  - [ ] Check the toolkit version works with the website's technology version and fix any conflict now.
  - [ ] Run four quick experiments: signing scanner requests on a phone, joining a video class, loading English and Arabic text, and the styling approach.
  - [ ] Open the Apple Developer, Google Play and Firebase (push notification) accounts.

**Testing and quality**
  - [ ] Automatic checks run on every change (build, type check, existing website tests).
  - [ ] Blank app installed on one real Android phone and one real iPhone.
  - [ ] Record the results of the four experiments, with a fallback chosen for any that fail.

**Demo:** Blank app opening on both phones; website unchanged; staging server reachable over a secure address; experiment results summary.

**Must finish**
  - [ ] Secure server address confirmed.
  - [ ] Staging server with sample data for all roles ready.
  - [ ] Store and Firebase accounts opened.
  - [ ] Shared project builds for web and mobile.
  - [ ] Experiments finished with decisions recorded.

**Drop first if behind**
  - [ ] Splash and icon concepts (move to week 3).
  - [ ] Fifth and later server list items (move to the week they are needed).

**Needs from client:** Client decisions: one school or several, final scope, secure server address.; Apple and Google developer account access.; Access to the server and database for staging.

**Main risk:** The live server may not be secure, or the toolkit version may conflict with the website. Both would delay everything; they are tested in the first days of this week.

---

## Sprint 2 (Week 2): Shared code, "who am I" service and design system  [milestone: M0 Foundations complete]

**Goal:** Move the website's reusable logic into shared code and build the two server services every screen depends on.

**Design needed**
  - [ ] Design system version 1: about 20 core components (buttons, text fields, cards, list rows, chips, tab bar, sheets, toasts, skeletons) in English and Arabic, light and dark.
  - [ ] Navigation shell designs for each role.
  - [ ] Sign-in and password screens ready for build in week 3.

**Server (backend)**
  - [ ] Build the "who am I" service returning the user's profile, role, language, 2FA state, enabled school modules and branding.
  - [ ] Build the app configuration service: minimum app version, maintenance mode and feature switches.
  - [ ] Design the forgot-password flow with a link that opens the app.

**Shared code**
  - [ ] Move about 40 feature modules for all roles into the shared communication layer; isolate the 17 modules that use browser-only features behind small adapters.
  - [ ] Separate menu and role configuration from website visuals so the app can reuse it.
  - [ ] Move the English and Arabic translation files into the shared area and check they load in the mobile toolkit.
  - [ ] Share form-checking rules and date and format helpers.

**Mobile app**
  - [ ] Install the UI kit and apply the design tokens.
  - [ ] Language switching including right-to-left layout, with Arabic and English fonts.
  - [ ] Build the first reusable components and a gallery screen to review them on a phone.

**Testing and quality**
  - [ ] Website regression run after every module move.
  - [ ] Check translation loading and right-to-left layout on real phones.
  - [ ] Test the new services on staging with each role.

**Demo:** Component gallery on both phones in English and Arabic; website running on the shared code; the "who am I" response for each role.

**Must finish**
  - [ ] "Who am I" and app configuration services live on staging.
  - [ ] At least half of the modules used by the website run on the shared communication layer.
  - [ ] Design system approved.

**Drop first if behind**
  - [ ] Modules for librarian, inspector and admin (move later in the plan).
  - [ ] Dark mode polish.

**Needs from client:** Designer or UI kit decision from week 1.; Test accounts for each role.

**Main risk:** Moving shared code could break the website. Handled by moving one module at a time with automatic checks.

---

## Sprint 3 (Week 3): Sign-in

**Goal:** A user can sign in, stay signed in securely, and recover a forgotten password.

**Design needed**
  - [ ] Final sign-in, school selection, language selection and system screens (no connection, session expired, update required, maintenance).
  - [ ] Splash screen and app icon final versions.
  - [ ] Forgot-password and reset-password screens with strength meter.

**Server (backend)**
  - [ ] Forgot-password and reset-password service with an emailed link that opens the app.
  - [ ] Limit repeated attempts on the username lookup and password change so they cannot be abused; stop the username lookup from revealing which usernames exist.
  - [ ] Make the school lookup work for several schools if the client chose that.

**Shared code**
  - [ ] Shared sign-in helpers: username to email lookup, session state, handling of the special server messages (suspended, trial expired, agreement rejected, two-factor required).

**Mobile app**
  - [ ] Sign-in screen with username or email, password with show/hide, remember device, and school branding and background.
  - [ ] Secure session storage on the phone (no passwords saved in plain text) and automatic session refresh.
  - [ ] Forgot and reset password screens with deep link return.
  - [ ] System screens, language selection, school selection, splash and app icon in place.

**Testing and quality**
  - [ ] Test sign-in with a student, a parent, a teacher and an admin on both phones.
  - [ ] Wrong password, inactive account and no-connection cases.
  - [ ] Reset link opens the app on both platforms.

**Demo:** Sign in and out; reset a password through an emailed link; switch language.

**Must finish**
  - [ ] Sign-in works for all roles on Android and iPhone.
  - [ ] Session survives app restart and refreshes automatically.
  - [ ] Password reset works end to end.

**Drop first if behind**
  - [ ] School selection screen if the app serves one school.
  - [ ] Remember device option.

**Needs from client:** Working email delivery on staging; test accounts.

**Main risk:** Reset link not opening the app on one platform. Tested on the first day with real devices.

---

## Sprint 4 (Week 4): Security flows

**Goal:** Complete every security step the web already has: two-factor, agreement, forced password change and account state messages.

**Design needed**
  - [ ] Two-factor code, recovery and three-step setup screens.
  - [ ] Biometric unlock and permission prompts.
  - [ ] User agreement (accept, reject, blocked student, read view), forced password change, suspended, trial-expired and reactivate screens.

**Server (backend)**
  - [ ] Check whether two-factor verification expires with the sign-in token and fix it so users are not asked every hour.
  - [ ] Add attempt limits to two-factor code and recovery code entry.
  - [ ] Make sure the agreement and force-change rules are returned clearly in the "who am I" service.

**Shared code**
  - [ ] Shared two-factor and agreement state logic used by web and app.

**Mobile app**
  - [ ] Two-factor code entry, recovery code, and setup (scan or copy secret, confirm code, save recovery code).
  - [ ] Biometric unlock (fingerprint or face) with password fallback.
  - [ ] User agreement flow including the parent accepts-for-student block and reject-then-sign-out.
  - [ ] Forced password change, suspended and trial-expired screens, session-expired handling, account reactivation.

**Testing and quality**
  - [ ] Test every state with a dedicated test account: 2FA on, agreement pending, account suspended, trial expired, must change password.
  - [ ] Verify tokens persist across 24 hours without extra prompts.
  - [ ] Arabic layout check on all new screens.

**Demo:** A two-factor user signs in with biometrics; an agreement is accepted; a suspended school shows the right message.

**Must finish**
  - [ ] All sign-in and security states work on both platforms.
  - [ ] No repeated hourly two-factor prompts.
  - [ ] Nothing sensitive stored in plain text.

**Drop first if behind**
  - [ ] Reactivate account screen.
  - [ ] Biometric option for roles other than parents and teachers.

**Needs from client:** Test accounts for each security state.

**Main risk:** Two-factor session behaviour may differ from what the audit assumed. Tested on day one, with a server fix if needed.

---

## Sprint 5 (Week 5): App shell and push notifications  [milestone: M1 Sign-in and notifications done]

**Goal:** The app has its navigation, school branding and receives push notifications on real Android phones and iPhones.

**Design needed**
  - [ ] Tab bar for each role, school logo frames (circle, rounded, square, rectangle), child switcher.
  - [ ] Notification inbox and permission prompt.
  - [ ] Notification icon and empty and error illustrations.
  - [ ] Student home and timetable designs for week 6.

**Server (backend)**
  - [ ] Add phone push support (today only website push exists): store device tokens, register and unregister endpoints, send through Google and Apple, clean up invalid tokens.
  - [ ] Add campus targeting to the "send to a role" function.
  - [ ] Publish the files that let web links open the app directly.
  - [ ] Add the first push triggers: messages, absences, assignments due, grades posted.

**Shared code**
  - [ ] Shared notification type definitions and deep-link route mapping.

**Mobile app**
  - [ ] Role-based tab bar and navigation for every role, hiding modules the school has switched off.
  - [ ] School logo and branding on every header.
  - [ ] Child switcher shell for parents.
  - [ ] Notification permission flow, registering the phone, receiving, tapping to open the right screen, and the notification inbox.

**Testing and quality**
  - [ ] Test push delivery on one Android and one iPhone, app open, in background and closed.
  - [ ] Wrong or revoked token handling.
  - [ ] Menus verified for each role and for a school with modules off.

**Demo:** Send a test notification from the admin panel; it arrives and opens the right screen on both phones.

**Must finish**
  - [ ] Push works on real Android and iPhone.
  - [ ] Each role sees its own tabs.
  - [ ] Branding appears correctly.

**Drop first if behind**
  - [ ] Extra push triggers beyond messages and absences.
  - [ ] Campus targeting.

**Needs from client:** Apple push key and Firebase credentials from week 1.

**Main risk:** Apple push setup is often slow. Credentials were requested in week 1; a fallback through Expo push is available.

---

## Sprint 6 (Week 6): Student core screens

**Goal:** A student can see their whole school day and academic progress.

**Design needed**
  - [ ] Student screens: home, timetable, attendance, grades, report card, diary, events, profile with all states.
  - [ ] Charts: attendance ring, grade bars.
  - [ ] Student assignment, quiz and messaging designs for week 7.

**Server (backend)**
  - [ ] Rewrite the slow class-rank calculation so it responds in under half a second for a 40-student class.
  - [ ] Clamp list sizes and add paging on long lists.
  - [ ] Add extra role protection on every student route.
  - [ ] Add the report-card download in a form a phone can open.

**Shared code**
  - [ ] Student data modules and hooks reused from the website; shared date, academic-year and grade-band helpers.

**Mobile app**
  - [ ] Home: greeting, term, attendance, today's classes, assignments due, fees, weather.
  - [ ] Today's and week timetable with period states.
  - [ ] Attendance summary, calendar and by-subject detail.
  - [ ] Grades overview and by subject, GPA and rank, report card viewer, class diary, events and calendar, profile.

**Testing and quality**
  - [ ] Test with a student who has full data and one with none (empty states).
  - [ ] English and Arabic; light and dark; one small phone.
  - [ ] Speed check of the rank service.

**Demo:** A student walks through every core screen on staging data in both languages.

**Must finish**
  - [ ] All student core screens work with loading, empty and error states.
  - [ ] Rank service meets speed target.

**Drop first if behind**
  - [ ] GPA trend chart.
  - [ ] Weather widget.
  - [ ] Add-to-phone-calendar.

**Needs from client:** Realistic staging data for at least two students.

**Main risk:** Slow screens on low-end Android phones. Checked on a low-end device at the end of the week.

---

## Sprint 7 (Week 7): Student engagement and Alpha 1  [milestone: Alpha 1: internal test]

**Goal:** A student can submit work, take quizzes, message teachers, see fees and show a QR attendance card; put the first build in real students' hands.

**Design needed**
  - [ ] Assignments (list, detail, submit), quizzes, messages, complaints, fees, polls and notes, QR attendance card.
  - [ ] Parent home and child switcher designs for week 8.

**Server (backend)**
  - [ ] Build the self-service QR card service so students (and parents for their children) can fetch their own signed card; today only admins can.
  - [ ] Set longer time limits and size limits for uploads on weak mobile connections.
  - [ ] Add push triggers for new messages and posted grades if not done.

**Shared code**
  - [ ] Shared upload helper for photos and files; messaging, complaints and fee modules moved to the shared layer.

**Mobile app**
  - [ ] Assignments list, detail and submit with text, photo and file upload.
  - [ ] Quizzes with timer and result.
  - [ ] Messages: inbox, thread, compose with attachments and templates.
  - [ ] Complaints list, submit and thread; polls and notes; fees and payment history.
  - [ ] QR attendance card with brightness boost.

**Testing and quality**
  - [ ] Upload tests on slow and interrupted connections.
  - [ ] Quiz timer and leave-warning tests.
  - [ ] Alpha build to about five students at a pilot school through TestFlight and Google Play internal testing.

**Demo:** A student submits an assignment with a photo, sends a message and shows their QR card; Alpha 1 installed on real phones.

**Must finish**
  - [ ] All student mandatory screens done.
  - [ ] QR card service live.
  - [ ] Alpha installed by real students and feedback list started.

**Drop first if behind**
  - [ ] Polls and notes.
  - [ ] Message templates.
  - [ ] Quiz review screen.

**Needs from client:** Pilot school agreement and student volunteers.

**Main risk:** Uploads failing on weak networks. Tested with throttled connections before the Alpha.

---

## Sprint 8 (Week 8): Parent app

**Goal:** A parent sees accurate, private information for each of their children.

**Design needed**
  - [ ] Parent screens: attendance, grades, homework, timetable, exams, fees, receipts, discipline, activities, diary, messages, complaints.
  - [ ] Compliance screens for week 9: settings, account deletion, privacy.
  - [ ] Store screenshots plan.

**Server (backend)**
  - [ ] Audit every parent service so a parent can only ever see their own children's data; fix every gap found.
  - [ ] Fix the slow multi-step queries in parent grades and homework.
  - [ ] Add push for absences and fee reminders.

**Shared code**
  - [ ] Parent modules and the child-switching logic shared with the website; contract tests for parent services.

**Mobile app**
  - [ ] Parent home with the selected child card and quick tiles.
  - [ ] Child switcher (remembers last choice).
  - [ ] Child profile, attendance, grades and gradebook, homework (view only), timetable, exams.
  - [ ] Fees, payment history and receipt, discipline, activities, class diary.
  - [ ] Messages and complaints for parents.

**Testing and quality**
  - [ ] Privacy tests: another family's child ID must return nothing, on every parent service.
  - [ ] Test with a parent with one, two and zero children.
  - [ ] English and Arabic; light and dark.

**Demo:** A parent with two children switches between them and sees correct data; a blocked attempt on another family's child.

**Must finish**
  - [ ] Privacy tests pass on every parent service.
  - [ ] All parent mandatory screens work.

**Drop first if behind**
  - [ ] Activities screen.
  - [ ] Discipline screen.
  - [ ] Exam results detail.

**Needs from client:** Test families with several children and different fee states.

**Main risk:** Privacy gaps in parent data access. This is the most serious risk in the project and is tested before any parent build is shared.

---

## Sprint 9 (Week 9): Parent extras, compliance and first store submission  [milestone: Student + parent app submitted]

**Goal:** Finish the student and parent app, meet App Store and Google Play rules, and submit it.

**Design needed**
  - [ ] Settings, notification preferences, account-deletion request, privacy policy link.
  - [ ] Store screenshots in English and Arabic, store graphics.
  - [ ] Teacher home and attendance designs for week 10.

**Server (backend)**
  - [ ] Account-deletion request and anonymising process with an admin workflow.
  - [ ] Public privacy policy and terms pages for the platform.
  - [ ] Consistent error messages and codes on all services the app uses.

**Shared code**
  - [ ] Contract tests for final student and parent services.

**Mobile app**
  - [ ] Gate attendance history and excuse request for parents.
  - [ ] Child QR card and ID card, school information and pages, photo consent, notification settings per child.
  - [ ] Settings screen (language, theme, biometrics, notifications, privacy, version) and account-deletion request.
  - [ ] Crash reporting, accessibility pass and performance tuning.
  - [ ] Store listing, privacy and data-safety forms, review notes with test accounts.

**Testing and quality**
  - [ ] Full run through every student and parent screen on both platforms.
  - [ ] Screen reader and large-text checks.
  - [ ] Beta 1 with 2 to 3 pilot schools.

**Demo:** Beta 1 in use at pilot schools; store submissions made for both platforms.

**Must finish**
  - [ ] Account deletion and privacy policy in place.
  - [ ] Store materials complete.
  - [ ] Student and parent build submitted to both stores.

**Drop first if behind**
  - [ ] Photo consent.
  - [ ] School pages.
  - [ ] ID card (QR card is enough).

**Needs from client:** Privacy policy text and account-deletion policy from the client.; Pilot schools.

**Main risk:** Store rejection for missing deletion or privacy items. Both are done this week before submitting.

---

## Sprint 10 (Week 10): Teacher part 1 and store response

**Goal:** A teacher can see their day and take attendance; handle store review and roll out gradually.

**Design needed**
  - [ ] Teacher home, timetable, class list, student profile, take-attendance flow with all states.
  - [ ] Teacher diary and assignment designs for week 11.

**Server (backend)**
  - [ ] Teacher summary service for the home screen (classes, pending attendance, work to grade, unread messages).
  - [ ] Review role protection on every teacher route.
  - [ ] Handle any store review feedback that needs a server change.

**Shared code**
  - [ ] Teacher attendance, timetable and student modules shared.

**Mobile app**
  - [ ] Respond to store review comments and release gradually (10 percent, then more).
  - [ ] Teacher home, timetable (current and next class), class list, student list and profile.
  - [ ] Take attendance: class and date picker, tap to cycle present, absent, late, mark all, comments, counts, save, view-only outside the allowed window, bulk update.

**Testing and quality**
  - [ ] Attendance edge cases: edit window closed, offline, unsaved changes, large class.
  - [ ] Test with teachers on real devices; English and Arabic.
  - [ ] Monitor crash reports from the first live users.

**Demo:** A teacher takes attendance for a class and the saved data appears for the parent.

**Must finish**
  - [ ] Teacher home and take attendance work end to end.
  - [ ] Release 1 rollout underway with no critical issues.

**Drop first if behind**
  - [ ] Teacher timetable week view.
  - [ ] Student profile detail.

**Needs from client:** Teacher test accounts and timetables; store review responses.

**Main risk:** Store review questions pulling time away. Time is reserved in this week for responses.

---

## Sprint 11 (Week 11): Teacher part 2 and student and parent extras

**Goal:** A teacher can run the rest of the class day; add the extra learning features for students and parents.

**Design needed**
  - [ ] Class diary, create assignment, submissions list, grading sheet, discipline referral, online class, events, staff rotating code.
  - [ ] E-library and Quran progress screens.
  - [ ] Super admin designs (dashboard, school directory, billing) for week 12.

**Server (backend)**
  - [ ] Teacher messaging recipient rules check.
  - [ ] Any missing services for grading on a phone.
  - [ ] Push for events and announcements.

**Shared code**
  - [ ] Teacher assignment, diary, grading and discipline modules shared.

**Mobile app**
  - [ ] Class diary list and new entry.
  - [ ] Create and edit assignments with attachments and due dates; submissions list and grading sheet with score and feedback.
  - [ ] Teacher messaging, discipline referral, complaints, events.
  - [ ] Online class join (needs a special build), staff rotating QR code.
  - [ ] E-library and Quran progress for students and parents.

**Testing and quality**
  - [ ] Full class-day run: attendance, diary, assignment, grading, parent sees result.
  - [ ] Online class on two phones.
  - [ ] Large attachment upload tests.

**Demo:** Teacher creates an assignment, a student submits, the teacher grades, the student sees the grade.

**Must finish**
  - [ ] Teacher mandatory screens complete.
  - [ ] Staff rotating code works.

**Drop first if behind**
  - [ ] Quran progress.
  - [ ] E-library.
  - [ ] Discipline referral.

**Needs from client:** Online class test room.; Sample books for e-library.

**Main risk:** Video class needs a special build and device testing. The experiment from week 1 reduces this risk.

---

## Sprint 12 (Week 12): Super admin part 1  [added 2026-10-06]

**Goal:** A super admin can oversee all schools from the phone: dashboard, school directory, school status and billing. No school impersonation in the app (that stays on the web).

**Design needed**
  - [ ] Super admin dashboard, school directory (list, detail, status change), billing plans and billing status.
  - [ ] Credential view behind biometric re-auth.
  - [ ] Super admin settings, onboarding, feedback and quotes designs for week 13.

**Server (backend)**
  - [ ] Super admin summary service for the dashboard if the web computes totals in the browser.
  - [ ] Confirm every super-admin route checks `super_admin` server-side (not only in the web UI).
  - [ ] Paging and search on the school list and billing records.

**Shared code**
  - [ ] Super admin modules (schools, billing, feedback, quotes) moved to the shared communication layer.

**Mobile app**
  - [ ] Super admin tab bar and home dashboard.
  - [ ] School directory: search, filters, school detail, suspend/activate with confirmation.
  - [ ] Admin credentials view: biometric re-auth first, never cached, hidden from screenshots/app switcher.
  - [ ] Billing plans (list, create, edit, delete) and billing status (records, filters, mark as paid).

**Testing and quality**
  - [ ] Every action tested against the mock database with clearly named test records, cleaned up after.
  - [ ] Non-super-admin accounts get 403 on every super-admin call.
  - [ ] English and Arabic; light and dark.

**Demo:** Super admin finds a school, views its details, changes its status and marks a billing record as paid.

**Must finish**
  - [ ] Dashboard, school directory and status change work end to end.
  - [ ] Credentials are protected by biometric re-auth.

**Drop first if behind**
  - [ ] Billing plan create/edit (view first).
  - [ ] Dashboard charts.

**Needs from client:** Mock schools in several states (active, suspended, trial ending).

**Main risk:** Destructive actions (suspend, delete) on a phone. Every one needs a confirmation step and is tested only on test records.

---

## Sprint 13 (Week 13): Super admin part 2  [added 2026-10-06]

**Goal:** Finish the remaining super admin pages: onboarding, feedback, quotes and platform settings.

**Design needed**
  - [ ] Onboard school form, feedback and quotes inbox, platform settings, login page settings with preview, public pages editor (simplified), sidebar settings.
  - [ ] Scanner designs (all result states) for week 14.

**Server (backend)**
  - [ ] Any missing validation on onboarding and settings endpoints used from the phone.
  - [ ] Image upload limits for logo and login background uploads from the phone.

**Shared code**
  - [ ] Settings, login-page, public-pages and sidebar-config modules shared.

**Mobile app**
  - [ ] Onboard a new school (form with validation).
  - [ ] Feedback and quotes inbox with detail.
  - [ ] Platform settings (general, messaging, logo upload).
  - [ ] Login page settings with preview; public pages editor (text and images, simplified); sidebar settings (order and visibility).

**Testing and quality**
  - [ ] Onboarding tested with a test school that is removed afterwards.
  - [ ] Settings changes checked on the website after saving from the phone.

**Demo:** Super admin onboards a test school and changes the login page from the phone; the website shows the change.

**Must finish**
  - [ ] All 11 super admin pages present.
  - [ ] Super admin regression: every page in English and Arabic.

**Drop first if behind**
  - [ ] Public pages editor (link to the web editor instead).
  - [ ] Login page live preview.

**Needs from client:** Agreement on which settings may be changed from a phone.

**Main risk:** Builder-style settings pages are hard on a small screen. The public pages editor is simplified; complex layouts stay on the web.

---

## Sprint 14 (Week 14): QR scanner core and librarian

**Goal:** Bring the existing QR attendance scanner into the app, working offline, and add the librarian flows that use scanning.

**Design needed**
  - [ ] Scanner result states (accepted check-in, check-out, duplicate, rejected variants), permission screens, offline banner, enrolment.
  - [ ] Librarian issue, return and search screens.
  - [ ] Inspector and admin on-the-go designs for week 15.

**Server (backend)**
  - [ ] Compatibility tests proving signatures from a phone are accepted.
  - [ ] Limit device enrolment attempts and remove sensitive logging in the scanner service.
  - [ ] Check live attendance update load.

**Shared code**
  - [ ] Extract the scanner rules into a shared package: card checking, location boundary, duplicate protection and sync retry, with the existing tests moved over.

**Mobile app**
  - [ ] Secure signing and key storage on the phone.
  - [ ] Offline queue that keeps scans and photos if the app closes.
  - [ ] Device enrolment screen with one-time code.
  - [ ] Camera and location permission screens.
  - [ ] Librarian issue and return by scan, book search, loans and fines.

**Testing and quality**
  - [ ] Signature test against the live server.
  - [ ] Queue survives app kill and phone restart.
  - [ ] Librarian flows with real barcodes or QR codes.

**Demo:** A card scanned offline syncs and the server accepts it; a librarian issues and returns a book.

**Must finish**
  - [ ] Scanner logic shared and signature accepted by the server.
  - [ ] Offline queue reliable.
  - [ ] Device enrolment works.

**Drop first if behind**
  - [ ] Loans and fines list.
  - [ ] Photo capture queue.

**Needs from client:** Enrolment codes and a pilot school admin; sample library data.

**Main risk:** Phone security tools may not match the server's signature format. The week-1 experiment chose a fallback (small custom component).

---

## Sprint 15 (Week 15): Scanner experience, inspector, admin, social wall and full submission  [milestone: Full app submitted]

**Goal:** Finish every remaining role and screen, test the scanner for real conditions, and submit the full app.

**Design needed**
  - [ ] Inspector visit list and report, admin live attendance, approvals, complaints, alerts, key figures, school social wall.
  - [ ] Polish pass and refreshed store screenshots.

**Server (backend)**
  - [ ] Photo upload limits and load check for live attendance updates.
  - [ ] Inspector and admin summary services if missing.
  - [ ] Any server fixes from Beta 1 feedback.

**Shared code**
  - [ ] Inspector, admin and social modules shared.

**Mobile app**
  - [ ] Gate and class scan screens with result overlays, sound and vibration, screen-awake, fake-GPS and location boundary check, offline banner, sync status, background sync, staff code check.
  - [ ] Inspector visit list and report.
  - [ ] Admin live attendance, approvals, complaints, alerts and key figures.
  - [ ] School social wall (viewing first).
  - [ ] Beta 2 at a pilot school; submit full build to both stores.

**Testing and quality**
  - [ ] 48-hour offline test, airplane mode, clock difference, low-end Android.
  - [ ] Role regression: sign in as every role and check menus.
  - [ ] Store submission checklist.

**Demo:** Gate staff scan cards with the phone offline; admin sees them on live attendance; full app submitted.

**Must finish**
  - [ ] Scanner passes the offline tests.
  - [ ] All remaining roles have their mandatory screens.
  - [ ] Full build submitted.

**Drop first if behind**
  - [ ] Social wall.
  - [ ] Admin key figures dashboard.
  - [ ] Inspector report photos.

**Needs from client:** Pilot school with scanning devices; store account access.

**Main risk:** Too much remaining scope for one week. Drop list is applied from Wednesday if progress is behind.

---

## Sprint 16 (Week 16): Hardening, buffer and handover  [milestone: Handover]

**Goal:** Make the app secure, fast and supportable, finish anything that slipped, and hand over.

**Design needed**
  - [ ] Final accessibility and Arabic typography fixes.
  - [ ] Final store assets and any fixes from review feedback.

**Server (backend)**
  - [ ] Security review of the new services and of stored sensitive data (including reversible passwords and what the profile service can return).
  - [ ] Make fee and accounting attachments private.
  - [ ] Decide on Google and Microsoft sign-in for the app.
  - [ ] Faster sign-in checks if time allows.

**Shared code**
  - [ ] Reduce app size by splitting translation files; documentation for the shared packages.

**Mobile app**
  - [ ] Start-up under 2.5 seconds on a mid-range Android phone, image caching and list speed.
  - [ ] Fix Beta 1 and Beta 2 feedback.
  - [ ] Monitoring and crash dashboards, update policy, rollback plan.
  - [ ] Runbook and support documents; final demo and handover.

**Testing and quality**
  - [ ] Full end-to-end test on every role and both platforms.
  - [ ] Security checks on new services.
  - [ ] Re-test any fixed defects.

**Demo:** Final demo of the complete app and handover pack.

**Must finish**
  - [ ] No critical or high defects open.
  - [ ] Handover documents done.
  - [ ] Rollback plan documented.

**Drop first if behind**
  - [ ] Google and Microsoft sign-in.
  - [ ] Faster sign-in checks.

**Needs from client:** Client sign-off; budget for an external security review if wanted.

**Main risk:** Slipped work from earlier weeks. This week is the planned buffer, so it is used first for unfinished must-have items.

---

