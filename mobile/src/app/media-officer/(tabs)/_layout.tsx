import { Tabs } from 'expo-router';
import { Bell, ClipboardCheck, Menu, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

/** Review queue and notifications (web: media officer sidebar); settings under More. */
export default function MediaOfficerTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: t('sidebar.fina_review'), tabBarIcon: tabIcon(ClipboardCheck) }} />
      <Tabs.Screen name="notifications" options={{ title: t('sidebar.fina_notifications'), tabBarIcon: tabIcon(Bell) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
