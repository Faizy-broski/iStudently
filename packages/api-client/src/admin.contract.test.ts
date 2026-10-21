import { portalApi } from './modules/portal'
import { appConfigApi } from './modules/app-config'
import { authApi } from './modules/auth'
import { mediaApi } from './modules/media'
import { teacherApi } from './modules/teacher'
import { assignmentsApi } from './modules/assignments'
import { examsApi } from './modules/exams'
import { teacherInspectionsApi } from './modules/teacher-inspections'
import { readingLogsApi } from './modules/reading-logs'
import { inspectorApi } from './modules/inspector'
import { librarianApi } from './modules/librarian'
import { learningResourcesApi } from './modules/learning-resources'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from './client'
import { campusesApi } from './modules/admin/campuses'
import { adminSchoolDataImportApi } from './modules/admin/school-data-import'
import { exportTemplatesApi } from './modules/admin/export-templates'
import { adminParentAgreementApi } from './modules/admin/parent-agreement'
import { schoolDashboardApi } from './modules/admin/dashboard'
import { adminSchoolApi } from './modules/admin/school'
import { adminStudentsApi } from './modules/admin/students'
import { adminAcademicsApi } from './modules/admin/academics'
import { adminParentsApi } from './modules/admin/parents'
import { adminCustomFieldsApi } from './modules/admin/custom-fields'
import { adminEmployeesApi } from './modules/admin/employees'
import { adminFieldOrdersApi } from './modules/admin/field-orders'
import { adminSignupsApi } from './modules/admin/signups'
import { adminGroupAssignApi } from './modules/admin/group-assign'
import { adminMailApi } from './modules/admin/mail'
import { adminAnalyticsApi } from './modules/admin/analytics'
import { adminDesignationsApi } from './modules/admin/designations'
import { adminFeesApi } from './modules/admin/fees'
import { adminBillingElementsApi } from './modules/admin/billing-elements'
import { adminAccountingApi } from './modules/admin/accounting'
import { adminSalaryApi } from './modules/admin/salary'
import { adminGradesApi } from './modules/admin/grades'
import { adminSchedulingApi } from './modules/admin/scheduling'
import { adminQuizApi } from './modules/admin/quiz'
import { adminOnlineClassesApi } from './modules/admin/online-classes'
import { adminActivitiesApi } from './modules/admin/activities'
import { adminHistoricalGradesApi } from './modules/admin/historical-grades'
import { jahbadhGradesApi } from './modules/jahbadh-grades'
import { jahbadhControlApi } from './modules/jahbadh-control'
import { adminHumanResourcesApi } from './modules/admin/human-resources'
import { adminLetterTemplatesApi } from './modules/admin/letter-templates'
import { adminAttendanceApi } from './modules/admin/attendance'
import { adminTimetableApi } from './modules/admin/timetable'
import { adminPeriodsApi } from './modules/admin/periods'
import { adminCalendarsApi } from './modules/admin/calendars'
import { adminGeneratorApi } from './modules/admin/generator'
import { adminPortalApi } from './modules/admin/portal'
import { adminRolloverApi } from './modules/admin/rollover'
import { adminCalculationsApi } from './modules/admin/calculations'
import { adminTrainingApi } from './modules/admin/training'
import { adminWeatherApi } from './modules/admin/weather'
import { adminServicesApi } from './modules/admin/services'
import { adminUserProfilesApi } from './modules/admin/user-profiles'
import { adminPushApi } from './modules/admin/push'
import { adminPublicPagesApi } from './modules/admin/public-pages'
import { adminHostelApi } from './modules/admin/hostel'
import { adminLibraryApi } from './modules/admin/library'
import { adminTextbooksApi } from './modules/admin/textbooks'
import { adminQirtasiApi } from './modules/admin/qirtasi'
import { adminResourcesApi } from './modules/admin/resources'
import { adminVaultApi } from './modules/admin/vault'
import { adminHifziApi } from './modules/admin/hifzi'
import { adminCoursesApi } from './modules/admin/courses'
import { adminTeacherProgramsApi } from './modules/admin/teacher-programs'
import { adminSpeedReadingApi } from './modules/admin/speed-reading'
import { quranApi } from './modules/quran'
import { finaApi } from './modules/fina'
import { hadithFortyApi } from './modules/hadith-forty'
import { jitsiApi } from './modules/jitsi'
import { eventsApi } from './modules/events'
import { grievancesApi } from './modules/grievances'
import { adminStaffAbsencesApi } from './modules/admin/staff-absences'
import { adminDisciplineApi } from './modules/admin/discipline'
import { adminEntryExitApi } from './modules/admin/entry-exit'
import { adminMiqatApi } from './modules/admin/miqat'
import { adminInspectionsApi } from './modules/admin/inspections'
import { adminPerformanceApi } from './modules/admin/performance'

