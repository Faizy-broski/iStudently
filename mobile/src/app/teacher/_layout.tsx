import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CampusProvider, useCampus } from '@/features/campus/campus';
import { PortalAcademicProvider } from '@/features/portal/academic';
import { openPortalPage } from '@/features/portal/menu';
import { TourAssistant } from '@/features/setup-assistant/tour';

/** Year + quarter of the teacher's own campus (web: teacher sidebar). */
function CampusAcademic({ children }: { children: ReactNode }) {
  const { campusId } = useCampus();
  return <PortalAcademicProvider campusId={campusId ?? null}>{children}</PortalAcademicProvider>;
}

/** Teacher shell: own campus (locked, as on the web), year + quarter, the tour assistant. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function TeacherLayout() {
  return (
    <CampusProvider>
      <CampusAcademic>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="module" options={{ title: '' }} />
            <Stack.Screen name="grades/import-grades" options={{ title: '' }} />
            <Stack.Screen name="settings" options={{ title: '' }} />
            <Stack.Screen name="reading-logs" options={{ title: '' }} />
            <Stack.Screen name="school-pages" options={{ title: '' }} />
            <Stack.Screen name="inspections/index" options={{ title: '' }} />
            <Stack.Screen name="inspections/[visitId]" options={{ title: '' }} />
            <Stack.Screen name="inspections/training" options={{ title: '' }} />
            <Stack.Screen name="inspections/reports/index" options={{ title: '' }} />
            <Stack.Screen name="inspections/reports/[id]" options={{ title: '' }} />
            <Stack.Screen name="inspections/appeals/index" options={{ title: '' }} />
            <Stack.Screen name="inspections/appeals/[id]" options={{ title: '' }} />
            <Stack.Screen name="inspections/community/index" options={{ title: '' }} />
            <Stack.Screen name="inspections/community/[threadId]" options={{ title: '' }} />
            <Stack.Screen name="reports" options={{ title: '' }} />
            <Stack.Screen name="learning-resources/index" options={{ title: '' }} />
            <Stack.Screen name="learning-resources/edit" options={{ title: '' }} />
            <Stack.Screen name="online-classes" options={{ title: '' }} />
            <Stack.Screen name="quiz" options={{ title: '' }} />
            <Stack.Screen name="exams/index" options={{ title: '' }} />
            <Stack.Screen name="exams/create" options={{ title: '' }} />
            <Stack.Screen name="exams/[id]" options={{ title: '' }} />
            <Stack.Screen name="assignments/index" options={{ title: '' }} />
            <Stack.Screen name="assignments/create" options={{ title: '' }} />
            <Stack.Screen name="assignments/[id]" options={{ title: '' }} />
            <Stack.Screen name="submissions" options={{ title: '' }} />
            <Stack.Screen name="timetable" options={{ title: '' }} />
            <Stack.Screen name="subjects" options={{ title: '' }} />
            <Stack.Screen name="class-diary" options={{ title: '' }} />
            <Stack.Screen name="hifzi/index" options={{ title: '' }} />
            <Stack.Screen name="hifzi/recite/index" options={{ title: '' }} />
            <Stack.Screen name="hifzi/recite/[circleId]" options={{ title: '' }} />
            <Stack.Screen name="hifzi/attendance" options={{ title: '' }} />
            <Stack.Screen name="hifzi/plans" options={{ title: '' }} />
            <Stack.Screen name="performance" options={{ title: '' }} />
            <Stack.Screen name="accounting/salaries" options={{ title: '' }} />
            <Stack.Screen name="accounting/staff-payments" options={{ title: '' }} />
            <Stack.Screen name="accounting/print-statements" options={{ title: '' }} />
            <Stack.Screen name="activities/eligibility" options={{ title: '' }} />
            <Stack.Screen name="students/print-letters" options={{ title: '' }} />
            <Stack.Screen name="students/student-labels" options={{ title: '' }} />
            <Stack.Screen name="students/associated-parents" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report-results" options={{ title: '' }} />
            <Stack.Screen name="students/index" options={{ title: '' }} />
            <Stack.Screen name="students/[studentId]" options={{ title: '' }} />
            <Stack.Screen name="attendance/daily-summary" options={{ title: '' }} />
            <Stack.Screen name="attendance/index" options={{ title: '' }} />
            <Stack.Screen name="attendance/take-attendance" options={{ title: '' }} />
            <Stack.Screen name="grades/assignments" options={{ title: '' }} />
            <Stack.Screen name="grades/configuration" options={{ title: '' }} />
            <Stack.Screen name="grades/grading-scales" options={{ title: '' }} />
            <Stack.Screen name="grades/report-card-comments" options={{ title: '' }} />
            <Stack.Screen name="grades/comment-codes" options={{ title: '' }} />
            <Stack.Screen name="grades/gradebook" options={{ title: '' }} />
            <Stack.Screen name="grades/input-final-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/anomalous-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/report-cards" options={{ title: '' }} />
            <Stack.Screen name="grades/progress-reports" options={{ title: '' }} />
            <Stack.Screen name="grades/gradebook-breakdown" options={{ title: '' }} />
            <Stack.Screen name="grades/final-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/student-grades" options={{ title: '' }} />
            <Stack.Screen name="exams/builder" options={{ title: '' }} />
            <Stack.Screen name="lesson-plans" options={{ title: '' }} />
            <Stack.Screen name="lesson-plan-read" options={{ title: '' }} />
            <Stack.Screen name="discipline/add-referral" options={{ title: '' }} />
            <Stack.Screen name="discipline/referrals" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/category-breakdown" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/category-breakdown-time" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/breakdown-student-field" options={{ title: '' }} />
            <Stack.Screen name="discipline/reports/log" options={{ title: '' }} />
            <Stack.Screen name="messaging/index" options={{ title: '' }} />
            <Stack.Screen name="messaging/write" options={{ title: '' }} />
            <Stack.Screen name="grievances/index" options={{ title: '' }} />
            <Stack.Screen name="grievances/[id]" options={{ title: '' }} />
            <Stack.Screen name="grievances/submit" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="hifzi/quran" options={{ title: '' }} />
            <Stack.Screen name="resources/hadith-forty/index" options={{ title: '' }} />
            <Stack.Screen name="resources/hadith-forty/class" options={{ title: '' }} />
            <Stack.Screen name="resources/embedded/index" options={{ title: '' }} />
            <Stack.Screen name="resources/embedded/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/wall" options={{ title: '' }} />
            <Stack.Screen name="fina/compose" options={{ title: '' }} />
            <Stack.Screen name="fina/my-posts" options={{ title: '' }} />
            <Stack.Screen name="fina/media/index" options={{ title: '' }} />
            <Stack.Screen name="fina/media/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/albums/index" options={{ title: '' }} />
            <Stack.Screen name="fina/albums/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/groups" options={{ title: '' }} />
            <Stack.Screen name="fina/events" options={{ title: '' }} />
            <Stack.Screen name="fina/threads/index" options={{ title: '' }} />
            <Stack.Screen name="fina/threads/[id]" options={{ title: '' }} />
            <Stack.Screen name="fina/notifications" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/worksheets" options={{ title: '' }} />
            <Stack.Screen name="agreement" options={{ title: '' }} />
            <Stack.Screen name="resources/index" options={{ title: '' }} />
            <Stack.Screen name="portal/notes" options={{ title: '' }} />
            <Stack.Screen name="portal/polls" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/rooms/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/rooms/[id]" options={{ title: '' }} />
            <Stack.Screen name="school-information" options={{ title: '' }} />
            <Stack.Screen name="marking-periods" options={{ title: '' }} />
            <Stack.Screen name="periods" options={{ title: '' }} />
            <Stack.Screen name="events/index" options={{ title: '' }} />
            <Stack.Screen name="events/[id]" options={{ title: '' }} />
            <Stack.Screen name="id-card" options={{ title: '' }} />
            <Stack.Screen name="scheduling/schedule" options={{ title: '' }} />
            <Stack.Screen name="scheduling/student-schedule-detail" options={{ title: '' }} />
            <Stack.Screen name="scheduling/courses" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-schedules" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-class-pictures" options={{ title: '' }} />
            <Stack.Screen name="tools/[tool]" options={{ title: '' }} />
            <Stack.Screen name="web" options={{ title: '' }} />
          </Stack>
          <TourAssistant onOpen={(href, title) => openPortalPage('teacher', { href, title })} />
        </View>
      </CampusAcademic>
    </CampusProvider>
  );
}
