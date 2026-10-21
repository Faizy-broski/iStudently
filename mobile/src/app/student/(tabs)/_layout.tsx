import { Tabs } from 'expo-router';
import { BookOpen, GraduationCap, LayoutDashboard, Menu, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function StudentTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="academics" options={{ title: t('app.ad_tab_academics'), tabBarIcon: tabIcon(GraduationCap) }} />
      <Tabs.Screen name="resources" options={{ title: t('app.st_tab_resources'), tabBarIcon: tabIcon(BookOpen) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
