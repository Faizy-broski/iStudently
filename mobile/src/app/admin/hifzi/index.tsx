import { router, Stack, type Href } from 'expo-router';
import { BarChart3, BookOpen, CalendarCheck, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { HeroCard, IconTile, RowItem, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isHifziKey, useHifziCircles, useHz } from '@/features/admin/hifzi';

/** Hifzi overview: circle count and shortcuts (web: /admin/hifzi). */
export default function HifziOverview() {
  const { h } = useHz();
  const { mutate } = useSWRConfig();
  const circles = useHifziCircles();
  const links: { title: string; href: Href; icon: LucideIcon; tone: Tone }[] = [
    { title: h('circles.title'), href: '/admin/hifzi/circles', icon: BookOpen, tone: 'brand' },
    { title: h('students.title'), href: '/admin/hifzi/students', icon: Users, tone: 'success' },
    { title: h('attendance.title'), href: '/admin/hifzi/attendance', icon: CalendarCheck, tone: 'warning' },
    { title: h('reports.title'), href: '/admin/hifzi/reports', icon: BarChart3, tone: 'brand' },
    { title: h('settings.title'), href: '/admin/hifzi/settings', icon: Settings, tone: 'muted' },
  ];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('overview.title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate(isHifziKey)} />}>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-sm font-semibold text-white/85">{h('circles.title')}</Text>
              <Text className="text-3xl font-bold text-white">{circles.isLoading ? '…' : (circles.data ?? []).length}</Text>
            </View>
            <View className="size-12 items-center justify-center rounded-2xl bg-white/15">
              <Icon as={BookOpen} className="size-6 text-white" />
            </View>
          </View>
          <Text className="text-xs text-white/80">{h('overview.subtitle')}</Text>
        </HeroCard>
        <Panel>
          {links.map((l, i) => (
            <RowItem key={l.title} title={l.title} leading={<IconTile icon={l.icon} tone={l.tone} size={40} />} onPress={() => router.push(l.href)} last={i === links.length - 1} />
          ))}
        </Panel>
      </ScrollView>
    </View>
  );
}
