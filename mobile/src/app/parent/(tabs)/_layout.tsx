import { Tabs } from 'expo-router';
import { GraduationCap, LayoutDashboard, Menu, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function ParentTabs() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="academics" options={{ title: t('app.ad_tab_academics'), tabBarIcon: tabIcon(GraduationCap) }} />
      <Tabs.Screen name="billing" options={{ title: t('app.pa_tab_billing'), tabBarIcon: tabIcon(Wallet) }} />
      <Tabs.Screen name="more" options={{ title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
