import { router, Stack, type Href } from 'expo-router';
import { BookOpen, Calendar, CalendarCheck, ChevronRight, Mic, type LucideIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

const LINKS: { href: Href; icon: LucideIcon; key: string }[] = [
  { href: '/teacher/hifzi/recite', icon: Mic, key: 'recitation.title' },
  { href: '/teacher/hifzi/attendance', icon: CalendarCheck, key: 'attendance.title' },
  { href: '/teacher/hifzi/plans', icon: Calendar, key: 'plans.title' },
  { href: '/teacher/hifzi/quran', icon: BookOpen, key: 'quranReader.title' },
];

/** Hifzi overview: the teacher's circle count and shortcuts (web: /teacher/hifzi). */
export default function TeacherHifzi() {
  const { h } = useHz();
  const circles = useApi(['teacher', 'hifzi-circles'], () => adminHifzi.circles());
  return (
    <>
      <Stack.Screen options={{ title: h('overview.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => circles.mutate()} />}>
        <Text variant="muted">{h('overview.subtitle')}</Text>
        <Card className="bg-[#022172]">
          <CardContent className="p-5">
            <Text className="text-3xl font-bold text-white">{String((circles.data ?? []).filter((c) => c.is_active).length)}</Text>
            <Text className="mt-1 text-xs text-white/80">{h('circles.title')}</Text>
          </CardContent>
        </Card>
        {LINKS.map((l) => (
          <Pressable key={l.key} onPress={() => router.push(l.href)} accessibilityRole="button">
            <Card>
              <CardContent className="flex-row items-center gap-3 p-4">
                <View className="rounded-lg bg-[#022172]/10 p-2">
                  <Icon as={l.icon} className="size-5 text-[#022172] dark:text-blue-400" />
                </View>
                <Text className="flex-1 font-medium">{h(l.key)}</Text>
                <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
              </CardContent>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
