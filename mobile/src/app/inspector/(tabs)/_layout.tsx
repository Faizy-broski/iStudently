import { Tabs } from 'expo-router';
import { CalendarPlus, LayoutDashboard, Menu, MessageSquare, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

/** Dashboard, Visits, Community; Reports, Hifzi compliance and settings under More (web: inspector sidebar). */
export default function InspectorTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="visits" options={{ title: t('sidebar.visits'), tabBarIcon: tabIcon(CalendarPlus) }} />
      <Tabs.Screen name="community" options={{ title: t('sidebar.community'), tabBarIcon: tabIcon(MessageSquare) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
