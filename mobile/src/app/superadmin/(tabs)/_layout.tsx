import { Tabs } from 'expo-router';
import { Building2, CreditCard, Inbox, LayoutDashboard, Menu, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function SuperadminTabs() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: t('app.sa_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="schools" options={{ title: t('app.sa_tab_schools'), tabBarIcon: tabIcon(Building2) }} />
      <Tabs.Screen name="billing" options={{ title: t('app.sa_tab_billing'), tabBarIcon: tabIcon(CreditCard) }} />
      <Tabs.Screen name="inbox" options={{ title: t('app.sa_tab_inbox'), tabBarIcon: tabIcon(Inbox) }} />
      <Tabs.Screen name="more" options={{ title: t('app.sa_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
