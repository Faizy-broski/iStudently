import { filterAdminMenu, ROLE_MENUS, type AdminMenuGroup, type AdminMenuItem, type MenuRole } from '@studently/shared-types';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';

import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';

export type PortalRole = Extract<MenuRole, 'student' | 'parent' | 'teacher' | 'librarian'>;

/**
 * Web pages of each role that have a native screen. Everything else in the menu opens the
 * role's "Open on website" screen. Add entries as pages land.
 */
export const PORTAL_ROUTES: Record<PortalRole, Record<string, Href>> = {
  student: {
    '/student/dashboard': '/student',
    '/student/school-information': '/student/school-information',
    '/student/events': '/student/events',
    '/student/marking-periods': '/student/marking-periods',
    '/student/portal/notes': '/student/portal/notes',
    '/student/portal/polls': '/student/portal/polls',
    '/student/students': '/student/students',
    '/student/messaging': '/student/messaging',
    '/student/messaging/write': '/student/messaging/write',
    '/student/grievances': '/student/grievances',
    '/student/grievances/submit': '/student/grievances/submit',
    '/student/scheduling/schedule': '/student/scheduling/schedule',
    '/student/scheduling/student-requests': '/student/scheduling/student-requests',
    '/student/scheduling/courses': '/student/scheduling/courses',
    '/student/scheduling/lesson-plan-read': '/student/scheduling/lesson-plan-read',
    '/student/scheduling/print-schedules': '/student/scheduling/print-schedules',
    '/student/scheduling/print-class-pictures': '/student/scheduling/print-class-pictures',
    '/student/grades/student-grades': '/student/grades/student-grades',
    '/student/assignments': '/student/assignments',
    '/student/quizzes': '/student/quizzes',
    '/student/grades/final-grades': '/student/grades/final-grades',
    '/student/grades/report-cards': '/student/grades/report-cards',
    '/student/grades/progress-reports': '/student/grades/progress-reports',
    '/student/grades/transcripts': '/student/grades/transcripts',
    '/student/grades/gpa-rank-list': '/student/grades/gpa-rank-list',
    '/student/attendance': '/student/attendance',
    '/student/discipline': '/student/discipline',
    '/student/activities': '/student/activities',
    '/student/billing/fees': '/student/billing/fees',
    '/student/billing/timeline': '/student/billing/timeline',
    '/student/billing/payments': '/student/billing/payments',
    '/student/billing/daily-transactions': '/student/billing/daily-transactions',
    '/student/billing/print-statements': '/student/billing/print-statements',
    '/student/hostel': '/student/hostel',
    '/student/library': '/student/library',
    '/student/e-library': '/student/e-library',
    '/student/resources': '/student/resources',
    '/student/learning-resources': '/student/learning-resources',
    '/student/syllabus': '/student/syllabus',
    '/student/materials': '/student/materials',
    '/student/resources/embedded': '/student/resources/embedded',
    '/student/qirtasi/worksheets': '/student/qirtasi/worksheets',
    '/student/jahbadh-report-cards': '/student/jahbadh-report-cards',
    '/student/resources/hadith-forty': '/student/resources/hadith-forty',
    '/student/resources/physics-labs': '/student/resources/physics-labs',
    '/student/resources/jperiod': '/student/tools/jperiod',
    '/student/resources/zperiod': '/student/tools/zperiod',
    '/student/resources/arabic-fluency': '/student/tools/arabic-fluency',
    '/student/resources/calculators-arena': '/student/tools/calculators-arena',
    '/student/resources/human-atlas': '/student/tools/human-atlas',
    '/student/resources/physics-virtual-labs': '/student/tools/physics-virtual-labs',
    '/student/resources/chemistry-virtual-labs': '/student/tools/chemistry-virtual-labs',
    '/student/resources/circuit-simulator': '/student/tools/circuit-simulator',
    '/student/resources/interactive-geometry': '/student/tools/interactive-geometry',
    '/student/resources/mental-math': '/student/tools/mental-math',
    '/student/resources/anatomy-3d': '/student/tools/anatomy-3d',
    '/student/resources/qaida': '/student/tools/qaida',
    '/student/resources/virtual-labs': '/student/tools/virtual-labs',
    '/student/online-classes': '/student/online-classes',
    '/student/online-classes/enrolled': '/student/online-classes/enrolled',
    '/student/jitsi-meet': '/student/jitsi-meet',
    '/student/hifzi': '/student/hifzi',
    '/student/hifzi/quran': '/student/hifzi/quran',
    '/student/fina/wall': '/student/fina/wall',
    '/student/fina/groups': '/student/fina/groups',
    '/student/fina/events': '/student/fina/events',
    '/student/profile': '/student/profile',
    '/student/students/advanced-report': '/student/students/advanced-report',
    '/student/agreement': '/student/agreement',
    '/student/id-card': { pathname: '/student/web', params: { path: '/student/id-card', title: 'id_card' } },
    '/student/speed-reading': '/student/speed-reading',
    '/student/speed-reading/history': '/student/speed-reading/history',
    '/student/timetable': '/student/timetable',
  },
  parent: {
    '/parent/dashboard': '/parent',
    '/parent/resources/jperiod': '/parent/tools/jperiod',
    '/parent/resources/zperiod': '/parent/tools/zperiod',
    '/parent/resources/arabic-fluency': '/parent/tools/arabic-fluency',
    '/parent/resources/calculators-arena': '/parent/tools/calculators-arena',
    '/parent/resources/human-atlas': '/parent/tools/human-atlas',
    '/parent/resources/physics-virtual-labs': '/parent/tools/physics-virtual-labs',
    '/parent/resources/chemistry-virtual-labs': '/parent/tools/chemistry-virtual-labs',
    '/parent/resources/circuit-simulator': '/parent/tools/circuit-simulator',
    '/parent/resources/interactive-geometry': '/parent/tools/interactive-geometry',
    '/parent/resources/mental-math': '/parent/tools/mental-math',
    '/parent/resources/anatomy-3d': '/parent/tools/anatomy-3d',
    '/parent/resources/qaida': '/parent/tools/qaida',
    '/parent/resources/virtual-labs': '/parent/tools/virtual-labs',
    '/parent/id-card': '/parent/id-card',
    '/parent/messaging': '/parent/messaging',
    '/parent/messaging/write': '/parent/messaging/write',
    '/parent/grievances': '/parent/grievances',
    '/parent/grievances/submit': '/parent/grievances/submit',
    '/parent/portal/notes': '/parent/portal/notes',
    '/parent/portal/polls': '/parent/portal/polls',
    '/parent/jitsi-meet': '/parent/jitsi-meet',
    '/parent/hifzi/quran': '/parent/hifzi/quran',
    '/parent/resources/hadith-forty': '/parent/resources/hadith-forty',
    '/parent/qirtasi/worksheets': '/parent/qirtasi/worksheets',
    '/parent/jahbadh-report-cards': '/parent/jahbadh-report-cards',
    '/parent/resources/embedded': '/parent/resources/embedded',
    '/parent/fina/wall': '/parent/fina/wall',
    '/parent/fina/groups': '/parent/fina/groups',
    '/parent/fina/events': '/parent/fina/events',
    '/parent/fina/albums': '/parent/fina/albums',
    '/parent/fina/threads': '/parent/fina/threads',
    '/parent/fina/notifications': '/parent/fina/notifications',
    '/parent/fina/consent': '/parent/fina/consent',
    '/parent/agreement': '/parent/agreement',
    '/parent/resources': '/parent/resources',
    '/parent/events': '/parent/events',
    '/parent/school-information': '/parent/school-information',
    '/parent/marking-periods': '/parent/marking-periods',
    '/parent/students': '/parent/students',
    '/parent/students/advanced-report': '/parent/students/advanced-report',
    '/parent/students/advanced-report/results': '/parent/students/advanced-report-results',
    '/parent/billing/fees': '/parent/billing/fees',
    '/parent/billing/timeline': '/parent/billing/timeline',
    '/parent/billing/payments': '/parent/billing/payments',
    '/parent/billing/daily-transactions': '/parent/billing/daily-transactions',
    '/parent/billing/print-statements': '/parent/billing/print-statements',
    '/parent/fees': '/parent/fees',
    '/parent/scheduling/schedule': '/parent/scheduling/schedule',
    '/parent/scheduling/student-requests': '/parent/scheduling/student-requests',
    '/parent/scheduling/courses': '/parent/scheduling/courses',
    '/parent/scheduling/lesson-plan-read': '/parent/scheduling/lesson-plan-read',
    '/parent/scheduling/print-schedules': '/parent/scheduling/print-schedules',
    '/parent/scheduling/print-class-pictures': '/parent/scheduling/print-class-pictures',
    '/parent/grades/student-grades': '/parent/grades/student-grades',
    '/parent/grades/student-assignments': '/parent/grades/student-assignments',
    '/parent/grades/final-grades': '/parent/grades/final-grades',
    '/parent/grades/report-cards': '/parent/grades/report-cards',
    '/parent/grades/progress-reports': '/parent/grades/progress-reports',
    '/parent/grades/transcripts': '/parent/grades/transcripts',
    '/parent/grades/gpa-rank-list': '/parent/grades/gpa-rank-list',
    '/parent/attendance': '/parent/attendance',
    '/parent/discipline': '/parent/discipline',
    '/parent/activities': '/parent/activities',
    '/parent/class-diary': '/parent/class-diary',
    '/parent/timetable': '/parent/timetable',
    '/parent/hifzi': '/parent/hifzi',
    '/parent/miqat': '/parent/miqat',
    '/parent/settings': '/parent/settings',
    '/parent/academics': '/parent/academic-overview',
    '/parent/homework': '/parent/homework',
  },
  teacher: {
    '/teacher/dashboard': '/teacher',
    '/teacher/resources/jperiod': '/teacher/tools/jperiod',
    '/teacher/resources/zperiod': '/teacher/tools/zperiod',
    '/teacher/resources/arabic-fluency': '/teacher/tools/arabic-fluency',
    '/teacher/resources/calculators-arena': '/teacher/tools/calculators-arena',
    '/teacher/resources/human-atlas': '/teacher/tools/human-atlas',
    '/teacher/resources/physics-virtual-labs': '/teacher/tools/physics-virtual-labs',
    '/teacher/resources/chemistry-virtual-labs': '/teacher/tools/chemistry-virtual-labs',
    '/teacher/resources/circuit-simulator': '/teacher/tools/circuit-simulator',
    '/teacher/resources/interactive-geometry': '/teacher/tools/interactive-geometry',
    '/teacher/resources/mental-math': '/teacher/tools/mental-math',
    '/teacher/resources/anatomy-3d': '/teacher/tools/anatomy-3d',
    '/teacher/resources/qaida': '/teacher/tools/qaida',
    '/teacher/resources/virtual-labs': '/teacher/tools/virtual-labs',
    '/teacher/scheduling/schedule': '/teacher/scheduling/schedule',
    '/teacher/scheduling/courses': '/teacher/scheduling/courses',
    '/teacher/scheduling/print-schedules': '/teacher/scheduling/print-schedules',
    '/teacher/scheduling/print-class-pictures': '/teacher/scheduling/print-class-pictures',
    '/teacher/messaging': '/teacher/messaging',
    '/teacher/messaging/write': '/teacher/messaging/write',
    '/teacher/grievances': '/teacher/grievances',
    '/teacher/grievances/submit': '/teacher/grievances/submit',
    '/teacher/hifzi/quran': '/teacher/hifzi/quran',
    '/teacher/resources/hadith-forty': '/teacher/resources/hadith-forty',
    '/teacher/resources/hadith-forty/class': '/teacher/resources/hadith-forty/class',
    '/teacher/resources/embedded': '/teacher/resources/embedded',
    '/teacher/fina/wall': '/teacher/fina/wall',
    '/teacher/fina/compose': '/teacher/fina/compose',
    '/teacher/fina/my-posts': '/teacher/fina/my-posts',
    '/teacher/fina/media': '/teacher/fina/media',
    '/teacher/fina/albums': '/teacher/fina/albums',
    '/teacher/fina/groups': '/teacher/fina/groups',
    '/teacher/fina/events': '/teacher/fina/events',
    '/teacher/fina/threads': '/teacher/fina/threads',
    '/teacher/qirtasi/worksheets': '/teacher/qirtasi/worksheets',
    '/teacher/jahbadh-grades': '/teacher/jahbadh',
    '/teacher/jahbadh-grades/distribution': '/teacher/jahbadh/distribution',
    '/teacher/jahbadh-grades/report-cards': '/teacher/jahbadh/report-cards',
    '/teacher/jahbadh-grades/activities': '/teacher/jahbadh/activities',
    '/teacher/jahbadh-grades/dashboard': '/teacher/jahbadh/dashboard',
    '/teacher/jahbadh-grades/early-warning': { pathname: '/teacher/jahbadh/insights', params: { view: 'warning' } },
    '/teacher/jahbadh-grades/test-analysis': '/teacher/jahbadh/test-analysis',
    '/teacher/jahbadh-grades/rubrics': '/teacher/jahbadh/rubrics',
    '/teacher/jahbadh-grades/ideas': '/teacher/jahbadh/ideas',
    '/teacher/exam-control': '/teacher/exam-control',
    '/teacher/exam-timer': '/teacher/exam-timer',
    '/teacher/agreement': '/teacher/agreement',
    '/teacher/resources': '/teacher/resources',
    '/teacher/portal/notes': '/teacher/portal/notes',
    '/teacher/portal/polls': '/teacher/portal/polls',
    '/teacher/jitsi-meet': '/teacher/jitsi-meet',
    '/teacher/jitsi-meet/rooms': '/teacher/jitsi-meet/rooms',
    '/teacher/school-information': '/teacher/school-information',
    '/teacher/marking-periods': '/teacher/marking-periods',
    '/teacher/periods': '/teacher/periods',
    '/teacher/events': '/teacher/events',
    '/teacher/id-card': '/teacher/id-card',
    '/teacher/discipline/add-referral': '/teacher/discipline/add-referral',
    '/teacher/discipline/referrals': '/teacher/discipline/referrals',
    '/teacher/discipline/reports/category-breakdown': '/teacher/discipline/reports/category-breakdown',
    '/teacher/discipline/reports/category-breakdown-time': '/teacher/discipline/reports/category-breakdown-time',
    '/teacher/discipline/reports/breakdown-student-field': '/teacher/discipline/reports/breakdown-student-field',
    '/teacher/discipline/reports/log': '/teacher/discipline/reports/log',
    '/teacher/exams/builder': '/teacher/exams/builder',
    '/teacher/lesson-plans': '/teacher/lesson-plans',
    '/teacher/lesson-plan-read': '/teacher/lesson-plan-read',
    '/teacher/grades/gradebook': '/teacher/grades/gradebook',
    '/teacher/grades/input-final-grades': '/teacher/grades/input-final-grades',
    '/teacher/grades/anomalous-grades': '/teacher/grades/anomalous-grades',
    '/teacher/grades/report-cards': '/teacher/grades/report-cards',
    '/teacher/grades/progress-reports': '/teacher/grades/progress-reports',
    '/teacher/grades/gradebook-breakdown': '/teacher/grades/gradebook-breakdown',
    '/teacher/grades/final-grades': '/teacher/grades/final-grades',
    '/teacher/grades/student-grades': '/teacher/grades/student-grades',
    '/teacher/grades/configuration': '/teacher/grades/configuration',
    '/teacher/grades/grading-scales': '/teacher/grades/grading-scales',
    '/teacher/grades/report-card-comments': '/teacher/grades/report-card-comments',
    '/teacher/grades/comment-codes': '/teacher/grades/comment-codes',
    '/teacher/grades/assignments': '/teacher/grades/assignments',
    '/teacher/attendance': '/teacher/attendance',
    '/teacher/attendance/take-attendance': '/teacher/attendance/take-attendance',
    '/teacher/attendance/daily-summary': '/teacher/attendance/daily-summary',
    '/teacher/students': '/teacher/students',
    '/teacher/students/print-letters': '/teacher/students/print-letters',
    '/teacher/students/student-labels': '/teacher/students/student-labels',
    '/teacher/students/associated-parents': '/teacher/students/associated-parents',
    '/teacher/students/advanced-report': '/teacher/students/advanced-report',
    '/teacher/students/advanced-report/results': '/teacher/students/advanced-report-results',
    '/teacher/activities/eligibility': '/teacher/activities/eligibility',
    '/teacher/activities': '/teacher/activities/eligibility',
    '/teacher/performance': '/teacher/performance',
    '/teacher/accounting': '/teacher/accounting/salaries',
    '/teacher/accounting/salaries': '/teacher/accounting/salaries',
    '/teacher/grades/gpa-rank-list': '/teacher/grades/gpa-rank-list',
    '/teacher/accounting/staff-payments': '/teacher/accounting/staff-payments',
    '/teacher/accounting/print-statements': '/teacher/accounting/print-statements',
    '/teacher/hifzi': '/teacher/hifzi',
    '/teacher/hifzi/recite': '/teacher/hifzi/recite',
    '/teacher/hifzi/attendance': '/teacher/hifzi/attendance',
    '/teacher/hifzi/plans': '/teacher/hifzi/plans',
    '/teacher/timetable': '/teacher/timetable',
    '/teacher/subjects': '/teacher/subjects',
    '/teacher/class-diary': '/teacher/class-diary',
    '/teacher/assignments': '/teacher/assignments',
    '/teacher/submissions': '/teacher/submissions',
    '/teacher/exams': '/teacher/exams',
    '/teacher/quiz': '/teacher/quiz',
    '/teacher/online-classes': '/teacher/online-classes',
    '/teacher/learning-resources': '/teacher/learning-resources',
    '/teacher/reports': '/teacher/reports',
    '/teacher/inspections': '/teacher/inspections',
    '/teacher/inspections/training': '/teacher/inspections/training',
    '/teacher/inspections/reports': '/teacher/inspections/reports',
    '/teacher/inspections/appeals': '/teacher/inspections/appeals',
    '/teacher/inspections/community': '/teacher/inspections/community',
    '/teacher/reading-logs': '/teacher/reading-logs',
    '/teacher/school-pages': '/teacher/school-pages',
    '/teacher/settings': '/teacher/settings',
    '/teacher/grades/import-grades': '/teacher/grades/import-grades',
  },
  librarian: {
    '/librarian/dashboard': '/librarian',
    '/librarian/settings': '/librarian/library-settings',
    '/librarian/books': '/librarian/books',
    '/librarian/e-library': '/librarian/e-library',
    '/librarian/loans': '/librarian/loans',
    '/librarian/issue': '/librarian/issue',
    '/librarian/return': '/librarian/return',
    '/librarian/lost': '/librarian/lost',
    '/librarian/fines': '/librarian/fines',
    '/librarian/qirtasi/worksheets': '/librarian/qirtasi/worksheets',
    '/librarian/worksheets': '/librarian/qirtasi/worksheets',
    '/librarian/library/categories': '/librarian/library/categories',
    '/librarian/library/document-fields': '/librarian/library/document-fields',
    '/librarian/discipline': '/librarian/discipline',
    '/librarian/discipline/new': '/librarian/discipline/new',
    '/librarian/grievances': '/librarian/grievances',
    '/librarian/grievances/submit': '/librarian/grievances/submit',
    '/librarian/id-card': '/librarian/id-card',
    '/librarian/agreement': '/librarian/agreement',
    '/librarian/students/advanced-report': '/librarian/students/advanced-report',
    '/librarian/students/advanced-report/results': '/librarian/students/advanced-report-results',
    '/profile': '/librarian/profile',
  },
};

