import { Stack } from 'expo-router';

/** Fina supervisor shell (web: /fina-supervisor): a whole municipality, so no campus switcher. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function FinaSupervisorLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
