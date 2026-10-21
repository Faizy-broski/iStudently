import { Tabs } from 'expo-router';
import { BookOpen, ClipboardList, LayoutDashboard, Menu, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function LibrarianTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="books" options={{ title: t('sidebar.books'), tabBarIcon: tabIcon(BookOpen) }} />
      <Tabs.Screen name="loans" options={{ title: t('sidebar.loan_directory'), tabBarIcon: tabIcon(ClipboardList) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
