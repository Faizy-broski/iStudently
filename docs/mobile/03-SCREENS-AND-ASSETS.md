# Mandatory screens and assets

Full screen list with all priorities: `reference/Studently_Mobile_Design_Brief.docx`. Short designer version: `reference/Studently_Designer_Brief_Mandatory.docx`. Figma link: _(add here)_.

Every screen needs: English (LTR) and Arabic (RTL), light and dark, loading, empty, error and offline versions, 360x800 check.

## Mandatory screens by role

### Common and sign-in (all roles) (22)
- [ ] **Splash screen**: Logo and brand colour while the app starts  _(release R1)_
- [ ] **Language selection**: English or Arabic, can be changed later in settings  _(release R1)_
- [ ] **Sign in**: Username or email, password with show/hide, remember me, Google and Microsoft buttons (only when enabled), school logo and per-school background  _(release R1)_
- [ ] **Biometric unlock**: Fingerprint or face to reopen the app, fallback to password  _(release R1)_
- [ ] **Two-factor code**: Six-digit code field, link to recovery code  _(release R1)_
- [ ] **Two-factor recovery**: Recovery code entry (four groups of four), warning text  _(release R1)_
- [ ] **Two-factor setup**: Three steps: scan or copy secret, confirm code, save recovery code with confirmation checkbox. Skip when allowed  _(release R1)_
- [ ] **Forgot password**: Enter email, confirmation message  _(release R1)_
- [ ] **Reset password**: New password and confirm, strength meter (too short to strong), rules shown  _(release R1)_
- [ ] **Forced password change**: Same fields as reset, shown on first login  _(release R1)_
- [ ] **User agreement**: Full agreement text, Accept and Reject buttons. Variant for parents listing the children covered  _(release R1)_
- [ ] **Blocked until parent accepts**: Message for a student whose parent has not accepted, sign-out button  _(release R1)_
- [ ] **Account suspended / trial expired**: Clear message and who to contact  _(release R1)_
- [ ] **Session expired**: Prompt to sign in again  _(release R1)_
- [ ] **Update required**: Forced update message with store button  _(release R1)_
- [ ] **Maintenance**: Service temporarily unavailable  _(release R1)_
- [ ] **No connection**: Full screen and a small banner version  _(release R1)_
- [ ] **Notification permission prompt**: Why notifications help, Enable and Not now  _(release R1)_
- [ ] **Notification inbox**: List of recent notifications with unread dots, tap opens the item  _(release R1)_
- [ ] **Profile**: Photo, name, role, school, contact details, linked children (parents)  _(release R1)_
- [ ] **Settings**: Language, light/dark theme, notification choices, biometric toggle, privacy policy, terms, about and version, sign out  _(release R1)_
- [ ] **Request account deletion**: Explanation of what happens, confirmation, request sent  _(release R1)_

### Student (24)
- [ ] **Home**: Greeting, current term, attendance percentage and progress bar, today's classes, assignments due soon (due today, tomorrow, later), fees summary, weather  _(release R1)_
- [ ] **Today's timetable**: Periods with time, subject, room and state (completed, in progress, starting soon, upcoming); free-time message  _(release R1)_
- [ ] **Week timetable**: Grid or day-by-day list for the week  _(release R1)_
- [ ] **Attendance summary**: Percentage ring, present, absent, late, excused counts, month calendar view  _(release R1)_
- [ ] **Attendance by subject**: List of subjects with percentage and detail of each date  _(release R1)_
- [ ] **Grades overview**: Subjects with averages coloured by band, letter grade, overall percentage  _(release R1)_
- [ ] **Grades by subject**: Assessments with score, weight and feedback  _(release R1)_
- [ ] **Report card**: Term report card viewer with share/download  _(release R1)_
- [ ] **Assignments list**: Tabs for to do, submitted, graded; due-date chips  _(release R1)_
- [ ] **Assignment detail**: Instructions, attachments, due date, points, teacher feedback and grade  _(release R1)_
- [ ] **Submit assignment**: Text answer, add photo, add file (10 MB limit), upload progress, confirmation  _(release R1)_
- [ ] **Quizzes list**: Available, completed and upcoming quizzes  _(release R1)_
- [ ] **Take quiz**: One question per screen, timer, progress, submit and result  _(release R1)_
- [ ] **Class diary**: Daily notes from teachers by subject, comment where allowed  _(release R1)_
- [ ] **Events and calendar**: Month view and event details, add to phone calendar  _(release R1)_
- [ ] **Fees**: Balance, status (pending, partial, paid, overdue, waived), due-date badge  _(release R1)_
- [ ] **Payment history**: List of payments with receipt view  _(release R1)_
- [ ] **Messages inbox**: Tabs for unread, read, archived, sent; search; unread badge  _(release R1)_
- [ ] **Message thread**: Conversation with attachments, reply, archive, delete  _(release R1)_
- [ ] **Compose message**: Recipient picker with search, subject, body, up to 10 attachments, templates  _(release R1)_
- [ ] **Complaints list**: Mine, with status chips and overdue flag  _(release R1)_
- [ ] **Submit complaint**: Title, description, category, priority, teacher search, attachments, anonymous and confidential options  _(release R1)_
- [ ] **Complaint thread**: Status, replies, attachments  _(release R1)_
- [ ] **QR attendance card**: Signed QR code, name, photo, school, brightness boost, add to wallet (optional)  _(release R1)_

