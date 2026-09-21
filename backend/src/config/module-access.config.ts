/**
 * Which admin-app modules (frontend/src/app/admin/<folder>) each API mount prefix belongs to.
 *
 * A staff account runs inside the admin app and is limited to the modules its User Profile
 * (role) grants — permissions are stored as sidebar hrefs such as `/admin/fees/payments`.
 * Most admin API routers are restricted to admins, so without this mapping a staff user could
 * open a module they were granted but every request behind it would be refused. The mapping
 * lets `requireRole` (see role.middleware.ts) let a staff user through to exactly the API
 * areas their role grants, and nothing else.
 *
 * Rules:
 *  - Key = first path segment of the router's mount (`/api/fees/...` -> `fees`).
 *  - Value = admin app folders that segment serves. The user needs a granted module under any
 *    of them: `can_use` for reads (GET/HEAD/OPTIONS), `can_edit` for writes.
 *  - A prefix that is not listed here is NOT reachable by staff (deny by default), so a newly
 *    added router stays admin-only until it is added on purpose.
 */

export const ANY_GRANT = '*' // any granted module is enough (shared helper endpoints)

export const API_AREA_MODULES: Record<string, string[]> = {
  // People
  students: ['students'],
  parents: ['parents'],
  teachers: ['teachers'],
  staff: ['staff'],
  'staff-designations': ['staff'],
  'staff-absences': ['staff-absences'],
  'human-resources': ['staff-absences', 'salary'],
  'advanced-report': ['students', 'teachers', 'staff', 'parents', 'reports'],
  'custom-fields': ['students', 'teachers', 'staff', 'parents', 'settings'],
  'default-field-orders': ['students', 'teachers', 'staff', 'parents', 'settings'],
  'custom-field-category-orders': ['students', 'teachers', 'staff', 'parents', 'settings'],
  'letter-templates': ['students'],
  'id-card-templates': ['id-card-templates', 'id-card'],
  'certificate-templates': ['certificate-templates', 'students'],

  // Academics
  academics: ['academics'],
  periods: ['periods'],
  rooms: ['rooms'],
  timetable: ['timetable'],
  scheduling: ['scheduling'],
  'schedule-requests': ['scheduling'],
  'marking-periods': ['marking-periods', 'settings'],
  'marking-period-groups': ['marking-periods', 'settings'],
  'grading-scales': ['grades'],
  courses: ['grades', 'teachers'],
  'course-periods': ['grades', 'teachers'],
  gradebook: ['grades'],
  'final-grades': ['grades'],
  'report-cards': ['grades'],
  'grades-reports': ['grades'],
  'graduation-paths': ['grades'],
  attendance: ['attendance'],
  'attendance-calendars': ['attendance', 'settings'],
  assignments: ['teachers'],
  exams: ['teachers'],
  'lesson-plans': ['teachers'],
  'class-diary': ['teachers'],
  events: ['events'],
  quiz: ['quiz'],
  'speed-reading': ['speed-reading'],
  discipline: ['discipline'],
  activities: ['activities'],

  // Money
  fees: ['fees'],
  'school-services': ['fees'],
  'billing-elements': ['billing-elements'],
  salary: ['salary'],
  accounting: ['accounting'],

  // Facilities / library / other modules
  library: ['library'],
  textbooks: ['textbooks'],
  'textbook-deliveries': ['textbooks'],
  hostel: ['hostel'],
  'entry-exit': ['entry-exit'],
  training: ['training'],
  'training-prescriptions': ['teacher-programs', 'inspections'],
  grievances: ['grievances'],
  messaging: ['messaging'],
  mail: ['email'],
  portal: ['portal'],
  performance: ['performance'],
  qirtasi: ['qirtasi'],
  'online-classes': ['online-classes', 'jitsi-meet'],
  jitsi: ['online-classes', 'jitsi-meet'],
  'resource-dashboards': ['resources'],
  'resource-links': ['resources'],
  'resource-link-categories': ['resources'],
  'embedded-resources': ['resources'],
  'embedded-resource-categories': ['resources'],
  'learning-resources': ['resources'],
  vlaby: ['resources'],
  'physics-labs': ['physics-labs', 'resources'],
  fina: ['fina'],
  vault: ['vault'],
  hifzi: ['hifzi'],
  quran: ['hifzi'],
  qaida: ['hifzi'],
  'hadith-forty': ['hifzi'],
  miqat: ['miqat'],
  inspectors: ['inspections'],
  'inspection-visits': ['inspections'],
  'inspector-teachers': ['inspections'],
  'inspection-rubrics': ['inspections'],
  'inspection-evaluations': ['inspections'],
  'inspection-media': ['inspections'],
  'inspection-coaching': ['inspections'],
  'inspection-reports': ['inspections'],
  'inspection-signatures': ['inspections'],
  'inspection-appeals': ['inspections'],
  'inspector-broadcasts': ['inspections'],
  'inspection-forum': ['inspections'],
  'inspection-analytics': ['inspections'],

  // Dashboard analytics (the school dashboard page)
  'school-dashboard': ['dashboard'],
  dashboard: ['dashboard'],

  // Read-mostly school info (writes are further blocked in STAFF_READ_ONLY_AREAS)
  schools: ['school-details'],
  setup: ['school-details', 'setup'],

  // Root-level routers and pages added by the API-dependency audit
  'comment-codes': ['grades'],
  'history-marking-periods': ['grades'],
  'historical-grades': ['grades'],
  'calculations': ['reports'],
  'calculation-reports': ['reports'],
  'ical': ['events'],
  'rollover': ['rollover'],
  'enrollment': ['rollover'],
  'human-atlas': ['resources'],
  'tuxmath': ['resources'],
  'zperiod': ['resources'],
  'school-inventory': ['resources'],
  'user-agreements': ['settings'],
  'parent-agreement': ['settings'],
  'push': ['*'],

  // Shared helpers any granted user may need
  'export-templates': [ANY_GRANT],
  media: [ANY_GRANT],
}

