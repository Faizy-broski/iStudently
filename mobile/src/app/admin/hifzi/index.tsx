import { router, Stack, type Href } from 'expo-router';
import { BarChart3, BookOpen, CalendarCheck, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ListRow } from '@/components/app/list-row';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isHifziKey, useHifziCircles, useHz } from '@/features/admin/hifzi';

/** Hifzi overview: circle count and shortcuts (web: /admin/hifzi). */
export default function HifziOverview() {
  const { h } = useHz();
  const { mutate } = useSWRConfig();
  const circles = useHifziCircles();
  const links: { title: string; href: Href; icon: LucideIcon }[] = [
    { title: h('circles.title'), href: '/admin/hifzi/circles', icon: BookOpen },
    { title: h('students.title'), href: '/admin/hifzi/students', icon: Users },
    { title: h('attendance.title'), href: '/admin/hifzi/attendance', icon: CalendarCheck },
    { title: h('reports.title'), href: '/admin/hifzi/reports', icon: BarChart3 },
    { title: h('settings.title'), href: '/admin/hifzi/settings', icon: Settings },
  ];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('overview.title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate(isHifziKey)} />}>
        <Text className="text-muted-foreground text-sm">{h('overview.subtitle')}</Text>
        <Card className="border-0 bg-[#022172]">
          <CardContent className="gap-1 pt-4">
            <Text className="text-3xl font-bold text-white">{circles.isLoading ? '…' : (circles.data ?? []).length}</Text>
            <Text className="text-xs text-white/80">{h('circles.title')}</Text>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            {links.map((l) => (
              <ListRow key={l.title} title={l.title} leading={<Icon as={l.icon} className="text-primary size-5" />} onPress={() => router.push(l.href)} />
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
