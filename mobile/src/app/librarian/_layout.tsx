import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CampusProvider, useCampus } from '@/features/campus/campus';
import { PortalAcademicProvider } from '@/features/portal/academic';
import { openPortalPage } from '@/features/portal/menu';
import { TourAssistant } from '@/features/setup-assistant/tour';

/** Librarian shell: own campus (the web always selects the librarian's assigned campus), the tour assistant. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

/** Academic year + quarter of the selected campus, chosen in the header like the web sidebar (AppSidebar). */
function CampusAcademic({ children }: { children: ReactNode }) {
  const { campusId } = useCampus();
  return <PortalAcademicProvider campusId={campusId ?? null}>{children}</PortalAcademicProvider>;
}

export default function LibrarianLayout() {
  return (
    <CampusProvider>
      <CampusAcademic>
        <View style={{ flex: 1 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="module" options={{ title: '' }} />
            <Stack.Screen name="issue" options={{ title: '' }} />
            <Stack.Screen name="return" options={{ title: '' }} />
            <Stack.Screen name="lost" options={{ title: '' }} />
            <Stack.Screen name="fines" options={{ title: '' }} />
            <Stack.Screen name="discipline/index" options={{ title: '' }} />
            <Stack.Screen name="discipline/new" options={{ title: '' }} />
            <Stack.Screen name="profile" options={{ title: '' }} />
            <Stack.Screen name="id-card" options={{ title: '' }} />
            <Stack.Screen name="agreement" options={{ title: '' }} />
            <Stack.Screen name="e-library/index" options={{ title: '' }} />
            <Stack.Screen name="e-library/[bookId]" options={{ title: '' }} />
            <Stack.Screen name="grievances/index" options={{ title: '' }} />
            <Stack.Screen name="grievances/submit" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="grievances/[id]" options={{ title: '' }} />
            <Stack.Screen name="qirtasi/worksheets" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report" options={{ title: '' }} />
            <Stack.Screen name="students/advanced-report-results" options={{ title: '' }} />
            <Stack.Screen name="library/book-form" options={{ title: '' }} />
            <Stack.Screen name="library/add-copies" options={{ title: '' }} />
            <Stack.Screen name="library/issue" options={{ title: '' }} />
            <Stack.Screen name="library/return" options={{ title: '' }} />
            <Stack.Screen name="library/lost" options={{ title: '' }} />
            <Stack.Screen name="library/quick-loan" options={{ title: '' }} />
            <Stack.Screen name="library/upload-document" options={{ title: '' }} />
            <Stack.Screen name="library/categories" options={{ title: '' }} />
            <Stack.Screen name="library/document-fields" options={{ title: '' }} />
            <Stack.Screen name="web" options={{ title: '' }} />
          </Stack>
          <TourAssistant onOpen={(href, title) => openPortalPage('librarian', { href, title })} />
        </View>
      </CampusAcademic>
    </CampusProvider>
  );
}