/** Native route for a web href, including the dynamic per-resource embedded pages. */
export function portalRouteFor(role: PortalRole, href: string): Href | null {
  const fixed = PORTAL_ROUTES[role][href];
  if (fixed) return fixed;
  const m = new RegExp(`^/${role}/resources/embedded/([^/]+)$`).exec(href);
  if (m && PORTAL_ROUTES[role][`/${role}/resources/embedded`]) return { pathname: `/${role}/resources/embedded/[id]`, params: { id: m[1] } } as Href;
  return null;
}

export function openPortalPage(role: PortalRole, item: Pick<AdminMenuItem, 'href' | 'title'>) {
  const route = portalRouteFor(role, item.href);
  if (route) router.push(route);
  else router.push({ pathname: `/${role}/module`, params: { href: item.href, title: item.title } } as Href);
}

/** The settings of the user's own campus (plugins, deny-list, menu order, Setup Assistant roles). */
export function usePortalSettings() {
  const { campusId } = useCampus();
  return useApi(['portal', 'settings', campusId ?? 'school'], ([, , c]) => portal.settings(c === 'school' ? undefined : c));
}

/** Active plugins from the campus settings, else from /auth/me. */
export function usePortalPlugins(): string[] {
  const { me } = useSession();
  const settings = usePortalSettings();
  const active = settings.data?.active_plugins;
  return useMemo(
    () =>
      active
        ? Object.entries(active)
            .filter(([, on]) => on)
            .map(([id]) => id)
        : me.status === 'ready'
          ? me.me.plugins
          : [],
    [active, me],
  );
}

