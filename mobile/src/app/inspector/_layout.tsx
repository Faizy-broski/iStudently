import { Stack } from 'expo-router';

/** Inspector shell: not tied to one campus (visits span the campuses assigned to the inspector). */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function InspectorLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="visits/new" options={{ title: '' }} />
      <Stack.Screen name="visits/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="visits/[id]/observe" options={{ title: '' }} />
      <Stack.Screen name="visits/[id]/coaching" options={{ title: '' }} />
      <Stack.Screen name="visits/[id]/report" options={{ title: '' }} />
      <Stack.Screen name="reports/index" options={{ title: '' }} />
      <Stack.Screen name="reports/[id]" options={{ title: '' }} />
      <Stack.Screen name="community/[threadId]" options={{ title: '' }} />
      <Stack.Screen name="teachers/[teacherId]" options={{ title: '' }} />
      <Stack.Screen name="hifzi-compliance" options={{ title: '' }} />
    </Stack>
  );
}