### Parent (17)
- [ ] **Home**: Selected child card (photo, name, grade, section), quick tiles for academics, attendance, homework, fees, fees summary, weather, tip when several children  _(release R1)_
- [ ] **Child switcher**: Bottom sheet to choose a child, remembers the last choice  _(release R1)_
- [ ] **Child profile**: Student details and class information  _(release R1)_
- [ ] **Attendance**: Calendar and list by month, statuses with colours, lateness minutes  _(release R1)_
- [ ] **Excuse request**: Reason text and submit, request status  _(release R1)_
- [ ] **Grades and gradebook**: Subjects, assessments, averages and colour bands  _(release R1)_
- [ ] **Report card**: Viewer with share or download  _(release R1)_
- [ ] **Homework list and detail**: View only: due dates, instructions, status  _(release R1)_
- [ ] **Timetable**: Child's day and week timetable  _(release R1)_
- [ ] **Exams**: Upcoming exams and results  _(release R1)_
- [ ] **Fees status**: Balance, due-date badge, fee items  _(release R1)_
- [ ] **Payment history and receipt**: List of payments with receipt  _(release R1)_
- [ ] **Class diary**: Notes from teachers  _(release R1)_
- [ ] **Messages (inbox, thread, compose)**: Same patterns as the student screens  _(release R1)_
- [ ] **Complaints (list, submit, thread)**: Same patterns as the student screens  _(release R1)_
- [ ] **Child QR attendance card**: Signed QR code for the selected child  _(release R1)_
- [ ] **Gate attendance history**: Monthly list with status icons (present, late, absent, excused, not closed) and accumulated lateness  _(release R1)_

### Teacher (14)
- [ ] **Home**: Today's classes, pending attendance, assignments to grade, unread messages  _(release R2)_
- [ ] **Timetable**: Day and week view, current and next class  _(release R2)_
- [ ] **Select class for attendance**: Date picker (today by default) and class list with period, subject and section  _(release R2)_
- [ ] **Take attendance**: Student list with tap to cycle present, absent, late; mark all present or absent; comment per student; counts and rate; save button; view-only state outside the allowed window; confidential family badge  _(release R2)_
- [ ] **Student list and profile**: Class list with search, student details  _(release R2)_
- [ ] **Class diary list and new entry**: Past entries with published and comments-on chips; new entry form with date, content and comments toggle  _(release R2)_
- [ ] **Assignments list**: Tabs for active, upcoming, past, all; search  _(release R2)_
- [ ] **Create or edit assignment**: Grade, section, subject, title, description, instructions, attachments, due date and time, points, graded and late-allowed toggles, publish or draft  _(release R2)_
- [ ] **Assignment detail**: Status chips, edit, delete confirm, attachments  _(release R2)_
- [ ] **Submissions list**: Assignment picker, counts (total, pending, submitted, graded), filters and search  _(release R2)_
- [ ] **Grading sheet**: Student answer, attachments, score, feedback, submit grade  _(release R2)_
- [ ] **Messages**: Inbox, thread and compose (teachers can message students and staff)  _(release R2)_
- [ ] **Staff rotating QR code**: Large changing code with countdown ring  _(release R2)_
- [ ] **Classroom QR scan**: Scan student cards at the start of class  _(release R2)_

### QR scanner (gate staff and teachers) (9)
- [ ] **Device enrolment**: Enter one-time code from the school admin, device name, success  _(release R2)_
- [ ] **Gate scan**: Camera view with frame, mode and school info, last scan, counts  _(release R2)_
- [ ] **Scan result: accepted**: Name, photo, check-in or check-out, time, large colour and sound  _(release R2)_
- [ ] **Scan result: duplicate**: Already scanned within two minutes  _(release R2)_
- [ ] **Scan result: rejected**: Card revoked or lost, unknown card, outside school boundary, expired code  _(release R2)_
- [ ] **Class scan**: Teacher scanning during a period, list of scanned students  _(release R2)_
- [ ] **Offline banner and queue**: Number of waiting scans, oldest waiting age, warning after 48 hours  _(release R2)_
- [ ] **Sync status**: Last sync, retry, errors  _(release R2)_
- [ ] **Permission screens**: Camera and location explanations with settings shortcut  _(release R2)_

