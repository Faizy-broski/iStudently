import { Stack } from 'expo-router';
import { View } from 'react-native';

import { CampusProvider } from '@/features/campus/campus';
import { openPortalPage } from '@/features/portal/menu';
import { TourAssistant } from '@/features/setup-assistant/tour';
import { PortalAcademicProvider } from '@/features/portal/academic';

/** Student shell: the student's own campus (locked) and the sidebar's academic year + quarter. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function StudentLayout() {
  return (
    <CampusProvider>
      <PortalAcademicProvider>
        <View style={{ flex: 1 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="module" options={{ title: '' }} />
            <Stack.Screen name="fina/notifications" options={{ title: '' }} />
            <Stack.Screen name="timetable" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/index" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/[textId]" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/history/index" options={{ title: '' }} />
            <Stack.Screen name="speed-reading/history/[id]" options={{ title: '' }} />
            <Stack.Screen name="profile" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report-results" options={{ title: '' }} />
            <Stack.Screen name="agreement" options={{ title: '' }} />
            <Stack.Screen name="fina/wall" options={{ title: '' }} />
            <Stack.Screen name="fina/groups" options={{ title: '' }} />
            <Stack.Screen name="fina/events" options={{ title: '' }} />
            <Stack.Screen name="hifzi/index" options={{ title: '' }} />
            <Stack.Screen name="hifzi/quran" options={{ title: '' }} />
            <Stack.Screen name="online-classes/index" options={{ title: '' }} />
            <Stack.Screen name="online-classes/enrolled" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/index" options={{ title: '' }} />
            <Stack.Screen name="jitsi-meet/rooms/[id]" options={{ title: '' }} />
            <Stack.Screen name="resources/index" options={{ title: '' }} />
            <Stack.Screen name="learning-resources" options={{ title: '' }} />
            <Stack.Screen name="syllabus" options={{ title: '' }} />
            <Stack.Screen name="materials" options={{ title: '' }} />
            <Stack.Screen name="resources/embedded/index" options={{ title: '' }} />
            <Stack.Screen name="resources/embedded/[id]" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/worksheets" options={{ title: '' }} />
            <Stack.Screen name="resources/hadith-forty" options={{ title: '' }} />
            <Stack.Screen name="resources/physics-labs/index" options={{ title: '' }} />
            <Stack.Screen name="resources/physics-labs/[id]" options={{ title: '' }} />
            <Stack.Screen name="tools/[tool]" options={{ title: '' }} />
            <Stack.Screen name="hostel" options={{ title: '' }} />
            <Stack.Screen name="library" options={{ title: '' }} />
            <Stack.Screen name="e-library/index" options={{ title: '' }} />
            <Stack.Screen name="e-library/[bookId]" options={{ title: '' }} />
            <Stack.Screen name="billing/fees" options={{ title: '' }} />
            <Stack.Screen name="billing/timeline" options={{ title: '' }} />
            <Stack.Screen name="billing/payments" options={{ title: '' }} />
            <Stack.Screen name="billing/daily-transactions" options={{ title: '' }} />
            <Stack.Screen name="billing/print-statements" options={{ title: '' }} />
            <Stack.Screen name="discipline" options={{ title: '' }} />
            <Stack.Screen name="activities" options={{ title: '' }} />
            <Stack.Screen name="attendance" options={{ title: '' }} />
            <Stack.Screen name="grades/final-grades" options={{ title: '' }} />
            <Stack.Screen name="grades/report-cards" options={{ title: '' }} />
            <Stack.Screen name="grades/progress-reports" options={{ title: '' }} />
            <Stack.Screen name="grades/transcripts" options={{ title: '' }} />
            <Stack.Screen name="grades/gpa-rank-list" options={{ title: '' }} />
            <Stack.Screen name="quizzes/index" options={{ title: '' }} />
            <Stack.Screen name="quizzes/[id]" options={{ title: '' }} />
            <Stack.Screen name="web" options={{ title: '' }} />
            <Stack.Screen name="grades/student-grades" options={{ title: '' }} />
            <Stack.Screen name="assignments/index" options={{ title: '' }} />
            <Stack.Screen name="assignments/[id]" options={{ title: '' }} />
            <Stack.Screen name="scheduling/schedule" options={{ title: '' }} />
            <Stack.Screen name="scheduling/student-requests" options={{ title: '' }} />
            <Stack.Screen name="scheduling/courses" options={{ title: '' }} />
            <Stack.Screen name="scheduling/lesson-plan-read" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-schedules" options={{ title: '' }} />
            <Stack.Screen name="scheduling/print-class-pictures" options={{ title: '' }} />
            <Stack.Screen name="school-information" options={{ title: '' }} />
            <Stack.Screen name="events" options={{ title: '' }} />
            <Stack.Screen name="marking-periods" options={{ title: '' }} />
            <Stack.Screen name="portal/notes" options={{ title: '' }} />
            <Stack.Screen name="portal/polls" options={{ title: '' }} />
            <Stack.Screen name="students" options={{ title: '' }} />
            <Stack.Screen name="messaging/index" options={{ title: '' }} />
            <Stack.Screen name="messaging/write" options={{ title: '' }} />
            <Stack.Screen name="grievances/index" options={{ title: '' }} />
            <Stack.Screen name="grievances/[id]" options={{ title: '' }} />
            <Stack.Screen name="grievances/submit" options={{ title: '', presentation: 'modal' }} />
          </Stack>
          <TourAssistant onOpen={(href, title) => openPortalPage('student', { href, title })} />
        </View>
      </PortalAcademicProvider>
    </CampusProvider>
  );
}
