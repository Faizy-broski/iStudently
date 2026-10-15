// Copies the namespaces the app uses from the web's translation files
// (frontend/messages/{en,ar}.json) into src/i18n/messages. Run after web strings change:
//   node scripts/sync-messages.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAMESPACES = [
  'common', 'login', 'auth', 'twoFa', 'changePassword', 'agreement', 'pushNotifications',
  'studentPortal', 'parentPortal', 'teacherPortal', 'librarianPortal',
  'attendance', 'grievances', 'quiz', 'miqat', 'online_classes', 'hifzi',
  // super admin
  'sidebar', 'superadmin', 'publicPages', 'sidebarConfig',
  // school admin, wave 1 (people)
  'school', 'teachers', 'staff', 'parents', 'signupLinks', 'pendingApprovals', 'credentials', 'withdrawal', 'email', 'admin',
  // wave 2 (fees & accounting)
  'fees', 'student_billing', 'billingElements', 'accounting', 'salary', 'payslip', 'financial_statements',
  // wave 4 (attendance & discipline)
  'attendanceMonthlySheet', 'staffAbsences', 'discipline', 'entryExit', 'inspections', 'teacherPrograms',
  // wave 5 (school & settings)
  'setup', 'adminTrainingSessions', 'teacherPages', 'weather_alerts',
  // wave 6 (resources & services)
  'textbooks', 'physicsLabs', 'adminVault',
  // wave 7 (plugins)
  'fina', 'speedReading', 'hadithForty',
  // parity sweep
  'live_class', 'activities',
  // student app
  'dashboard',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
for (const locale of ['en', 'ar']) {
  const all = JSON.parse(readFileSync(join(root, 'frontend', 'messages', `${locale}.json`), 'utf8'))
  const picked = Object.fromEntries(NAMESPACES.filter((ns) => ns in all).map((ns) => [ns, all[ns]]))
  const missing = NAMESPACES.filter((ns) => !(ns in all))
  if (missing.length) console.warn(`${locale}: missing namespaces ${missing.join(', ')}`)
  const out = join(root, 'mobile', 'src', 'i18n', 'messages', `${locale}.json`)
  writeFileSync(out, JSON.stringify(picked))
  console.log(`${locale}: ${Object.keys(picked).length} namespaces, ${(JSON.stringify(picked).length / 1024).toFixed(0)} KB`)
}
