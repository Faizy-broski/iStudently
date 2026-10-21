import { Stack } from 'expo-router';
import { BarChart3, BookOpen, GraduationCap, Layers, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, Section, StatTile, StatTiles } from '@/components/app/layout';
import { ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useAcademicYears, useMarkingPeriods } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Subjects, courses, course periods, enrollment, seats and marking periods (web: /admin/scheduling/dashboard). */
export default function SchedulingDashboard() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.dashboard.${k}`, o);
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const mps = useMarkingPeriods();
  const stats = useApi(yearId ? ['admin', 'scheduling-stats', campusId ?? 'school', yearId] : null, ([, , , y]) => adminScheduling.dashboardStats(y as string, campusId));
  const refresh = () => {
    years.mutate();
    stats.mutate();
    mps.mutate();
  };
  const s = stats.data;
  const pct = s && s.total_seats ? Math.round((s.total_filled / s.total_seats) * 100) : 0;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {years.isLoading || stats.isLoading ? (
          <LoadingList rows={4} />
        ) : stats.error ? (
          <ErrorState message={stats.error.message} onRetry={refresh} />
        ) : s ? (
          <>
            <HeroCard>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-white/85">{d('utilization_title')}</Text>
                <Text className="text-2xl font-bold text-white">{`${pct}%`}</Text>
              </View>
              <View className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <View className="h-2.5 rounded-full bg-white" style={{ width: `${Math.min(pct, 100)}%` }} />
              </View>
              <Text className="text-xs text-white/80">
                {d('utilization_text', { filled: s.total_filled, total: s.total_seats })}
                {s.total_seats - s.total_filled > 0 ? ` — ${d('utilization_seats_available', { count: s.total_seats - s.total_filled })}` : ''}
              </Text>
            </HeroCard>
            <StatTiles>
              <StatTile icon={BookOpen} label={d('stat_subjects')} value={String(s.total_subjects)} />
              <StatTile icon={Layers} tone="success" label={d('stat_courses')} value={String(s.total_courses)} />
              <StatTile icon={BarChart3} tone="warning" label={d('stat_course_periods')} value={String(s.total_course_periods)} />
              <StatTile icon={GraduationCap} label={d('stat_students_enrolled')} value={String(s.total_students_enrolled)} />
              <StatTile icon={Users} tone="destructive" label={d('stat_total_seats')} value={String(s.total_seats)} />
              <StatTile icon={Users} tone="success" label={d('stat_filled_seats')} value={String(s.total_filled)} />
            </StatTiles>
            {mps.list.length ? (
              <Section title={d('marking_periods_title')}>
                <View className="flex-row flex-wrap gap-1.5">
                  {mps.list.map((m) => (
                    <StatusChip key={m.id} label={`${m.short_name || m.title} · ${m.mp_type}`} tone="info" className="px-3 py-1" />
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