// School admin modules: every call must match a backend route in the router mounted at its first
// path segment, and none may send X-School-Id (the campus goes as campus_id). Add each new admin
// module to MODULES and its router file to ROUTERS.

const BACKEND_ROUTES = join(__dirname, '../../../backend/src/routes')

/** Mount path (first URL segment) -> backend router file. */
const ROUTERS: Record<string, string> = {
  'learning-resources': 'learning-resources.routes.ts',
  setup: 'setup-status.routes.ts',
  'school-dashboard': 'school-dashboard.routes.ts',
  'school-settings': 'school-settings.routes.ts',
  auth: 'auth.routes.ts',
  media: 'media-upload.routes.ts',
  'setup-assistant': 'setup-assistant.routes.ts',
  'user-profiles': 'user-profiles.routes.ts',
  push: 'push-notifications.routes.ts',
  hostel: 'hostel.routes.ts',
  library: 'library.routes.ts',
  textbooks: 'textbooks.routes.ts',
  'textbook-deliveries': 'textbook-deliveries.routes.ts',
  'qirtasi/worksheets': 'qirtasi/worksheets.routes.ts',
  'qirtasi/curriculum': 'qirtasi/curriculum.routes.ts',
  'qirtasi/facets': 'qirtasi/facets.routes.ts',
  'resource-links': 'resource-links.routes.ts',
  'resource-link-categories': 'resource-link-categories.routes.ts',
  'resource-dashboards': 'dashboards.routes.ts',
  'school-inventory': 'school-inventory.routes.ts',
  'physics-labs': 'physics-labs.routes.ts',
  'embedded-resources': 'embedded-resources.routes.ts',
  'embedded-resource-categories': 'embedded-resource-categories.routes.ts',
  'vault/records': 'vault/records.routes.ts',
  'vault/field-definitions': 'vault/field-definitions.routes.ts',
  'vault/media': 'vault/media.routes.ts',
  'vault/categories': 'vault/categories.routes.ts',
  'hifzi/settings': 'hifzi/settings.routes.ts',
  'hifzi/circles': 'hifzi/circles.routes.ts',
  'hifzi/students': 'hifzi/students.routes.ts',
  'hifzi/plans': 'hifzi/plans.routes.ts',
  'hifzi/attendance': 'hifzi/attendance.routes.ts',
  'hifzi/sessions': 'hifzi/sessions.routes.ts',
  'hifzi/curriculum': 'hifzi/curriculum.routes.ts',
  'hifzi/gradebook': 'hifzi/gradebook-bridge.routes.ts',
  'hifzi/compliance': 'hifzi/compliance.routes.ts',
  quran: 'quran/reference.routes.ts',
  'speed-reading': 'speed-reading.routes.ts',
  'hadith-forty': 'hadith-forty/progress.routes.ts',
  'jitsi/rooms': 'jitsi-room.routes.ts',
  'jitsi/polls': 'jitsi-room-poll.routes.ts',
  'hadith-forty/quiz': 'hadith-forty/quiz.routes.ts',
  'hadith-forty/class': 'hadith-forty/class.routes.ts',
  'hadith-forty/content': 'hadith-forty/content.routes.ts',
  'fina/posts': 'fina/post.routes.ts',
  'fina/media': 'fina/media.routes.ts',
  'fina/albums': 'fina/album.routes.ts',
  'fina/stories': 'fina/story.routes.ts',
  'fina/groups': 'fina/group.routes.ts',
  'fina/events': 'fina/event.routes.ts',
  'fina/threads': 'fina/thread.routes.ts',
  'fina/consents': 'fina/consent.routes.ts',
  'fina/notifications': 'fina/notification.routes.ts',
  'fina/audit': 'fina/audit.routes.ts',
  'fina/reports': 'fina/report.routes.ts',
  public: 'public-pages.routes.ts',
  students: 'student.routes.ts',
  academics: 'academics.routes.ts',
  'course-periods': 'course-periods-flat.routes.ts',
  parents: 'parent.routes.ts',
  'custom-fields': 'custom-fields.routes.ts',
  teachers: 'teacher.routes.ts',
  assignments: 'assignments.routes.ts',
  exams: 'exams.routes.ts',
  staff: 'staff.routes.ts',
  'default-field-orders': 'default-field-order.routes.ts',
  'signup-links': 'signup-links.routes.ts',
  'school-data-import': 'school-data-import.routes.ts',
  'export-templates': 'export-templates.routes.ts',
  'parent-agreement': 'parent-agreement.routes.ts',
  'pending-signups': 'pending-signups.routes.ts',
  mail: 'mail.routes.ts',
  'staff-designations': 'staff-designation.routes.ts',
  fees: 'fees.routes.ts',
  'billing-elements': 'billing-elements.routes.ts',
  accounting: 'accounting.routes.ts',
  salary: 'salary.routes.ts',
  'marking-periods': 'marking-periods.routes.ts',
  'marking-period-groups': 'marking-period-groups.routes.ts',
  periods: 'periods.routes.ts',
  'attendance-calendars': 'attendance-calendars.routes.ts',
  courses: 'courses.routes.ts',
  rooms: 'rooms.routes.ts',
  portal: 'portal.routes.ts',
  rollover: 'rollover.routes.ts',
  schools: 'school.routes.ts',
  'sidebar-config': 'sidebar-config.routes.ts',
  calculations: 'calculations.routes.ts',
  training: 'training.routes.ts',
  'school-services': 'school-services.routes.ts',
  'weather/config': 'weather/config.routes.ts',
  'weather/alerts': 'weather/alerts.routes.ts',
  'certificate-templates': 'certificate-template.routes.ts',
  'calculation-reports': 'calculations.routes.ts',
  'custom-field-category-orders': 'custom-field-category-order.routes.ts',
  events: 'event.routes.ts',
  ical: 'ical.routes.ts',
  'final-grades': 'final-grades.routes.ts',
  'grades-reports': 'grades-reports.routes.ts',
  'grading-scales': 'grading-scales.routes.ts',
  'report-cards': 'report-cards.routes.ts',
  credentials: 'credentials.routes.ts',
  'human-resources': 'human-resources.routes.ts',
  'letter-templates': 'letter-template.routes.ts',
  'history-marking-periods': 'history-marking-periods.routes.ts',
  'historical-grades': 'historical-grades.routes.ts',
  'jahbadh-grades': 'jahbadh-grades.routes.ts',
  'jahbadh-control': 'jahbadh-control.routes.ts',
  'graduation-paths': 'graduation-paths.routes.ts',
  gradebook: 'gradebook.routes.ts',
  scheduling: 'scheduling.routes.ts',
  'schedule-requests': 'schedule-requests.routes.ts',
  'lesson-plans': 'lesson-plans.routes.ts',
  quiz: 'quiz.routes.ts',
  'online-classes': 'online-class.routes.ts',
  // Mounted at "/" with the prefix inside the router file (see ROOT_MOUNTED).
  activities: 'activities.routes.ts',
  discipline: 'discipline.routes.ts',
  attendance: 'attendance.routes.ts',
  timetable: 'timetable.routes.ts',
  'staff-absences': 'staff-absences.routes.ts',
  'entry-exit': 'entryExit.routes.ts',
  'miqat/devices': 'miqat/devices.routes.ts',
  'miqat/attendance': 'miqat/attendance.routes.ts',
  'miqat/permissions': 'miqat/permissions.routes.ts',
  'miqat/schools': 'miqat/schools.routes.ts',
  'miqat/cards': 'miqat/cards.routes.ts',
  'miqat/reports': 'miqat/reports.routes.ts',
  grievances: 'grievance.routes.ts',
  'inspection-visits': 'inspection-visit.routes.ts',
  'inspection-rubrics': 'inspection-rubric.routes.ts',
  'inspection-reports': 'inspection-report.routes.ts',
  'inspection-analytics': 'inspection-analytics.routes.ts',
  'inspection-appeals': 'inspection-appeal.routes.ts',
  'inspection-signatures': 'inspection-signature.routes.ts',
  'inspection-evaluations': 'inspection-evaluation.routes.ts',
  'inspection-forum': 'inspection-forum.routes.ts',
  'inspector-broadcasts': 'inspector-broadcast.routes.ts',
  'reading-logs': 'reading-logs.routes.ts',
  'inspector-teachers': 'inspector-teacher-profile.routes.ts',
  'inspection-coaching': 'inspection-coaching.routes.ts',
  'inspection-media': 'inspection-media.routes.ts',
  'training-prescriptions': 'training-prescription.routes.ts',
  inspectors: 'inspector-directory.routes.ts',
  performance: 'performance.routes.ts',
  'analytics/withdrawal': 'withdrawal-analytics.routes.ts',
  'advanced-report': 'advanced-report.routes.ts',
}

