import { Tabs } from 'expo-router';
import { ClipboardCheck, FileText, LayoutDashboard, Menu, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { PillTabBar } from '@/components/app/pill-tab-bar';
import { Icon } from '@/components/ui/icon';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon as={icon} color={String(color)} size={size} />;
  };
}

/** Dashboard, audit log and reports (web: Fina supervisor sidebar); settings under More. */
export default function FinaSupervisorTabs() {
  const { t } = useTranslation();
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: true, headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: t('sidebar.fina_supervisor_dashboard'), tabBarIcon: tabIcon(LayoutDashboard) }} />
      <Tabs.Screen name="audit" options={{ title: t('sidebar.fina_supervisor_audit'), tabBarIcon: tabIcon(ClipboardCheck) }} />
      <Tabs.Screen name="reports" options={{ title: t('sidebar.fina_supervisor_reports'), tabBarIcon: tabIcon(FileText) }} />
      <Tabs.Screen name="more" options={{ headerShown: false, title: t('app.ad_tab_more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
