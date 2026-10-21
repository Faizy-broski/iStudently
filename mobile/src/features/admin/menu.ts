import { filterAdminMenu, type AdminMenuGroup } from '@studently/shared-types';
import type { Href } from 'expo-router';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminResources, adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Web admin pages that have a native screen. Everything else in the menu opens the
 * "coming to the app" screen with an "Open on website" button. Add entries as waves land.
 */
export const NATIVE_ROUTES: Record<string, Href> = {
  '/admin/dashboard': '/admin',
  // Wave 1: people
  '/admin/students/student-info': '/admin/students',
  '/admin/students/add-student': '/admin/students/form',
  '/admin/teachers': { pathname: '/admin/employees', params: { kind: 'teacher' } },
  '/admin/teachers/add': { pathname: '/admin/employees/form', params: { kind: 'teacher' } },
  '/admin/staff': { pathname: '/admin/employees', params: { kind: 'staff' } },
  '/admin/staff/add-staff': { pathname: '/admin/employees/form', params: { kind: 'staff' } },
  '/admin/parents/parent-info': '/admin/parents',
  '/admin/parents/add-parent': '/admin/parents/form',
  '/admin/parents/associate-parent': '/admin/parents/link',
  '/admin/signup-links': '/admin/signups/links',
  '/admin/pending-approvals': '/admin/signups/pending',
  '/admin/students/custom-fields': { pathname: '/admin/fields', params: { entity: 'student' } },
  '/admin/teachers/custom-fields': { pathname: '/admin/fields', params: { entity: 'teacher' } },
  '/admin/staff/custom-fields': { pathname: '/admin/fields', params: { entity: 'staff' } },
  '/admin/parents/custom-fields': { pathname: '/admin/fields', params: { entity: 'parent' } },
  '/admin/students/group-assign': { pathname: '/admin/group-assign', params: { entity: 'student' } },
  '/admin/teachers/group-assign': { pathname: '/admin/group-assign', params: { entity: 'teacher' } },
  '/admin/staff/group-assign': { pathname: '/admin/group-assign', params: { entity: 'staff' } },
  '/admin/email/students': { pathname: '/admin/email', params: { audience: 'students' } },
  '/admin/email/staff': { pathname: '/admin/email', params: { audience: 'staff' } },
  '/admin/students/print-info': '/admin/print/student-info',
  '/admin/students/print-letters': '/admin/print/letters',
  '/admin/students/breakdown': '/admin/reports/student-breakdown',
  '/admin/students/withdrawal-chart': '/admin/reports/withdrawal',
  '/admin/email/log': '/admin/email-log',
  '/admin/teachers/workload': '/admin/workload',
  '/admin/students/bulk-import': { pathname: '/admin/import/people', params: { entity: 'student' } },
  '/admin/teachers/bulk-import': { pathname: '/admin/import/people', params: { entity: 'teacher' } },
  '/admin/staff/bulk-import': { pathname: '/admin/import/people', params: { entity: 'staff' } },
  '/admin/staff/settings': '/admin/staff-settings',
  '/admin/email/notifications': '/admin/email-notifications',
  '/admin/students/advanced-report': '/admin/reports/advanced',
  // Wave 2: fees
  '/admin/fees': '/admin/billing/fees',
  '/admin/fees/payments': '/admin/billing/payments',
  '/admin/fees/student-balances': '/admin/billing/balances',
  '/admin/fees/fee-categories': '/admin/billing/categories',
  '/admin/fees/structures': '/admin/billing/structures',
  '/admin/fees/generate': '/admin/billing/generate',
  '/admin/fees/overrides': '/admin/billing/overrides',
  '/admin/fees/settings': '/admin/billing/settings',
  '/admin/billing-elements': '/admin/billing/elements',
  '/admin/billing-elements/student-elements': '/admin/billing/student-charges',
  '/admin/billing-elements/mass-assign': '/admin/billing/mass-assign',
  '/admin/billing-elements/daily-transactions': '/admin/billing/transactions',
  '/admin/billing-elements/category-breakdown': '/admin/billing/element-breakdown',
  '/admin/fees/print-invoices': { pathname: '/admin/billing/print', params: { mode: 'invoices' } },
  '/admin/fees/print-receipts': { pathname: '/admin/billing/print', params: { mode: 'receipts' } },
  '/admin/fees/email-students': { pathname: '/admin/email', params: { audience: 'balances' } },
  '/admin/fees/email-parents': { pathname: '/admin/email', params: { audience: 'balances-parents' } },
  '/admin/accounting/incomes': { pathname: '/admin/accounting/entries', params: { kind: 'incomes' } },
  '/admin/accounting/expenses': { pathname: '/admin/accounting/entries', params: { kind: 'expenses' } },
  '/admin/accounting/staff-payments': '/admin/accounting/staff-payments',
  '/admin/accounting/teacher-hours': '/admin/accounting/teacher-hours',
  '/admin/accounting/payees': '/admin/accounting/payees',
  '/admin/accounting/daily-transactions': '/admin/accounting/daily',
  '/admin/accounting/staff-balances': '/admin/accounting/staff-balances',
  '/admin/accounting/reports': '/admin/accounting/rollup',
  '/admin/accounting/categories': '/admin/accounting/categories',
  '/admin/salary': '/admin/salary',
  '/admin/salary/generate': '/admin/salary/generate',
  '/admin/salary/advances': '/admin/salary/advances',
  '/admin/salary/settings': '/admin/salary/settings',
  '/admin/staff/financial-statements': '/admin/salary/statements',
  '/admin/jahbadh-grades': '/admin/jahbadh',
  '/admin/jahbadh-grades/distribution': '/admin/jahbadh/distribution',
  '/admin/jahbadh-grades/setup': '/admin/jahbadh/setup',
  '/admin/jahbadh-grades/report-cards': '/admin/jahbadh/report-cards',
  '/admin/jahbadh-grades/activities': '/admin/jahbadh/activities',
  '/admin/jahbadh-grades/dashboard': '/admin/jahbadh/dashboard',
  '/admin/jahbadh-grades/early-warning': { pathname: '/admin/jahbadh/insights', params: { view: 'warning' } },
  '/admin/jahbadh-grades/test-analysis': '/admin/jahbadh/test-analysis',
  '/admin/jahbadh-grades/rubrics': '/admin/jahbadh/rubrics',
  '/admin/jahbadh-grades/ideas': '/admin/jahbadh/ideas',
  '/admin/exam-control': '/admin/exam-control',
  '/admin/exam-timer': '/admin/exam-timer',
  '/admin/grades/student-grades': '/admin/grades/student-grades',
  '/admin/grades/teacher-completion': '/admin/grades/teacher-completion',
  '/admin/grades/class-ranks': '/admin/grades/class-ranks',
  '/admin/grades/honor-roll': '/admin/grades/honor-roll',
  '/admin/grades/grading-scales': '/admin/grades/scales',
  '/admin/grades/report-cards': '/admin/grades/report-cards',
  '/admin/grades/transcripts': '/admin/grades/transcripts',
  '/admin/grades/final-grades': '/admin/grades/final-grades',
  '/admin/grades/progress-reports': '/admin/grades/progress-reports',
  '/admin/grades/report-card-comments': '/admin/grades/report-card-comments',
  '/admin/grades/configuration': '/admin/grades/configuration',
  '/admin/grades/gradebook': '/admin/grades/gradebook-breakdown',
  '/admin/grades/graduation-paths': '/admin/grades/graduation-paths',
  '/admin/scheduling/dashboard': '/admin/scheduling/dashboard',
  '/admin/scheduling': '/admin/scheduling/dashboard',
  '/admin/grades': '/admin/grades/report-cards',
  '/admin/teacher-programs/final-grades': '/admin/teacher-programs/final-grades',
  '/admin/teacher-programs/gradebook': '/admin/teacher-programs/gradebook',
  '/admin/teacher-programs/anomalous-grades': '/admin/teacher-programs/anomalous-grades',
  '/admin/grades/mass-create-assignments': '/admin/grades/mass-create-assignments',
  '/admin/grades/comment-codes': '/admin/grades/comment-codes',
  '/admin/grades/import-grades': '/admin/grades/import-grades',
  '/admin/grades/history-marking-periods': '/admin/grades/history-marking-periods',
  '/admin/grades/historical-grades': '/admin/grades/historical-grades',
  '/admin/grades/email-students': { pathname: '/admin/email', params: { audience: 'report-cards' } },
  '/admin/grades/email-parents': { pathname: '/admin/email', params: { audience: 'report-cards-parents' } },
  '/admin/scheduling/courses': '/admin/scheduling/courses',
  '/admin/scheduling/group-schedule': '/admin/scheduling/group-schedule',
  '/admin/scheduling/group-drops': '/admin/scheduling/group-drops',
  '/admin/scheduling/print-schedules': '/admin/scheduling/print-schedules',
  '/admin/scheduling/print-class-pictures': '/admin/scheduling/print-class-pictures',
  '/admin/scheduling/schedule-report': '/admin/scheduling/schedule-report',
  '/admin/scheduling/requests-report': '/admin/scheduling/requests-report',
  '/admin/scheduling/incomplete-schedules': '/admin/scheduling/incomplete-schedules',
  '/admin/scheduling/student-schedule': '/admin/scheduling/student-schedule',
  '/admin/scheduling/group-requests': '/admin/scheduling/group-requests',
  '/admin/scheduling/add-drop-report': '/admin/scheduling/add-drop-report',
  '/admin/scheduling/lesson-plans': '/admin/scheduling/lesson-plans',
  '/admin/scheduling/lesson-plan-read': '/admin/scheduling/lesson-plan-read',
  '/admin/quiz': '/admin/quiz/quizzes',
  '/admin/quiz/quizzes': '/admin/quiz/quizzes',
  '/admin/quiz/exam-builder': '/admin/quiz/exam-builder',
  '/admin/quiz/questions': '/admin/quiz/questions',
  '/admin/quiz/answer-breakdown': '/admin/quiz/answer-breakdown',
  '/admin/quiz/configuration': '/admin/quiz/configuration',
  '/admin/online-classes': '/admin/online-classes',
  '/admin/online-classes/active': { pathname: '/admin/online-classes', params: { tab: 'active' } },
  '/admin/jitsi-meet': '/admin/jitsi-meet',
  '/admin/jitsi-meet/rooms': '/admin/jitsi-meet/rooms',
  '/admin/jitsi-meet/configuration': '/admin/jitsi-meet/configuration',
  '/admin/activities': '/admin/activities',
  '/admin/activities/add-activity': '/admin/activities/add-activity',
  '/admin/activities/enter-eligibility': '/admin/activities/enter-eligibility',
  '/admin/activities/reports/student-list': '/admin/activities/reports/student-list',
  '/admin/activities/reports/teacher-completion': '/admin/activities/reports/teacher-completion',
  '/admin/activities/setup/activities': '/admin/activities/setup/activities',
  '/admin/activities/setup/entry-times': '/admin/activities/setup/entry-times',
  // Wave 4: attendance & discipline
  // Attendance — group href + all menu items
  '/admin/attendance': '/admin/attendance',
  '/admin/attendance/administration': '/admin/attendance',
  '/admin/attendance/add-absences': '/admin/attendance/add-absences',
  '/admin/attendance/class-diary': '/admin/attendance/class-diary',
  '/admin/attendance/class-diary-write': '/admin/attendance/class-diary-write',
  '/admin/attendance/teacher-completion': '/admin/attendance/teacher-completion',
  '/admin/attendance/average-daily': '/admin/attendance/average-daily',
  '/admin/attendance/chart': '/admin/attendance/chart',
  '/admin/attendance/monthly-sheet': '/admin/attendance/monthly-sheet',
  '/admin/attendance/recalculate': '/admin/attendance/recalculate',
  '/admin/attendance/delete-duplicates': '/admin/attendance/delete-duplicates',
  '/admin/attendance/codes': '/admin/attendance/codes',
  '/admin/attendance/summary': { pathname: '/admin/attendance/chart', params: { mode: 'absence' } },
  '/admin/attendance/print-sheets': '/admin/attendance/print-sheets',
  '/admin/attendance/take-missing': '/admin/attendance/take-missing',
  '/admin/attendance/email-parents': { pathname: '/admin/email', params: { audience: 'days-absent' } },
  // Staff absences
  '/admin/staff-absences': '/admin/staff-absences',
  '/admin/staff-absences/absences': '/admin/staff-absences',
  '/admin/staff-absences/add-absence': '/admin/staff-absences/form',
  '/admin/staff-absences/cancelled-classes': '/admin/staff-absences/cancelled-classes',
  '/admin/staff-absences/breakdown': '/admin/staff-absences/breakdown',
  '/admin/staff-absences/fields': '/admin/staff-absences/fields',
  '/admin/teacher-programs/attendance': '/admin/teacher-programs/attendance',
  // Discipline (routes mount at "/" with /discipline/* paths)
  '/admin/discipline': '/admin/discipline',
  '/admin/discipline/add-referral-student': { pathname: '/admin/discipline/add-referral', params: { kind: 'student' } },
  '/admin/discipline/add-referral-teacher': { pathname: '/admin/discipline/add-referral', params: { kind: 'teacher' } },
  '/admin/discipline/add-referral-staff': { pathname: '/admin/discipline/add-referral', params: { kind: 'staff' } },
  '/admin/discipline/referral-form': '/admin/discipline/referral-form',
  '/admin/discipline/reports/category-breakdown': '/admin/discipline/reports/category-breakdown',
  '/admin/discipline/reports/category-breakdown-time': '/admin/discipline/reports/category-breakdown-time',
  '/admin/discipline/reports/breakdown-student-field': '/admin/discipline/reports/breakdown-student-field',
  '/admin/discipline/reports/log': '/admin/discipline/reports/log',
  '/admin/discipline/email-parents': { pathname: '/admin/email', params: { audience: 'discipline-parents' } },
  '/admin/discipline/email-students': { pathname: '/admin/email', params: { audience: 'discipline' } },
  // Entry/Exit
  '/admin/entry-exit': '/admin/entry-exit',
  '/admin/entry-exit/add-records': '/admin/entry-exit/add-records',
  '/admin/entry-exit/report': '/admin/entry-exit/report',
  '/admin/entry-exit/checkpoints': '/admin/entry-exit/checkpoints',
  '/admin/entry-exit/evening-leaves': '/admin/entry-exit/evening-leaves',
  '/admin/entry-exit/mass-evening-leaves': '/admin/entry-exit/mass-evening-leaves',
  '/admin/entry-exit/packages': '/admin/entry-exit/packages',
  '/admin/entry-exit/automatic-records': '/admin/entry-exit/automatic-records',
  '/admin/entry-exit/exceptions': '/admin/entry-exit/exceptions',
  '/admin/entry-exit/add-exceptions': '/admin/entry-exit/add-exceptions',
  '/admin/entry-exit/take-attendance': '/admin/entry-exit/take-attendance',
  // Miqat (group href is /admin/miqat/dashboard)
  '/admin/miqat/dashboard': '/admin/miqat',
  '/admin/miqat/devices': '/admin/miqat/devices',
  '/admin/miqat/cards': '/admin/miqat/cards',
  '/admin/miqat/permissions': '/admin/miqat/permissions',
  '/admin/miqat/reports': '/admin/miqat/reports',
  '/admin/miqat/settings': '/admin/miqat/settings',
  // Grievances
  '/admin/grievances': '/admin/grievances',
  '/admin/grievances/submit': '/admin/grievances/submit',
  '/admin/grievances/dashboard': '/admin/grievances/dashboard',
  '/admin/grievances/reports': '/admin/grievances/reports',
  '/admin/grievances/categories': '/admin/grievances/categories',
  '/admin/grievances/settings': '/admin/grievances/settings',
  // Inspections (group href is /admin/inspections/assignments)
  '/admin/inspections/dashboard': '/admin/inspections',
  '/admin/inspections/assignments': '/admin/inspections/assignments',
  '/admin/inspections/visits': '/admin/inspections/visits',
  '/admin/inspections/rubrics': '/admin/inspections/rubrics',
  '/admin/inspections/training-prescriptions': '/admin/inspections/training',
  '/admin/inspections/reports': '/admin/inspections/reports',
  '/admin/inspections/appeals': '/admin/inspections/appeals',
  // Performance/efficiency
  '/admin/performance': '/admin/performance',
  '/admin/performance/catalog': '/admin/performance/catalog',
  '/admin/performance/reports/category-breakdown': '/admin/performance/reports/category-breakdown',
  '/admin/performance/reports/category-breakdown-time': '/admin/performance/reports/category-breakdown-time',
  '/admin/performance/reports/breakdown-staff-field': '/admin/performance/reports/breakdown-staff-field',
  '/admin/performance/reports/log': '/admin/performance/reports/log',
  // Wave 5: school
  '/admin/academics': '/admin/academics',
  '/admin/academics/grades': '/admin/academics/grades',
  '/admin/academics/sections': '/admin/academics/sections',
  '/admin/academics/subjects': '/admin/academics/subjects',
  '/admin/periods': '/admin/periods',
  '/admin/marking-periods': '/admin/marking-periods',
  '/admin/events': '/admin/events',
  '/admin/timetable': '/admin/timetable',
  '/admin/timetable/import': '/admin/timetable/import',
  '/admin/portal/notes': '/admin/portal/notes',
  '/admin/portal/polls': '/admin/portal/polls',
  '/admin/rollover': '/admin/rollover',
  '/admin/rollover/semester': '/admin/rollover/semester',
  '/admin/settings/plugins': '/admin/settings/plugins',
  '/admin/settings/marking-period-groups': '/admin/settings/marking-period-groups',
  '/admin/settings/academic-years': '/admin/settings/academic-years',
  '/admin/school-details': '/admin/school-details',
  '/admin/setup': '/admin/setup',
  '/admin/setup/import-school-data': '/admin/import/school-data',
  '/admin/reports/calculations': '/admin/reports/calculations',
  '/admin/reports/calculation-reports': '/admin/reports/calculation-reports',
  '/admin/training': '/admin/training',
  '/admin/training/create': '/admin/training/form',
  '/admin/messaging': '/admin/messaging',
  '/admin/messaging/write': '/admin/messaging/write',
  '/admin/settings/teacher-messaging': '/admin/settings/teacher-messaging',
  '/admin/weather-alerts/dashboard': '/admin/weather-alerts/dashboard',
  '/admin/weather-alerts/settings': '/admin/weather-alerts/settings',
  '/admin/settings': '/admin/settings',
  '/admin/settings/campuses': '/admin/settings/campuses',
  '/admin/settings/sidebar-theme': '/admin/settings/sidebar-theme',
  '/admin/settings/services': '/admin/settings/services',
  '/admin/settings/automatic-attendance': '/admin/settings/automatic-attendance',
  '/admin/settings/student-list-display': '/admin/settings/student-list-display',
  '/admin/settings/assignment-max-points': '/admin/settings/assignment-max-points',
  '/admin/settings/convert-names-titlecase': '/admin/settings/convert-names-titlecase',
  '/admin/settings/force-password-change': '/admin/settings/force-password-change',
  '/admin/settings/google-social-login': { pathname: '/admin/settings/social-login', params: { provider: 'google' } },
  '/admin/settings/microsoft-social-login': { pathname: '/admin/settings/social-login', params: { provider: 'microsoft' } },
  '/admin/settings/custom-menu': '/admin/settings/custom-menu',
  '/admin/settings/setup-assistant': '/admin/settings/setup-assistant',
  '/admin/settings/user-agreements': '/admin/settings/user-agreements',
  '/admin/settings/parent-agreement': '/admin/settings/parent-agreement',
  '/admin/settings/grade-progression': '/admin/settings/grade-progression',
  '/admin/settings/user-profiles': '/admin/settings/user-profiles',
  '/admin/settings/push-notifications': '/admin/settings/push-notifications',
  '/admin/settings/email-reminders': '/admin/settings/email-reminders',
  '/admin/settings/email-smtp': '/admin/settings/email-smtp',
  '/admin/settings/pdf-header-footer': '/admin/settings/pdf-header-footer',
  '/admin/settings/public-pages': '/admin/settings/public-pages',
  '/admin/settings/two-factor-auth': '/admin/settings/two-factor-auth',
  '/admin/profile': '/admin/profile',
  '/admin/hostel': '/admin/hostel',
  '/admin/hostel/buildings': '/admin/hostel/buildings',
  '/admin/hostel/rooms': '/admin/hostel/rooms',
  '/admin/hostel/assignments': '/admin/hostel/assignments',
  '/admin/hostel/visits': '/admin/hostel/visits',
  '/admin/hostel/fees': '/admin/hostel/fees',
  '/admin/hostel/fields': '/admin/hostel/fields',
  '/admin/hostel/settings': '/admin/hostel/settings',
  '/admin/library': '/admin/library',
  '/admin/library/books': '/admin/library/books',
  '/admin/library/e-library': '/admin/library/e-library',
  '/admin/library/loans': '/admin/library/loans',
  '/admin/library/fines': '/admin/library/fines',
  '/admin/library/categories': '/admin/library/categories',
  '/admin/library/document-fields': '/admin/library/document-fields',
  '/admin/textbooks': '/admin/textbooks',
  '/admin/textbooks/matrix': '/admin/textbooks/matrix',
  '/admin/textbooks/dashboard': '/admin/textbooks/dashboard',
  '/admin/textbooks/return-mode': '/admin/textbooks/return-mode',
  '/admin/qirtasi/worksheets': '/admin/qirtasi/worksheets',
  '/admin/qirtasi/curriculum': '/admin/qirtasi/curriculum',
  '/admin/resources/links': '/admin/resources/links',
  '/admin/resources/dashboards': '/admin/resources/dashboards',
  '/admin/resources/school-inventory': '/admin/resources/school-inventory',
  '/admin/resources/inventory-snapshots': '/admin/resources/inventory-snapshots',
  '/admin/physics-labs': '/admin/physics-labs',
  '/admin/resources/embedded': '/admin/resources/embedded',
  '/admin/vault': '/admin/vault',
  // Wave 7: plugins
  '/admin/hifzi': '/admin/hifzi',
  '/admin/hifzi/circles': '/admin/hifzi/circles',
  '/admin/hifzi/students': '/admin/hifzi/students',
  '/admin/hifzi/curriculum': '/admin/hifzi/curriculum',
  '/admin/hifzi/quran': '/admin/hifzi/quran',
  '/admin/hifzi/gradebook': '/admin/hifzi/gradebook',
  '/admin/hifzi/compliance': '/admin/hifzi/compliance',
  '/admin/hifzi/plans': '/admin/hifzi/plans',
  '/admin/hifzi/attendance': '/admin/hifzi/attendance',
  '/admin/hifzi/reports': '/admin/hifzi/reports',
  '/admin/hifzi/settings': '/admin/hifzi/settings',
  '/admin/fina/wall': '/admin/fina/wall',
  '/admin/fina/compose': '/admin/fina/compose',
  '/admin/fina/media': '/admin/fina/media',
  '/admin/fina/albums': '/admin/fina/albums',
  '/admin/fina/approvals': '/admin/fina/approvals',
  '/admin/fina/groups': '/admin/fina/groups',
  '/admin/fina/events': '/admin/fina/events',
  '/admin/fina/threads': '/admin/fina/threads',
  '/admin/fina/notifications': '/admin/fina/notifications',
  '/admin/fina/audit': '/admin/fina/audit',
  '/admin/fina/reports': '/admin/fina/reports',
  '/admin/speed-reading': '/admin/speed-reading',
  '/admin/speed-reading/texts': '/admin/speed-reading/texts',
  '/admin/speed-reading/sessions': '/admin/speed-reading/sessions',
  '/admin/resources/hadith-forty': '/admin/resources/hadith-forty',
  '/admin/resources/hadith-forty/class': '/admin/resources/hadith-forty/class',
  '/admin/id-card': '/admin/tools/id-card-designer',
  '/admin/certificate-templates': '/admin/tools/certificate-templates',
  '/admin/students/id-card': '/admin/tools/student-id-card',
  '/admin/students/certificate-enrollment': '/admin/tools/certificate-enrollment',
  '/admin/resources/jperiod': '/admin/tools/jperiod',
  '/admin/resources/arabic-fluency': '/admin/tools/arabic-fluency',
  '/admin/resources/calculators-arena': '/admin/tools/calculators-arena',
  '/admin/resources/human-atlas': '/admin/tools/human-atlas',
  '/admin/resources/physics-virtual-labs': '/admin/tools/physics-virtual-labs',
  '/admin/resources/chemistry-virtual-labs': '/admin/tools/chemistry-virtual-labs',
  '/admin/resources/circuit-simulator': '/admin/tools/circuit-simulator',
  '/admin/resources/interactive-geometry': '/admin/tools/interactive-geometry',
  '/admin/resources/mental-math': '/admin/tools/mental-math',
  '/admin/resources/anatomy-3d': '/admin/tools/anatomy-3d',
  '/admin/resources/qaida': '/admin/tools/qaida',
  '/admin/resources/virtual-labs': '/admin/tools/virtual-labs',
};