const MODULES: Record<string, (api: ReturnType<typeof createApiClient>) => Record<string, (...a: any[]) => Promise<unknown>>> = {
  portal: portalApi as any,
  teacher: teacherApi as any,
  assignments: assignmentsApi as any,
  exams: examsApi as any,
  teacherInspections: teacherInspectionsApi as any,
  readingLogs: readingLogsApi as any,
  inspector: inspectorApi as any,
  librarian: librarianApi as any,
  learningResources: learningResourcesApi as any,
  campuses: campusesApi as any,
  dashboard: schoolDashboardApi as any,
  school: adminSchoolApi as any,
  students: adminStudentsApi as any,
  academics: adminAcademicsApi as any,
  parents: adminParentsApi as any,
  customFields: adminCustomFieldsApi as any,
  fieldOrders: adminFieldOrdersApi as any,
  signups: adminSignupsApi as any,
  exportTemplates: exportTemplatesApi as any,
  parentAgreement: adminParentAgreementApi as any,
  schoolDataImport: ((api: any) => { const { templatePath: _t, ...rest } = adminSchoolDataImportApi(api); return rest }) as any,
  mail: adminMailApi as any,
  analytics: adminAnalyticsApi as any,
  designations: adminDesignationsApi as any,
  fees: adminFeesApi as any,
  billingElements: adminBillingElementsApi as any,
  salary: adminSalaryApi as any,
  grades: adminGradesApi as any,
  scheduling: adminSchedulingApi as any,
  quiz: adminQuizApi as any,
  onlineClasses: adminOnlineClassesApi as any,
  activities: adminActivitiesApi as any,
  historicalGrades: adminHistoricalGradesApi as any,
  jahbadhGrades: jahbadhGradesApi as any,
  jahbadhControl: jahbadhControlApi as any,
  humanResources: adminHumanResourcesApi as any,
  letterTemplates: adminLetterTemplatesApi as any,
  discipline: adminDisciplineApi as any,
  attendance: adminAttendanceApi as any,
  timetable: adminTimetableApi as any,
  periods: adminPeriodsApi as any,
  calendars: adminCalendarsApi as any,
  generator: adminGeneratorApi as any,
  adminPortal: adminPortalApi as any,
  appConfig: appConfigApi as any,
  authClient: authApi as any,
  media: mediaApi as any,
  rollover: adminRolloverApi as any,
  calculations: adminCalculationsApi as any,
  weather: adminWeatherApi as any,
  services: adminServicesApi as any,
  userProfiles: adminUserProfilesApi as any,
  push: adminPushApi as any,
  publicPages: adminPublicPagesApi as any,
  hostel: adminHostelApi as any,
  library: adminLibraryApi as any,
  textbooks: adminTextbooksApi as any,
  qirtasi: adminQirtasiApi as any,
  resources: adminResourcesApi as any,
  vault: adminVaultApi as any,
  hifzi: adminHifziApi as any,
  courses: adminCoursesApi as any,
  teacherPrograms: adminTeacherProgramsApi as any,
  speedReading: adminSpeedReadingApi as any,
  hadithForty: hadithFortyApi as any,
  jitsi: jitsiApi as any,
  quran: quranApi as any,
  fina: ((api: any) => { const m = finaApi(api); const { mediaPath: _m, rawMediaPath: _r, ...rest } = m; return rest }) as any,
  training: ((api: any) => { const m = adminTrainingApi(api); const { exportPath: _e, ...rest } = m; return rest }) as any,
  events: eventsApi as any,
  staffAbsences: adminStaffAbsencesApi as any,
  entryExit: adminEntryExitApi as any,
  miqat: adminMiqatApi as any,
  grievances: grievancesApi as any,
  inspections: adminInspectionsApi as any,
  performance: adminPerformanceApi as any,
  ...Object.fromEntries(
    (['incomes', 'expenses', 'staff-payments'] as const).map((k) => [
      `accounting_${k}`,
      ((api: any) => {
        const m = adminAccountingApi(api)
        return { ...m, entries: () => m.entries(k, 'c', 'y'), createEntry: () => m.createEntry(k, 'c', 'y', { title: 't', amount: 1, date: '2026-01-01' }), updateEntry: () => m.updateEntry(k, 'c', 'e', {}), deleteEntry: () => m.deleteEntry(k, 'c', 'e') }
      }) as any,
    ]),
  ),
  ...Object.fromEntries(
    (['student', 'teacher', 'staff', 'parent'] as const).map((e) => [
      `groupAssign_${e}`,
      ((api: any) => ({ assign: () => adminGroupAssignApi(api).assign(e, 'campus-1', ['x'], { is_active: true }) })) as any,
    ]),
  ),
  // called once per kind so both /teachers and /staff are checked
  employeesTeacher: ((api: any) => { const m = adminEmployeesApi(api); return Object.fromEntries(Object.entries(m).map(([k, f]) => [k, (...a: any[]) => (f as any)('teacher', ...a.slice(1))])) }) as any,
  employeesStaff: ((api: any) => { const m = adminEmployeesApi(api); return Object.fromEntries(Object.entries(m).map(([k, f]) => [k, (...a: any[]) => (f as any)('staff', ...a.slice(1))])) }) as any,
}