/** The web's dynamic "Premium Resources": embedded resources published to this user. */
function withEmbedded(menu: AdminMenuGroup[], role: PortalRole, embedded: { id: string; title: string }[]): AdminMenuGroup[] {
  if (embedded.length === 0) return menu;
  return menu.map((g) => {
    if (g.title !== 'resources' || g.items.length === 0) return g;
    const have = new Set(g.items.map((i) => i.href));
    const add = embedded.map((r) => ({ title: r.title, href: `/${role}/resources/embedded/${r.id}` })).filter((i) => !have.has(i.href));
    if (add.length === 0) return g;
    const label = g.items.some((i) => i.title === 'premium_resources' && i.label) ? [] : [{ title: 'premium_resources', href: '#', label: true }];
    return { ...g, items: [...g.items, ...label, ...add] };
  });
}

/** This role's web sidebar for this user, filtered exactly like the web's DashboardLayout. */
export function usePortalMenu(role: PortalRole) {
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const permissions = useApi(['portal', 'my-permissions'], () => portal.myPermissions());
  const embedded = useApi(['portal', 'embedded', role], () => portal.embeddedForUser());

  const groups = useMemo<AdminMenuGroup[]>(() => {
    const s = settings.data;
    return filterAdminMenu(
      {
        role,
        plugins,
        deniedModules: s?.denied_modules ?? null,
        permissions: permissions.data ?? null,
        customOrder: s?.custom_menu_order?.[role] ?? null,
      },
      withEmbedded(ROLE_MENUS[role], role, embedded.data ?? []),
    );
  }, [role, settings.data, plugins, permissions.data, embedded.data]);

  return {
    groups,
    isLoading: settings.isLoading || permissions.isLoading,
    error: settings.error ?? permissions.error,
    refresh: () => {
      settings.mutate();
      permissions.mutate();
      embedded.mutate();
    },
  };
}
