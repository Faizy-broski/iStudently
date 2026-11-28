import { Stack } from 'expo-router';

import { CampusProvider } from '@/features/campus/campus';

/** Media officer shell (web: /media-officer): Al-Fina' first review, scoped to the officer's own campus. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function MediaOfficerLayout() {
  return (
    <CampusProvider>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </CampusProvider>
  );
}