/** Extra routers whose paths sit under another mount: [file, prefix inside that file]. */
const EXTRA_ROUTERS: Record<string, [string, string][]> = {
  // hifzi/reports.routes.ts is mounted at /hifzi and declares /students/:id/heatmap etc.
  'hifzi/students': [['hifzi/reports.routes.ts', '/students']],
}

/** Routers registered at "/" whose paths already start with the mount ("/discipline/fields"). */
const ROOT_MOUNTED = new Set(['activities', 'discipline', 'ical', 'rollover', 'calculations', 'calculation-reports'])

function backendRoutes(file: string, mount: string) {
  const src = readFileSync(join(BACKEND_ROUTES, file), 'utf8')
  const patterns: RegExp[] = []
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
    const raw = ROOT_MOUNTED.has(mount) ? m[2].replace(new RegExp(`^/${mount}(?=/|$)`), '') || '/' : m[2]
    const path = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')
    patterns.push(new RegExp(`^${m[1].toUpperCase()} ${path}$`))
  }
  return (call: string) => patterns.some((re) => re.test(call))
}

async function record(factory: (typeof MODULES)[string]) {
  const calls: { method: string; path: string; headers: Record<string, string> }[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', path: new URL(url).pathname.replace(/^\/api/, ''), headers: (init?.headers ?? {}) as Record<string, string> })
    return new Response(JSON.stringify({ success: true, data: null }), { status: 200 })
  })
  const api = createApiClient({ baseUrl: 'https://api.test/api', getToken: async () => 't', fetch: fetch as any })
  for (const fn of Object.values(factory(api))) await fn('campus-1', 'x', 1)
  return calls
}

