import '@/global.css';
import '@/i18n';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider, usePathname } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ConfirmProvider } from '@/components/app/confirm';
import { OfflineBanner } from '@/components/app/offline-banner';
import { ToastProvider } from '@/components/app/toast';
import { AppConfigGate } from '@/features/app-config/app-config';
import { AppLockProvider } from '@/features/auth/app-lock';
import { resolveDestination } from '@/features/auth/destination';
import { otherRolesOpen } from '@/features/auth/release';
import { SessionProvider, useSession } from '@/features/auth/session';
import { PushRegistrar } from '@/features/push/registrar';
import { AnimatedSplash } from '@/features/splash/animated-splash';
import { registerCaptureMenu, setCaptureRoot, setCaptureRoute } from '@/features/dev/full-page-capture';
import { DataProvider } from '@/lib/data';
import { installGlobalErrorHandler } from '@/lib/monitoring';
import { navTheme } from '@/lib/theme';
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
  const { session, loading, me } = useSession();
  // Animated launch screen (features/splash) over the app until the session and account are loaded.
  const [splash, setSplash] = useState(true);
  const appReady = !loading && (!session || me.status !== 'loading');

  return (
    <>
      {loading ? null : <AppStack session={session} />}
      {loading ? null : <PushRegistrar />}
      {splash ? <AnimatedSplash ready={appReady} onLayout={() => SplashScreen.hideAsync()} onDone={() => setSplash(false)} /> : null}
    </>
  );
}

/**
 * The role section the signed-in user may open: their own role's home, and only once every sign-in
 * step (forced password change, 2FA, agreement) has passed. While the account is re-checked
 * (`loading`) or the check fails (`error`, e.g. offline), the last confirmed section stays open; a
 * blocked account or a pending step closes every section, even for deep links.
 */
function useHomeGroup() {
  const { me } = useSession();
  const [home, setHome] = useState<string | null>(null);
  let next: string | null = null;
  if (me.status === 'ready') {
    const d = resolveDestination(me.me);
    next = d.kind === 'home' ? d.href.slice(1) : null;
  } else if (me.status === 'loading' || me.status === 'error') next = home;
  if (next !== home) setHome(next);
  return next;
}

function AppStack({ session }: { session: ReturnType<typeof useSession>['session'] }) {
  const home = useHomeGroup();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* First on purpose: when sign-in/out flips the guards, the router falls back to the first
          available screen. `index` routes by role (GET /auth/me); without it, sign-in landed on /student. */}
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        {/* Role apps not released yet stay unreachable, even by deep link (features/auth/release.ts);
            released ones open only for the user's own role (useHomeGroup). */}
        <Stack.Protected guard={otherRolesOpen}>
          <Stack.Protected guard={home === 'student'}>
            <Stack.Screen name="student" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'parent'}>
            <Stack.Screen name="parent" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'teacher'}>
            <Stack.Screen name="teacher" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'scanner'}>
            <Stack.Screen name="scanner" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'librarian'}>
            <Stack.Screen name="librarian" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'inspector'}>
            <Stack.Screen name="inspector" />
          </Stack.Protected>
          <Stack.Protected guard={home === 'admin'}>
            <Stack.Screen name="admin" />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Protected guard={home === 'superadmin'}>
          <Stack.Screen name="superadmin" />
        </Stack.Protected>
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
    <KeyboardProvider>
      <ThemeProvider value={navTheme(scheme)}>
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
    </KeyboardProvider>
  );
}
