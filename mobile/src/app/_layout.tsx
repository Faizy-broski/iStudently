import '@/global.css';
import '@/i18n';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ConfirmProvider } from '@/components/app/confirm';
import { OfflineBanner } from '@/components/app/offline-banner';
import { ToastProvider } from '@/components/app/toast';
import { AppConfigGate } from '@/features/app-config/app-config';
import { AppLockProvider } from '@/features/auth/app-lock';
import { otherRolesOpen } from '@/features/auth/release';
import { SessionProvider, useSession } from '@/features/auth/session';
import { registerCaptureMenu, setCaptureRoot, setCaptureRoute } from '@/features/dev/full-page-capture';
import { DataProvider } from '@/lib/data';
import { installGlobalErrorHandler } from '@/lib/monitoring';
import { NAV_THEME } from '@/lib/theme';
import { applySavedThemePreference } from '@/lib/theme-preference';

installGlobalErrorHandler();
registerCaptureMenu();
SplashScreen.preventAutoHideAsync();
applySavedThemePreference();

/** Development only: tells the screenshot tool which page is open (for file names). */
function CaptureRouteTracker() {
  const path = usePathname();
  useEffect(() => setCaptureRoute(path), [path]);
  return null;
}

function RootStack() {
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* First on purpose: when sign-in/out flips the guards, the router falls back to the first
          available screen. `index` routes by role (GET /auth/me); without it, sign-in landed on /student. */}
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        {/* Role apps not released yet stay unreachable, even by deep link (features/auth/release.ts). */}
        <Stack.Protected guard={otherRolesOpen}>
          <Stack.Screen name="student" />
          <Stack.Screen name="parent" />
          <Stack.Screen name="teacher" />
          <Stack.Screen name="scanner" />
          <Stack.Screen name="librarian" />
          <Stack.Screen name="inspector" />
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Screen name="superadmin" />
        <Stack.Screen name="coming-soon" />
        <Stack.Screen name="gate" />
        <Stack.Screen name="web-only" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="my-qr" />
        <Stack.Screen name="two-fa" options={{ gestureEnabled: false }} />
        <Stack.Screen name="agreement" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      {/* Reachable signed in or out: the reset link signs the user in on this device. */}
      <Stack.Screen name="reset-password" />
      {/* Developer tools: not reachable in release builds. */}
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="dev" options={{ headerShown: true, title: 'Sprint 1 spikes' }} />
        <Stack.Screen name="gallery" options={{ headerShown: true, title: 'Components' }} />
      </Stack.Protected>
    </Stack>
  );
}

/** A crash anywhere below shows a retry screen (and is reported) instead of a blank app. */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app/error-boundary';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* The ref lets the development screenshot tool find the page on screen. */}
      <View style={{ flex: 1 }} ref={__DEV__ ? setCaptureRoot : undefined}>
        <DataProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AppConfigGate>
                <SessionProvider>
                  <AppLockProvider>
                    <RootStack />
                  </AppLockProvider>
                </SessionProvider>
              </AppConfigGate>
            </ConfirmProvider>
          </ToastProvider>
        </DataProvider>
        {__DEV__ ? <CaptureRouteTracker /> : null}
      </View>
      {/* Dialogs, selects and sheets render here (React Native Reusables). */}
      <PortalHost />
      <OfflineBanner />
    </ThemeProvider>
  );
}
