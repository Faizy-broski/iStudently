import { router, Stack, type Href } from 'expo-router';
import { BookOpen, Calendar, CalendarCheck, Mic, type LucideIcon } from 'lucide-react-native';
import { RefreshControl, ScrollView } from 'react-native';

import { HeroCard, IconTile, RowItem, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

const LINKS: { href: Href; icon: LucideIcon; key: string; tone: Tone }[] = [
  { href: '/teacher/hifzi/recite', icon: Mic, key: 'recitation.title', tone: 'brand' },
  { href: '/teacher/hifzi/attendance', icon: CalendarCheck, key: 'attendance.title', tone: 'success' },
  { href: '/teacher/hifzi/plans', icon: Calendar, key: 'plans.title', tone: 'warning' },
  { href: '/teacher/hifzi/quran', icon: BookOpen, key: 'quranReader.title', tone: 'destructive' },
];

/** Hifzi overview: the teacher's circle count and shortcuts (web: /teacher/hifzi). */
export default function TeacherHifzi() {
  const { h } = useHz();
  const circles = useApi(['teacher', 'hifzi-circles'], () => adminHifzi.circles());
  return (
    <>
      <Stack.Screen options={{ title: h('overview.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => circles.mutate()} />}>
        <HeroCard>
          <Text className="text-sm font-semibold text-white/85">{h('circles.title')}</Text>
          <Text className="text-4xl font-bold text-white">{circles.isLoading ? '—' : String((circles.data ?? []).filter((c) => c.is_active).length)}</Text>
          <Text className="text-xs text-white/80">{h('overview.subtitle')}</Text>
        </HeroCard>
        <Panel>
          {LINKS.map((l, i) => (
            <RowItem key={l.key} title={h(l.key)} leading={<IconTile icon={l.icon} tone={l.tone} size={40} />} onPress={() => router.push(l.href)} last={i === LINKS.length - 1} />
          ))}
        </Panel>
      </ScrollView>
    </>
  );
}