/**
 * Mount prefixes a staff account can never use, whatever its role grants: they manage
 * accounts, roles, credentials or whole-school data, so opening them would let a limited
 * staff user escalate to (or impersonate) an administrator.
 */
export const STAFF_BLOCKED_AREAS = new Set<string>([
  'user-profiles',
  'sidebar-config',
  'credentials',
  'two-fa',
  'school-data-import',
  'pending-signups',
  'signup-links',
  'public-signup',
  'school-settings',
  'setup-assistant',
  'auth',
])

/**
 * Areas staff may read but never write even with "can edit". Empty on purpose: a granted
 * "edit" must really allow editing. The one real risk (creating or taking over administrator
 * accounts through the Staff module) is blocked where accounts change — see staff.controller.ts
 * and staff.routes.ts — instead of switching the whole module to read-only.
 */
export const STAFF_READ_ONLY_AREAS = new Set<string>([])

/**
 * Read-only extras: admin modules whose PAGES load data from an API area they don't own
 * (a Fees page lists grade levels from /academics, students from /students, ...). A role that
 * grants such a module may READ (GET) these areas, but writing still needs "can edit" on the
 * owning module in API_AREA_MODULES. Derived by scanning which endpoints each admin module's
 * pages (and the API helpers/hooks they import) call.
 */
export const API_AREA_READ_MODULES: Record<string, string[]> = {
  'academics': ['attendance', 'billing-elements', 'discipline', 'entry-exit', 'events', 'fees', 'grades', 'hifzi', 'library', 'pending-approvals', 'physics-labs', 'quiz', 'reports', 'resources', 'rollover', 'settings', 'setup', 'speed-reading', 'students', 'teachers', 'textbooks', 'timetable'],
  'accounting': ['salary', 'staff'],
  'attendance-calendars': ['events'],
  'class-diary': ['attendance'],
  'comment-codes': ['hifzi', 'students', 'teacher-programs'],
  'course-periods': ['activities', 'hifzi', 'students', 'teacher-programs'],
  'courses': ['hifzi', 'students', 'teacher-programs'],
  'custom-field-category-orders': ['school-details'],
  'custom-fields': ['hostel', 'school-details'],
  'entry-exit': ['attendance'],
  'final-grades': ['hifzi', 'students', 'teacher-programs'],
  'gradebook': ['hifzi', 'students', 'teacher-programs'],
  'grades-reports': ['hifzi', 'students', 'teacher-programs'],
  'grading-scales': ['hifzi', 'students', 'teacher-programs'],
  'graduation-paths': ['hifzi', 'students', 'teacher-programs'],
  'grievances': ['teachers'],
  'historical-grades': ['hifzi', 'students', 'teacher-programs'],
  'history-marking-periods': ['hifzi', 'students', 'teacher-programs'],
  'marking-period-groups': ['academics'],
  'marking-periods': ['grades', 'hifzi', 'rollover', 'setup', 'students', 'teacher-programs'],
  'messaging': ['settings'],
  'parents': ['id-card', 'students'],
  'performance': ['staff', 'teachers'],
  'periods': ['attendance', 'entry-exit', 'grades', 'hifzi', 'id-card', 'miqat', 'resources', 'students', 'teacher-programs', 'teachers', 'timetable'],
  'report-cards': ['hifzi', 'students', 'teacher-programs'],
  'salary': ['accounting', 'staff'],
  'school-services': ['settings'],
  'schools': ['activities', 'library', 'miqat', 'parents', 'periods', 'settings', 'speed-reading', 'staff', 'students', 'teachers'],
  'setup': ['settings'],
  'staff': ['accounting', 'discipline', 'id-card', 'performance', 'students'],
  'students': ['activities', 'attendance', 'discipline', 'entry-exit', 'fees', 'grades', 'hifzi', 'hostel', 'id-card', 'miqat', 'parents', 'resources', 'teacher-programs'],
  'teachers': ['attendance', 'entry-exit', 'id-card', 'miqat', 'resources', 'students', 'teacher-programs', 'timetable'],
  'timetable': ['attendance', 'entry-exit', 'teacher-programs'],
}
