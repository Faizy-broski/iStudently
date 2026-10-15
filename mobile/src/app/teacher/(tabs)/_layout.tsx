import { Tabs } from 'expo-router';
import { BookOpen, LayoutDashboard, Menu, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

export default function TeacherTabs() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: t('app.ad_tab_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="classes" options={{ title: t('app.te_tab_classes'), tabBarIcon: tabIcon(BookOpen) }} />
      <Tabs.Screen name="students" options={{ title: t('app.te_tab_students'), tabBarIcon: tabIcon(Users) }} />
      <Tabs.Screen name="more" options={{ title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
