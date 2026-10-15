import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** A thin bar at the top of every screen while the phone has no internet, so empty lists aren't mistaken for "no data". */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        // isInternetReachable is null while unknown: only a definite "no" counts.
        setOffline(s.isConnected === false || s.isInternetReachable === false);
      }),
    [],
  );
  if (!offline) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{ position: 'absolute', top: 0, start: 0, end: 0, paddingTop: insets.top, zIndex: 1000 }}
      className="bg-amber-500">
      <View className="flex-row items-center justify-center gap-2 py-1">
        <Icon as={WifiOff} className="size-3.5 text-white" />
        <Text className="text-xs font-medium text-white">{t('app.offline_banner')}</Text>
      </View>
    </View>
  );
}
