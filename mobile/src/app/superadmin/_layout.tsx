import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session';
import { loadDateFormat } from '@/features/superadmin/date-format';
import { setDatePattern } from '@/lib/format';

// Super admin: a tab bar, with detail screens (school, plan, record…) pushed over it.
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function SuperadminLayout() {
  const { me } = useSession();
  const userId = me.status === 'ready' ? me.me.profile.id : null;
  // Apply the saved date format before the first screen renders; clear it when leaving the super admin shell.
  useState(() => setDatePattern(loadDateFormat(userId)));
  useEffect(() => {
    setDatePattern(loadDateFormat(userId));
    return () => setDatePattern(null);
  }, [userId]);
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="school/[id]" options={{ title: '' }} />
      <Stack.Screen name="school/modules" options={{ title: '' }} />
      <Stack.Screen name="school/edit" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="school/fields" options={{ title: '' }} />
      <Stack.Screen name="school/field-form" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="school/copy-settings" options={{ title: '' }} />
      <Stack.Screen name="billing/record/[id]" options={{ title: '' }} />
      <Stack.Screen name="billing/record-form" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="billing/plan-form" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="inbox/feedback/[id]" options={{ title: '' }} />
      <Stack.Screen name="inbox/quote-form" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="onboard" options={{ title: '' }} />
      <Stack.Screen name="settings" options={{ title: '' }} />
      <Stack.Screen name="login-page" options={{ title: '' }} />
      <Stack.Screen name="public-pages/index" options={{ title: '' }} />
      <Stack.Screen name="sidebar" options={{ title: '' }} />
      <Stack.Screen name="public-pages/form" options={{ title: '', presentation: 'modal' }} />
    </Stack>
  );
}