### Super admin (11) (added 2026-10-06)
No school impersonation in the app ("switch into school" stays on the web).
- [ ] **Dashboard**: Platform totals (schools, active/suspended, trials ending, students, staff), recent schools, quick links  _(release R3)_
- [ ] **School directory**: Search and filter schools, status chips (active, suspended, trial), school detail, suspend/activate with confirmation, admin credentials view **behind biometric re-auth**, never cached  _(release R3)_
- [ ] **Onboard school**: Create a school with name, slug, contact email, parent school, admin account  _(release R3)_
- [ ] **Billing plans**: List, create, edit, delete plans  _(release R3)_
- [ ] **Billing status**: Per-school billing records, filters, mark as paid, create/edit/delete records  _(release R3)_
- [ ] **Feedback**: Feedback inbox from schools with detail  _(release R3)_
- [ ] **Quotes**: Quote requests list and detail, status  _(release R3)_
- [ ] **Platform settings**: General platform settings and messaging settings, logo upload  _(release R3)_
- [ ] **Login page settings**: Login page configuration with preview  _(release R3)_
- [ ] **Public pages settings**: Public page content editing (simplified mobile editor)  _(release R3)_
- [ ] **Sidebar settings**: Web sidebar configuration (ordering and visibility)  _(release R3)_

### Librarian, minimum set (3)
- [ ] Issue book (scan)
- [ ] Return book (scan)
- [ ] Book search

### Inspector, minimum set (2)
- [ ] Visit list
- [ ] Visit report

### Admin on the go, minimum set (3)
- [ ] Live attendance
- [ ] Approvals queue
- [ ] Alerts feed

_Total mandatory: 105_

## Optional (Should/Later) screens

**Common and sign-in (all roles):** School selection (S); Reactivate account (S); Switch school or role (S)

**Student:** GPA and class rank (S); Polls and notes (S); ID card (S); E-library (S); Quran memorisation progress (S); School social wall (L)

**Parent:** Discipline (S); Activities (S); Child ID card (S); School information and pages (S); Photo consent and school messages (S); Quran memorisation (S); Notification settings per child (S)

**Teacher:** Discipline referral (S); Complaints (S); Online class (S); Events (S)

**QR scanner (gate staff and teachers):** Device info and de-enrol (S); Staff code check (S)

**Librarian, inspector and admin on-the-go screens:** Librarian: issue book (S); Librarian: return book (S); Librarian: book search (S); Librarian: loans and fines (L); Inspector: visit list (L); Inspector: visit report (L); Admin: live attendance (S); Admin: approvals (S); Admin: complaints (S); Admin: alerts (S); Admin: key figures dashboard (L)

## Mandatory assets
- [ ] App icon: iPhone 1024 no alpha; Android adaptive (foreground, background, monochrome) + 512 Play icon
- [ ] Splash (light, dark)
- [ ] Logo set (full, symbol, one-colour, dark; SVG)
- [ ] School logo frame: circle, rounded, square, rectangle + placeholder
- [ ] Default avatars (student, parent, teacher/staff)
- [ ] Tokens: colour, type (Inter, Cairo), spacing, radius; status colours; grade bands
- [ ] Icon set (tab bar per role, common)
- [ ] Component kit (buttons, fields, OTP, cards, list rows, chips, tab bar, sheet, dialog, toast, skeleton, banner)
- [ ] Illustrations: empty, error, no connection, maintenance, update required, suspended, session expired
- [ ] Permission artwork: notifications, biometric, camera, location
- [ ] Student QR attendance card layout
- [ ] Charts: attendance ring, grade bars
- [ ] Android notification icon + accent colour
- [ ] Scanner result colours + sound/vibration spec
- [ ] Store screenshots (en, ar) + Play feature graphic 1024x500
- [ ] Fonts to embed

## Design order (one week ahead of build)
1 tokens; 2 components; 3 sign-in; 4 security; 5 shell + notifications; 6 student core; 7 student engagement + QR card; 8 parent; 9 settings, deletion, store assets; 10-11 teacher; 12-13 super admin; 14 scanner + librarian; 15 inspector + admin; 16 polish.

## Open design decisions
Scanner brand (dark green #0F3D2E vs main navy/blue), per-school colours (not supported by backend today), tablet support, social wall (not mandatory).