/** The native route for an admin menu href, including the dynamic embedded-resource pages. */
export function adminRouteFor(href: string): Href | null {
  const fixed: Href | undefined = NATIVE_ROUTES[href];
  if (fixed) return fixed;
  const m = /^\/admin\/resources\/embedded\/([^/]+)$/.exec(href);
  if (!m) return null;
  const path: string = `/admin/resources/embedded/${encodeURIComponent(m[1])}`;
  return path as unknown as Href;
}

/** Menu groups shown on each admin tab; everything else is under More. */
export const TAB_GROUPS = {
  people: ['students', 'teachers', 'staff', 'parents', 'user_management'],
  fees: ['student_billing', 'billing_elements', 'accounting', 'salary'],
  academics: ['grades', 'scheduling', 'quiz', 'online_classes', 'activities'],
};

/** The admin menu for this user and campus, filtered exactly like the web sidebar. */
export function useAdminMenu() {
  const { me } = useSession();
  const { campusId } = useCampus();
  const role = me.status === 'ready' ? me.me.profile.role : null;
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const permissions = useApi(role === 'staff' ? ['admin', 'my-permissions'] : null, () => adminSchool.getMyPermissions());
  // Web DashboardLayout: admins get every embedded resource under Resources → Premium resources.
  const embedded = useApi(role === 'admin' ? ['admin', 'embedded', campusId ?? 'school'] : null, () => adminResources.embedded(campusId), { revalidateOnFocus: false });

  const groups = useMemo<AdminMenuGroup[]>(() => {
    if (role !== 'admin' && role !== 'staff') return [];
    const s = settings.data;
    // Plugins can differ per campus (the web reads them from the campus's settings row).
    const plugins = s?.active_plugins
      ? Object.entries(s.active_plugins)
          .filter(([, on]) => on)
          .map(([id]) => id)
      : me.status === 'ready'
        ? me.me.plugins
        : [];
    const menu = filterAdminMenu({
      role,
      plugins,
      deniedModules: s?.denied_modules ?? null,
      permissions: role === 'staff' ? (permissions.data ?? null) : null,
      customOrder: s?.custom_menu_order?.admin ?? null,
    });
    const extra = (embedded.data ?? []).map((r) => ({ title: r.title, href: `/admin/resources/embedded/${r.id}` }));
    if (!extra.length) return menu;
    return menu.map((g) => {
      if (g.title !== 'resources' || g.items.length === 0) return g;
      const have = new Set(g.items.map((i) => i.href));
      const add = extra.filter((i) => !have.has(i.href));
      if (!add.length) return g;
      const label = g.items.some((i) => i.title === 'premium_resources' && i.label) ? [] : [{ title: 'premium_resources', href: '#', label: true }];
      return { ...g, items: [...g.items, ...label, ...add] };
    });
  }, [role, settings.data, permissions.data, me, embedded.data]);

  return {
    groups,
    isLoading: settings.isLoading || permissions.isLoading,
    error: settings.error ?? permissions.error,
    refresh: () => {
      settings.mutate();
      permissions.mutate();
    },
  };
}
