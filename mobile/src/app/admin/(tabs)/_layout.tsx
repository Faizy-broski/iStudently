import { Tabs } from 'expo-router';
import { GraduationCap, LayoutDashboard, Menu, Users, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';
import { CampusSwitcher } from '@/features/campus/campus-switcher';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function AdminTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left', headerTitle: () => <CampusSwitcher /> }}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="people" options={{ headerShown: false, title: t('app.ad_tab_people'), tabBarIcon: tabIcon(Users) }} />
      <Tabs.Screen name="fees" options={{ headerShown: false, title: t('app.ad_tab_fees'), tabBarIcon: tabIcon(Wallet) }} />
      <Tabs.Screen name="academics" options={{ headerShown: false, title: t('app.ad_tab_academics'), tabBarIcon: tabIcon(GraduationCap) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
