import * as LocalAuthentication from 'expo-local-authentication';
import Storage from 'expo-sqlite/kv-store';
import { Image } from 'expo-image';
import { Fingerprint } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';

const KEY = 'app.biometric_lock';
/** Coming back after this long in the background asks again. */
const RELOCK_AFTER_MS = 60_000;

interface AppLock {
  /** Device has Face ID / fingerprint / passcode set up. */
  available: boolean;
  enabled: boolean;
  /** Turning it on asks once first, so the user can't lock themselves out. */
  setEnabled(on: boolean): Promise<boolean>;
}

const AppLockContext = createContext<AppLock | null>(null);

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}

async function isAvailable() {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/**
 * Optional "unlock with Face ID / fingerprint" for signed-in users. Locks at launch and after a
 * minute in the background. The session stays on the device; this only covers the screen.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, loading, signOut } = useSession();
  const [enabled, setEnabledState] = useState(() => Storage.getItemSync(KEY) === 'on');
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(() => Storage.getItemSync(KEY) === 'on');
  const [prompting, setPrompting] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    isAvailable().then(setAvailable);
  }, []);

  // A fresh sign-in (not the session restored at launch) has just proved who the user is.
  const hadSession = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    if (hadSession.current === false && session) setLocked(false);
    hadSession.current = !!session;
  }, [loading, session]);

  const unlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    try {
      // If the device lock was removed since, there is nothing to check against.
      if (!(await isAvailable())) return setLocked(false);
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('app.lock_prompt'), disableDeviceFallback: false });
      if (res.success) setLocked(false);
    } finally {
      setPrompting(false);
    }
  }, [prompting, t]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && enabled) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const showLock = enabled && locked && !!session;

  // Ask straight away when the lock screen appears (only while the app is in the foreground).
  useEffect(() => {
    if (!showLock || AppState.currentState !== 'active') return;
    // Next tick, so the lock screen is on screen before the system prompt opens.
    const timer = setTimeout(unlock, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLock]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        if (!(await isAvailable())) return false;
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('app.lock_enable_prompt'), disableDeviceFallback: false });
        if (!res.success) return false;
      }
      Storage.setItemSync(KEY, on ? 'on' : 'off');
      setEnabledState(on);
      setLocked(false);
      return true;
    },
    [t],
  );

  return (
    <AppLockContext.Provider value={{ available, enabled, setEnabled }}>
      {children}
      <Modal visible={showLock} animationType="none" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => {}}>
        <SafeAreaView className="bg-background flex-1 items-center justify-center gap-6 p-8">
          <Image source={require('@/assets/images/icon.png')} style={{ width: 72, height: 72, borderRadius: 16 }} />
          <View className="items-center gap-2">
            <Text variant="h3">{t('app.lock_title')}</Text>
            <Text variant="muted" className="text-center">
              {t('app.lock_body')}
            </Text>
          </View>
          <Button onPress={unlock} disabled={prompting} className="self-stretch">
            <Icon as={Fingerprint} className="text-primary-foreground size-4" />
            <Text>{t('app.lock_unlock')}</Text>
          </Button>
          <Button variant="ghost" onPress={signOut} className="self-stretch">
            <Text>{t('app.sign_out')}</Text>
          </Button>
        </SafeAreaView>
      </Modal>
    </AppLockContext.Provider>
  );
}
