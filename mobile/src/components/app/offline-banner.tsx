import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import i18n from '@/i18n';

const time = (d: Date) =>
  d.toLocaleTimeString(i18n.language === 'ar' ? 'ar' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Offline pill under the status bar (Figma "System states"): "You're offline · Showing data from 15:42",
 * so screens showing cached data aren't mistaken for live data.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [since, setSince] = useState<Date | null>(null);
  // Data is only cached in memory, so "showing data from…" is true only once the app has been online
  // during this launch; opened offline, there is no data to show.
  const [wasOnline, setWasOnline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        // isInternetReachable is null while unknown: only a definite "no" counts.
        const offline = s.isConnected === false || s.isInternetReachable === false;
        if (!offline && s.isConnected) setWasOnline(true);
        // Remember when the connection dropped: that's how fresh the shown data is.
        setSince((prev) => (offline ? (prev ?? new Date()) : null));
      }),
    [],
  );
  if (!since) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ position: 'absolute', top: insets.top + 4, start: 12, end: 12, zIndex: 1000 }}
      className="border-warning/40 bg-warning-soft flex-row items-center gap-2 rounded-full border px-3 py-2">
      <Icon as={WifiOff} className="text-warning size-4" />
      <Text className="text-warning flex-1 text-xs font-semibold">{t('app.offline_banner')}</Text>
      {wasOnline ? <Text className="text-warning text-xs">{t('app.offline_since', { time: time(since) })}</Text> : null}
    </View>
  );
}
