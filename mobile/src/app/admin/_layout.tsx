import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CampusProvider, useCampus } from '@/features/campus/campus';
import { PortalAcademicProvider } from '@/features/portal/academic';
import { openAdminPage } from '@/features/admin/module-list';
import { TourAssistant } from '@/features/setup-assistant/tour';

/** School admin + staff shell. Every screen below reads the selected campus from CampusProvider. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

/** Academic year + quarter of the selected campus, chosen in the header like the web sidebar (AppSidebar). */
function CampusAcademic({ children }: { children: ReactNode }) {
  const { campusId } = useCampus();
  return <PortalAcademicProvider campusId={campusId ?? null}>{children}</PortalAcademicProvider>;
}

export default function AdminLayout() {
  return (
    <CampusProvider>
      <CampusAcademic>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="module" options={{ title: '' }} />
            <Stack.Screen name="students/index" options={{ title: '' }} />
            <Stack.Screen name="students/[id]" options={{ title: '' }} />
            <Stack.Screen name="students/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="employees/index" options={{ title: '' }} />
            <Stack.Screen name="employees/[id]" options={{ title: '' }} />
            <Stack.Screen name="employees/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="parents/index" options={{ title: '' }} />
            <Stack.Screen name="parents/[id]" options={{ title: '' }} />
            <Stack.Screen name="parents/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="parents/link" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="signups/links" options={{ title: '' }} />
            <Stack.Screen name="signups/link-form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="signups/pending" options={{ title: '' }} />
            <Stack.Screen name="fields/index" options={{ title: '' }} />
            <Stack.Screen name="fields/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="group-assign" options={{ title: '' }} />
            <Stack.Screen name="email" options={{ title: '' }} />
            <Stack.Screen name="print/student-info" options={{ title: '' }} />
            <Stack.Screen name="print/letters" options={{ title: '' }} />
            <Stack.Screen name="reports/student-breakdown" options={{ title: '' }} />
            <Stack.Screen name="reports/withdrawal" options={{ title: '' }} />
            <Stack.Screen name="email-log" options={{ title: '' }} />
            <Stack.Screen name="workload/index" options={{ title: '' }} />
            <Stack.Screen name="workload/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="import/people" options={{ title: '' }} />
            <Stack.Screen name="staff-settings" options={{ title: '' }} />
            <Stack.Screen name="email-notifications" options={{ title: '' }} />
            <Stack.Screen name="reports/advanced" options={{ title: '' }} />
            <Stack.Screen name="reports/advanced-results" options={{ title: '' }} />
            <Stack.Screen name="billing/fees" options={{ title: '' }} />
            <Stack.Screen name="settings/automatic-attendance" options={{ title: '' }} />
            <Stack.Screen name="settings/student-list-display" options={{ title: '' }} />
            <Stack.Screen name="settings/assignment-max-points" options={{ title: '' }} />
            <Stack.Screen name="settings/convert-names-titlecase" options={{ title: '' }} />
            <Stack.Screen name="settings/force-password-change" options={{ title: '' }} />
            <Stack.Screen name="settings/social-login" options={{ title: '' }} />
            <Stack.Screen name="settings/custom-menu" options={{ title: '' }} />
            <Stack.Screen name="settings/setup-assistant" options={{ title: '' }} />
            <Stack.Screen name="accounting/staff-payments" options={{ title: '' }} />
            <Stack.Screen name="billing/fee/[id]" options={{ title: '' }} />
            <Stack.Screen name="billing/fee/adjust" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="billing/student-overrides/[id]" options={{ title: '' }} />
            <Stack.Screen name="billing/payments" options={{ title: '' }} />
            <Stack.Screen name="billing/student/[id]" options={{ title: '' }} />
            <Stack.Screen name="billing/record" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="billing/balances" options={{ title: '' }} />
            <Stack.Screen name="billing/categories" options={{ title: '' }} />
            <Stack.Screen name="billing/structures/index" options={{ title: '' }} />
            <Stack.Screen name="billing/structures/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="billing/generate" options={{ title: '' }} />
            <Stack.Screen name="billing/overrides/index" options={{ title: '' }} />
            <Stack.Screen name="billing/settings" options={{ title: '' }} />
            <Stack.Screen name="billing/elements/index" options={{ title: '' }} />
            <Stack.Screen name="billing/elements/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="billing/student-charges" options={{ title: '' }} />
            <Stack.Screen name="billing/mass-assign" options={{ title: '' }} />
            <Stack.Screen name="billing/transactions" options={{ title: '' }} />
            <Stack.Screen name="billing/element-breakdown" options={{ title: '' }} />
            <Stack.Screen name="billing/print" options={{ title: '' }} />
            <Stack.Screen name="accounting/entries" options={{ title: '' }} />
            <Stack.Screen name="accounting/entry-form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="accounting/daily" options={{ title: '' }} />
            <Stack.Screen name="accounting/staff-balances" options={{ title: '' }} />
            <Stack.Screen name="accounting/rollup" options={{ title: '' }} />
            <Stack.Screen name="accounting/categories" options={{ title: '' }} />
            <Stack.Screen name="accounting/payees/index" options={{ title: '' }} />
            <Stack.Screen name="accounting/payees/[id]" options={{ title: '' }} />
            <Stack.Screen name="accounting/payees/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="accounting/teacher-hours/index" options={{ title: '' }} />
            <Stack.Screen name="accounting/teacher-hours/[id]" options={{ title: '' }} />
            <Stack.Screen name="salary/index" options={{ title: '' }} />
            <Stack.Screen name="salary/payslip" options={{ title: '' }} />
            <Stack.Screen name="salary/generate" options={{ title: '' }} />
            <Stack.Screen name="salary/advances" options={{ title: '' }} />
            <Stack.Screen name="salary/settings" options={{ title: '' }} />
            <Stack.Screen name="salary/statements" options={{ title: '' }} />
            <Stack.Screen name="salary/policy/form" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="salary/policy/[id]" options={{ title: '' }} />
            <Stack.Screen name="grades/student-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/teacher-completion" options={{ title: '' }} />
            <Stack.Screen name="grades/class-ranks" options={{ title: '' }} />
            <Stack.Screen name="grades/honor-roll" options={{ title: '' }} />
            <Stack.Screen name="grades/scales/index" options={{ title: '' }} />
            <Stack.Screen name="grades/scales/[id]" options={{ title: '' }} />
            <Stack.Screen name="grades/report-cards" options={{ title: '' }} />
            <Stack.Screen name="grades/transcripts" options={{ title: '' }} />
            <Stack.Screen name="grades/final-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/progress-reports" options={{ title: '' }} />
            <Stack.Screen name="grades/report-card-comments" options={{ title: '' }} />
            <Stack.Screen name="grades/configuration" options={{ title: '' }} />
            <Stack.Screen name="grades/gradebook-breakdown" options={{ title: '' }} />
            <Stack.Screen name="grades/graduation-paths/index" options={{ title: '' }} />
            <Stack.Screen name="grades/graduation-paths/[id]" options={{ title: '' }} />
            <Stack.Screen name="grades/mass-create-assignments" options={{ title: '' }} />
            <Stack.Screen name="grades/comment-codes" options={{ title: '' }} />
            <Stack.Screen name="grades/import-grades" options={{ title: '' }} />
            <Stack.Screen name="scheduling/dashboard" options={{ title: '' }} />
            <Stack.Screen name="scheduling/student-schedule" options={{ title: '' }} />
            <Stack.Screen name="scheduling/group-requests" options={{ title: '' }} />
            <Stack.Screen name="scheduling/add-drop-report" options={{ title: '' }} />
            <Stack.Screen name="scheduling/lesson-plans" options={{ title: '' }} />
            <Stack.Screen name="scheduling/lesson-plan-read" options={{ title: '' }} />
            <Stack.Screen name="scheduling/lesson-plan-add" options={{ title: '' }} />
            <Stack.Screen name="scheduling/courses" options={{ title: '' }} />
            <Stack.Screen name="scheduling/group-schedule" options={{ title: '' }} />
            <Stack.Screen name="scheduling/group-drops" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-schedules" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-class-pictures" options={{ title: '' }} />
            <Stack.Screen name="scheduling/schedule-report" options={{ title: '' }} />
            <Stack.Screen name="scheduling/requests-report" options={{ title: '' }} />
            <Stack.Screen name="scheduling/incomplete-schedules" options={{ title: '' }} />
            <Stack.Screen name="quiz/quizzes" options={{ title: '' }} />
            <Stack.Screen name="quiz/questions" options={{ title: '' }} />
            <Stack.Screen name="quiz/answer-breakdown" options={{ title: '' }} />
            <Stack.Screen name="quiz/configuration" options={{ title: '' }} />
            <Stack.Screen name="quiz/exam-builder" options={{ title: '' }} />
            <Stack.Screen name="online-classes/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/rooms/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/rooms/[id]" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/configuration" options={{ title: '' }} />
            <Stack.Screen name="activities/index" options={{ title: '' }} />
            <Stack.Screen name="scheduling/student-schedule-detail" options={{ title: '' }} />
            <Stack.Screen name="quiz/question-form" options={{ title: '' }} />
            <Stack.Screen name="quiz/quiz-form" options={{ title: '' }} />
            <Stack.Screen name="quiz/manage-questions" options={{ title: '' }} />
            <Stack.Screen name="quiz/ai-import" options={{ title: '' }} />
            <Stack.Screen name="grades/history-marking-periods" options={{ title: '' }} />
            <Stack.Screen name="grades/historical-grades/index" options={{ title: '' }} />
            <Stack.Screen name="grades/historical-grades/student" options={{ title: '' }} />
            <Stack.Screen name="activities/student" options={{ title: '' }} />
            <Stack.Screen name="activities/add-activity" options={{ title: '' }} />
            <Stack.Screen name="activities/enter-eligibility" options={{ title: '' }} />
            <Stack.Screen name="activities/reports/student-list" options={{ title: '' }} />
            <Stack.Screen name="activities/reports/teacher-completion" options={{ title: '' }} />
            <Stack.Screen name="activities/setup/activities" options={{ title: '' }} />
            <Stack.Screen name="activities/setup/entry-times" options={{ title: '' }} />
            <Stack.Screen name="attendance/index" options={{ title: '' }} />
            <Stack.Screen name="attendance/add-absences" options={{ title: '' }} />
            <Stack.Screen name="attendance/teacher-completion" options={{ title: '' }} />
            <Stack.Screen name="attendance/average-daily" options={{ title: '' }} />
            <Stack.Screen name="attendance/chart" options={{ title: '' }} />
            <Stack.Screen name="attendance/monthly-sheet" options={{ title: '' }} />
            <Stack.Screen name="attendance/recalculate" options={{ title: '' }} />
            <Stack.Screen name="attendance/delete-duplicates" options={{ title: '' }} />
            <Stack.Screen name="attendance/codes" options={{ title: '' }} />
            <Stack.Screen name="attendance/print-sheets" options={{ title: '' }} />
            <Stack.Screen name="attendance/take-missing" options={{ title: '' }} />
            <Stack.Screen name="staff-absences/index" options={{ title: '' }} />
            <Stack.Screen name="staff-absences/form" options={{ title: '' }} />
            <Stack.Screen name="staff-absences/cancelled-classes" options={{ title: '' }} />
            <Stack.Screen name="staff-absences/breakdown" options={{ title: '' }} />
            <Stack.Screen name="staff-absences/fields" options={{ title: '' }} />
            <Stack.Screen name="teacher-programs/attendance" options={{ title: '' }} />
            <Stack.Screen name="teacher-programs/final-grades" options={{ title: '' }} />
            <Stack.Screen name="teacher-programs/gradebook" options={{ title: '' }} />
            <Stack.Screen name="teacher-programs/anomalous-grades" options={{ title: '' }} />
            <Stack.Screen name="discipline/index" options={{ title: '' }} />
            <Stack.Screen name="discipline/add-referral" options={{ title: '' }} />
            <Stack.Screen name="discipline/referral-form" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/category-breakdown" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/category-breakdown-time" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/breakdown-student-field" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/log" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/index" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/add-records" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/report" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/checkpoints" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/evening-leaves" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/mass-evening-leaves" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/packages" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/automatic-records" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/exceptions" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/add-exceptions" options={{ title: '' }} />
            <Stack.Screen name="entry-exit/take-attendance" options={{ title: '' }} />
            <Stack.Screen name="miqat/index" options={{ title: '' }} />
            <Stack.Screen name="miqat/devices" options={{ title: '' }} />
            <Stack.Screen name="miqat/cards" options={{ title: '' }} />
            <Stack.Screen name="miqat/permissions" options={{ title: '' }} />
            <Stack.Screen name="miqat/reports" options={{ title: '' }} />
            <Stack.Screen name="miqat/settings" options={{ title: '' }} />
            <Stack.Screen name="grievances/index" options={{ title: '' }} />
            <Stack.Screen name="grievances/[id]" options={{ title: '' }} />
            <Stack.Screen name="grievances/submit" options={{ title: '' }} />
            <Stack.Screen name="grievances/dashboard" options={{ title: '' }} />
            <Stack.Screen name="grievances/reports" options={{ title: '' }} />
            <Stack.Screen name="grievances/categories" options={{ title: '' }} />
            <Stack.Screen name="grievances/settings" options={{ title: '' }} />
            <Stack.Screen name="inspections/index" options={{ title: '' }} />
            <Stack.Screen name="inspections/assignments" options={{ title: '' }} />
            <Stack.Screen name="inspections/visits" options={{ title: '' }} />
            <Stack.Screen name="inspections/rubrics" options={{ title: '' }} />
            <Stack.Screen name="inspections/training" options={{ title: '' }} />
            <Stack.Screen name="inspections/reports" options={{ title: '' }} />
            <Stack.Screen name="inspections/report/[id]" options={{ title: '' }} />
            <Stack.Screen name="inspections/appeals" options={{ title: '' }} />
            <Stack.Screen name="inspections/appeal/[id]" options={{ title: '' }} />
            <Stack.Screen name="performance/index" options={{ title: '' }} />
            <Stack.Screen name="performance/catalog" options={{ title: '' }} />
            <Stack.Screen name="performance/reports/category-breakdown" options={{ title: '' }} />
            <Stack.Screen name="performance/reports/category-breakdown-time" options={{ title: '' }} />
            <Stack.Screen name="performance/reports/breakdown-staff-field" options={{ title: '' }} />
            <Stack.Screen name="performance/reports/log" options={{ title: '' }} />
            {/* Wave 5: school */}
            <Stack.Screen name="academics/index" options={{ title: '' }} />
            <Stack.Screen name="academics/grades" options={{ title: '' }} />
            <Stack.Screen name="academics/sections" options={{ title: '' }} />
            <Stack.Screen name="academics/subjects" options={{ title: '' }} />
            <Stack.Screen name="periods/index" options={{ title: '' }} />
            <Stack.Screen name="periods/[name]" options={{ title: '' }} />
            <Stack.Screen name="marking-periods/index" options={{ title: '' }} />
            <Stack.Screen name="marking-periods/calendar" options={{ title: '' }} />
            <Stack.Screen name="events/index" options={{ title: '' }} />
            <Stack.Screen name="events/list" options={{ title: '' }} />
            <Stack.Screen name="events/form" options={{ title: '' }} />
            <Stack.Screen name="events/[id]" options={{ title: '' }} />
            <Stack.Screen name="events/import" options={{ title: '' }} />
            <Stack.Screen name="events/calendar-form" options={{ title: '' }} />
            <Stack.Screen name="timetable/index" options={{ title: '' }} />
            <Stack.Screen name="timetable/import" options={{ title: '' }} />
            <Stack.Screen name="timetable/rooms" options={{ title: '' }} />
            <Stack.Screen name="timetable/requirements" options={{ title: '' }} />
            <Stack.Screen name="timetable/settings" options={{ title: '' }} />
            <Stack.Screen name="timetable/generate" options={{ title: '' }} />
            <Stack.Screen name="portal/notes" options={{ title: '' }} />
            <Stack.Screen name="portal/polls" options={{ title: '' }} />
            <Stack.Screen name="rollover/index" options={{ title: '' }} />
            <Stack.Screen name="rollover/semester" options={{ title: '' }} />
            <Stack.Screen name="settings/plugins" options={{ title: '' }} />
            <Stack.Screen name="settings/marking-period-groups" options={{ title: '' }} />
            <Stack.Screen name="settings/academic-years" options={{ title: '' }} />
            <Stack.Screen name="school-details" options={{ title: '' }} />
            <Stack.Screen name="reports/calculations" options={{ title: '' }} />
            <Stack.Screen name="reports/calculation-reports" options={{ title: '' }} />
            <Stack.Screen name="training/index" options={{ title: '' }} />
            <Stack.Screen name="training/form" options={{ title: '' }} />
            <Stack.Screen name="training/[id]" options={{ title: '' }} />
            <Stack.Screen name="messaging/index" options={{ title: '' }} />
            <Stack.Screen name="messaging/write" options={{ title: '' }} />
            <Stack.Screen name="settings/teacher-messaging" options={{ title: '' }} />
            <Stack.Screen name="weather-alerts/dashboard" options={{ title: '' }} />
            <Stack.Screen name="weather-alerts/settings" options={{ title: '' }} />
            <Stack.Screen name="settings/index" options={{ title: '' }} />
            <Stack.Screen name="settings/campuses" options={{ title: '' }} />
            <Stack.Screen name="settings/campus-form" options={{ title: '' }} />
            <Stack.Screen name="settings/copy-settings" options={{ title: '' }} />
            <Stack.Screen name="settings/sidebar-theme" options={{ title: '' }} />
            <Stack.Screen name="settings/services" options={{ title: '' }} />
            <Stack.Screen name="settings/service-form" options={{ title: '' }} />
            <Stack.Screen name="settings/user-agreements" options={{ title: '' }} />
            <Stack.Screen name="settings/user-profiles/index" options={{ title: '' }} />
            <Stack.Screen name="settings/user-profiles/[id]" options={{ title: '' }} />
            <Stack.Screen name="settings/push-notifications" options={{ title: '' }} />
            <Stack.Screen name="settings/email-reminders" options={{ title: '' }} />
            <Stack.Screen name="settings/email-smtp" options={{ title: '' }} />
            <Stack.Screen name="settings/pdf-header-footer" options={{ title: '' }} />
            <Stack.Screen name="settings/public-pages" options={{ title: '' }} />
            <Stack.Screen name="settings/two-factor-auth" options={{ title: '' }} />
            <Stack.Screen name="profile" options={{ title: '' }} />
            <Stack.Screen name="hostel/index" options={{ title: '' }} />
            <Stack.Screen name="hostel/buildings" options={{ title: '' }} />
            <Stack.Screen name="hostel/building-form" options={{ title: '' }} />
            <Stack.Screen name="hostel/rooms" options={{ title: '' }} />
            <Stack.Screen name="hostel/room-form" options={{ title: '' }} />
            <Stack.Screen name="hostel/assignments" options={{ title: '' }} />
            <Stack.Screen name="hostel/visits" options={{ title: '' }} />
            <Stack.Screen name="hostel/fees" options={{ title: '' }} />
            <Stack.Screen name="hostel/fields" options={{ title: '' }} />
            <Stack.Screen name="hostel/settings" options={{ title: '' }} />
            <Stack.Screen name="library/index" options={{ title: '' }} />
            <Stack.Screen name="library/books" options={{ title: '' }} />
            <Stack.Screen name="library/book-form" options={{ title: '' }} />
            <Stack.Screen name="library/add-copies" options={{ title: '' }} />
            <Stack.Screen name="library/issue" options={{ title: '' }} />
            <Stack.Screen name="library/return" options={{ title: '' }} />
            <Stack.Screen name="library/lost" options={{ title: '' }} />
            <Stack.Screen name="library/quick-loan" options={{ title: '' }} />
            <Stack.Screen name="library/upload-document" options={{ title: '' }} />
            <Stack.Screen name="library/loans" options={{ title: '' }} />
            <Stack.Screen name="library/fines" options={{ title: '' }} />
            <Stack.Screen name="library/e-library/index" options={{ title: '' }} />
            <Stack.Screen name="library/e-library/[bookId]" options={{ title: '' }} />
            <Stack.Screen name="library/categories" options={{ title: '' }} />
            <Stack.Screen name="library/document-fields" options={{ title: '' }} />
            <Stack.Screen name="textbooks/index" options={{ title: '' }} />
            <Stack.Screen name="textbooks/matrix" options={{ title: '' }} />
            <Stack.Screen name="textbooks/dashboard" options={{ title: '' }} />
            <Stack.Screen name="textbooks/return-mode" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/worksheets" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/worksheet-form" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/curriculum" options={{ title: '' }} />
            <Stack.Screen name="tools/[tool]" options={{ title: '' }} />
            <Stack.Screen name="resources/links" options={{ title: '' }} />
            <Stack.Screen name="resources/dashboards/index" options={{ title: '' }} />
            <Stack.Screen name="resources/dashboards/[id]" options={{ title: '' }} />
            <Stack.Screen name="resources/dashboards/configure" options={{ title: '' }} />
            <Stack.Screen name="resources/school-inventory/index" options={{ title: '' }} />
            <Stack.Screen name="resources/school-inventory/items" options={{ title: '' }} />
            <Stack.Screen name="resources/inventory-snapshots" options={{ title: '' }} />
            <Stack.Screen name="physics-labs" options={{ title: '' }} />
            <Stack.Screen name="resources/embedded" options={{ title: '' }} />
            <Stack.Screen name="vault" options={{ title: '' }} />
            <Stack.Screen name="hifzi/index" options={{ title: '' }} />
            <Stack.Screen name="hifzi/circles" options={{ title: '' }} />
            <Stack.Screen name="hifzi/students" options={{ title: '' }} />
            <Stack.Screen name="hifzi/curriculum" options={{ title: '' }} />
            <Stack.Screen name="hifzi/quran" options={{ title: '' }} />
            <Stack.Screen name="hifzi/gradebook" options={{ title: '' }} />
            <Stack.Screen name="hifzi/compliance" options={{ title: '' }} />
            <Stack.Screen name="hifzi/plans" options={{ title: '' }} />
            <Stack.Screen name="hifzi/attendance" options={{ title: '' }} />
            <Stack.Screen name="hifzi/reports" options={{ title: '' }} />
            <Stack.Screen name="hifzi/settings" options={{ title: '' }} />
            <Stack.Screen name="fina/wall" options={{ title: '' }} />
            <Stack.Screen name="fina/compose" options={{ title: '' }} />
            <Stack.Screen name="fina/media/index" options={{ title: '' }} />
            <Stack.Screen name="fina/media/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/albums/index" options={{ title: '' }} />
            <Stack.Screen name="fina/albums/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/approvals" options={{ title: '' }} />
            <Stack.Screen name="fina/groups" options={{ title: '' }} />
            <Stack.Screen name="fina/events" options={{ title: '' }} />
            <Stack.Screen name="fina/threads/index" options={{ title: '' }} />
            <Stack.Screen name="fina/threads/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/notifications" options={{ title: '' }} />
            <Stack.Screen name="fina/audit" options={{ title: '' }} />
            <Stack.Screen name="fina/reports" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/index" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/texts/index" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/texts/form" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/sessions/index" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/sessions/[id]" options={{ title: '' }} />
            <Stack.Screen name="resources/hadith-forty/index" options={{ title: '' }} />
            <Stack.Screen name="resources/hadith-forty/class" options={{ title: '' }} />
          </Stack>
          <TourAssistant onOpen={(href, title) => openAdminPage({ href, title })} />
        </View>
      </CampusAcademic>
    </CampusProvider>
  );
}
