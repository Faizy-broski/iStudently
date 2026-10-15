import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CampusProvider } from '@/features/campus/campus';
import { ParentChildProvider, useChild } from '@/features/parent/child';
import { PortalAcademicProvider } from '@/features/portal/academic';
import { openPortalPage } from '@/features/portal/menu';
import { TourAssistant } from '@/features/setup-assistant/tour';

/** Marking periods follow the selected child's campus (web: parent sidebar). */
function ChildAcademic({ children }: { children: ReactNode }) {
  const { child } = useChild();
  return <PortalAcademicProvider campusId={child?.campus_id ?? null}>{children}</PortalAcademicProvider>;
}

/** Parent shell: linked children with a switcher, the child's year + quarter. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function ParentLayout() {
  return (
    <CampusProvider>
      <ParentChildProvider>
        <ChildAcademic>
          <View style={{ flex: 1 }}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="module" options={{ title: '' }} />
              <Stack.Screen name="academic-overview" options={{ title: '' }} />
              <Stack.Screen name="homework" options={{ title: '' }} />
              <Stack.Screen name="settings" options={{ title: '' }} />
              <Stack.Screen name="miqat" options={{ title: '' }} />
              <Stack.Screen name="timetable" options={{ title: '' }} />
              <Stack.Screen name="hifzi/index" options={{ title: '' }} />
              <Stack.Screen name="discipline" options={{ title: '' }} />
              <Stack.Screen name="activities" options={{ title: '' }} />
              <Stack.Screen name="class-diary" options={{ title: '' }} />
              <Stack.Screen name="attendance" options={{ title: '' }} />
              <Stack.Screen name="grades/final-grades" options={{ title: '' }} />
              <Stack.Screen name="grades/report-cards" options={{ title: '' }} />
              <Stack.Screen name="grades/progress-reports" options={{ title: '' }} />
              <Stack.Screen name="grades/transcripts" options={{ title: '' }} />
              <Stack.Screen name="grades/gpa-rank-list" options={{ title: '' }} />
              <Stack.Screen name="grades/student-grades" options={{ title: '' }} />
              <Stack.Screen name="grades/student-assignments/index" options={{ title: '' }} />
              <Stack.Screen name="grades/student-assignments/[id]" options={{ title: '' }} />
              <Stack.Screen name="scheduling/schedule" options={{ title: '' }} />
              <Stack.Screen name="scheduling/student-requests" options={{ title: '' }} />
              <Stack.Screen name="scheduling/courses" options={{ title: '' }} />
              <Stack.Screen name="scheduling/lesson-plan-read" options={{ title: '' }} />
              <Stack.Screen name="scheduling/print-schedules" options={{ title: '' }} />
              <Stack.Screen name="scheduling/print-class-pictures" options={{ title: '' }} />
              <Stack.Screen name="fees" options={{ title: '' }} />
              <Stack.Screen name="billing/fees" options={{ title: '' }} />
              <Stack.Screen name="billing/timeline" options={{ title: '' }} />
              <Stack.Screen name="billing/payments" options={{ title: '' }} />
              <Stack.Screen name="billing/daily-transactions" options={{ title: '' }} />
              <Stack.Screen name="billing/print-statements" options={{ title: '' }} />
              <Stack.Screen name="students/advanced-report" options={{ title: '' }} />
              <Stack.Screen name="students/advanced-report-results" options={{ title: '' }} />
              <Stack.Screen name="students/index" options={{ title: '' }} />
              <Stack.Screen name="students/[studentId]" options={{ title: '' }} />
              <Stack.Screen name="school-information" options={{ title: '' }} />
              <Stack.Screen name="marking-periods" options={{ title: '' }} />
              <Stack.Screen name="events/index" options={{ title: '' }} />
              <Stack.Screen name="events/[id]" options={{ title: '' }} />
              <Stack.Screen name="id-card" options={{ title: '' }} />
              <Stack.Screen name="messaging/index" options={{ title: '' }} />
              <Stack.Screen name="messaging/write" options={{ title: '' }} />
              <Stack.Screen name="grievances/index" options={{ title: '' }} />
              <Stack.Screen name="grievances/[id]" options={{ title: '' }} />
              <Stack.Screen name="grievances/submit" options={{ title: '', presentation: 'modal' }} />
              <Stack.Screen name="portal/notes" options={{ title: '' }} />
              <Stack.Screen name="portal/polls" options={{ title: '' }} />
              <Stack.Screen name="jitsi-meet/index" options={{ title: '' }} />
              <Stack.Screen name="jitsi-meet/rooms/[id]" options={{ title: '' }} />
              <Stack.Screen name="hifzi/quran" options={{ title: '' }} />
              <Stack.Screen name="resources/hadith-forty" options={{ title: '' }} />
              <Stack.Screen name="qirtasi/worksheets" options={{ title: '' }} />
              <Stack.Screen name="resources/embedded/index" options={{ title: '' }} />
              <Stack.Screen name="resources/embedded/[id]" options={{ title: '' }} />
              <Stack.Screen name="tools/[tool]" options={{ title: '' }} />
              <Stack.Screen name="web" options={{ title: '' }} />
              <Stack.Screen name="fina/wall" options={{ title: '' }} />
              <Stack.Screen name="fina/groups" options={{ title: '' }} />
              <Stack.Screen name="fina/events" options={{ title: '' }} />
              <Stack.Screen name="fina/albums/index" options={{ title: '' }} />
              <Stack.Screen name="fina/albums/[id]" options={{ title: '' }} />
              <Stack.Screen name="fina/threads/index" options={{ title: '' }} />
              <Stack.Screen name="fina/threads/[id]" options={{ title: '' }} />
              <Stack.Screen name="fina/notifications" options={{ title: '' }} />
              <Stack.Screen name="fina/consent" options={{ title: '' }} />
              <Stack.Screen name="agreement" options={{ title: '' }} />
              <Stack.Screen name="resources/index" options={{ title: '' }} />
            </Stack>
            <TourAssistant onOpen={(href, title) => openPortalPage('parent', { href, title })} />
          </View>
        </ChildAcademic>
      </ParentChildProvider>
    </CampusProvider>
  );
}