const APP_TS = join(BACKEND_ROUTES, '../app.ts')

/** A router file counts as mounted when app.ts (or a router that is itself mounted) imports it and uses the import. */
function isMounted(file: string, seen = new Set<string>()): boolean {
  const spec = `./${file.replace(/\.ts$/, '')}`
  const used = (src: string, from: string) => {
    const re = new RegExp(`import\\s+(\\w+)\\s*(?:,\\s*\\{[^}]*\\})?\\s+from\\s+['"]${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`)
    const name = src.match(re)?.[1]
    return !!name && (src.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length > 1
  }
  if (used(readFileSync(APP_TS, 'utf8'), `./routes/${file.replace(/\.ts$/, '')}`)) return true
  if (seen.has(file)) return false
  seen.add(file)
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : ''
  return readdirSync(BACKEND_ROUTES, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.routes.ts') && f !== file)
    .some((other) => {
      const odir = other.includes('/') ? other.slice(0, other.lastIndexOf('/') + 1) : ''
      const rel = odir === dir ? spec : `./${file.replace(/\.ts$/, '')}`
      const src = readFileSync(join(BACKEND_ROUTES, other), 'utf8')
      return (used(src, rel) || used(src, `../${file.replace(/\.ts$/, '')}`)) && isMounted(other, seen)
    })
}

describe('backend routers used by the app are mounted', () => {
  const files = [...new Set([...Object.values(ROUTERS), ...Object.values(EXTRA_ROUTERS).flat().map(([f]) => f)])]
  it.each(files)('%s is registered in app.ts', (file) => {
    expect(isMounted(file)).toBe(true)
  })
})

describe('admin modules match backend routes', () => {
  const routers = Object.fromEntries(
    Object.entries(ROUTERS).map(([mount, file]) => {
      const main = backendRoutes(file, mount)
      const extra = (EXTRA_ROUTERS[mount] ?? []).map(([f, prefix]) => ({ match: backendRoutes(f, mount), prefix }))
      return [mount, (call: string) => main(call) || extra.some(({ match, prefix }) => match(call.replace(' ', ` ${prefix}`)))]
    }),
  )

  for (const [name, factory] of Object.entries(MODULES)) {
    it(`${name}: every call has a route; no X-School-Id`, async () => {
      const calls = await record(factory)
      expect(calls.length).toBeGreaterThan(0)
      // Longest mount prefix wins (e.g. "analytics/withdrawal" before "analytics").
      const mounts = Object.keys(routers).sort((a, b) => b.length - a.length)
      const missing = calls.filter(({ method, path }) => {
        const mount = mounts.find((m) => path === `/${m}` || path.startsWith(`/${m}/`))
        if (!mount) return true
        const rest = path.slice(mount.length + 1) || '/'
        return !routers[mount](`${method} ${rest}`)
      })
      expect(missing).toEqual([])
      expect(calls.some((c) => Object.keys(c.headers).some((k) => k.toLowerCase() === 'x-school-id'))).toBe(false)
    })
  }
})
