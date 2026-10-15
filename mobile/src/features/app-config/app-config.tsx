import { appConfigApi, type AppConfig } from '@studently/api-client';
import { isUpdateRequired } from '@studently/shared-utils';
import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, Platform } from 'react-native';

import { StatusScreen } from '@/components/status-screen';
import { api } from '@/lib/api';

const REFRESH_MS = 5 * 60 * 1000;
const appVersion = Constants.expoConfig?.version ?? '0.0.0';

const AppConfigContext = createContext<AppConfig | null>(null);

/** Feature flags and server time from GET /public/app-config (null until loaded or if offline). */
export function useAppConfig() {
  return useContext(AppConfigContext);
}

/**
 * Loads the app config at launch and when the app returns to the foreground (at most every
 * 5 minutes), and blocks the app with "Update required" or "Maintenance" when the server says so.
 * If the config can't be loaded the app continues (fail open); offline handling is separate.
 */
export function AppConfigGate({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lastFetch = useRef(0);

  const load = useCallback(() => {
    lastFetch.current = Date.now();
    void appConfigApi(api)
      .get()
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastFetch.current > REFRESH_MS) load();
    });
    return () => sub.remove();
  }, [load]);

  // Keep the splash screen up until the first answer (or failure).
  if (!loaded) return null;

  const platform = Platform.OS === 'ios' ? config?.ios : config?.android;

  if (platform && isUpdateRequired(appVersion, platform.min_version)) {
    const storeUrl = platform.store_url;
    return (
      <StatusScreen
        title={t('app.update_required_title')}
        body={t('app.update_required_body')}
        actions={storeUrl ? [{ label: t('app.update_button'), onPress: () => Linking.openURL(storeUrl), primary: true }] : []}
      />
    );
  }

  if (config?.maintenance.enabled) {
    const message = i18n.language === 'ar' ? config.maintenance.message.ar : config.maintenance.message.en;
    return (
      <StatusScreen
        title={t('app.maintenance_title')}
        body={message ?? t('app.maintenance_body')}
        actions={[{ label: t('app.retry'), onPress: load, primary: true }]}
      />
    );
  }

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}
