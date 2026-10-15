import { Stack } from 'expo-router';
import { BarChart3, BookOpen, GraduationCap, Layers, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYears, useMarkingPeriods } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

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
  const cards = s
    ? [
        { label: d('stat_subjects'), value: s.total_subjects, icon: BookOpen, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
        { label: d('stat_courses'), value: s.total_courses, icon: Layers, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' },
        { label: d('stat_course_periods'), value: s.total_course_periods, icon: BarChart3, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950' },
        { label: d('stat_students_enrolled'), value: s.total_students_enrolled, icon: GraduationCap, tone: 'text-purple-600 bg-purple-50 dark:bg-purple-950' },
        { label: d('stat_total_seats'), value: s.total_seats, icon: Users, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950' },
        { label: d('stat_filled_seats'), value: s.total_filled, icon: Users, tone: 'text-teal-600 bg-teal-50 dark:bg-teal-950' },
      ]
    : [];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {years.isLoading || stats.isLoading ? (
          <LoadingList rows={4} />
        ) : stats.error ? (
          <ErrorState message={stats.error.message} onRetry={refresh} />
        ) : (
          <>
            <View className="flex-row flex-wrap gap-3">
              {cards.map((c) => (
                <Card key={c.label} className="min-w-[30%] flex-1">
                  <CardContent className="items-center gap-2 py-4">
                    <View className={cn('rounded-full p-2', c.tone.split(' ').slice(1).join(' '))}>
                      <Icon as={c.icon} className={cn('size-5', c.tone.split(' ')[0])} />
                    </View>
                    <Text className="text-2xl font-bold">{c.value}</Text>
                    <Text className="text-muted-foreground text-center text-xs">{c.label}</Text>
                  </CardContent>
                </Card>
              ))}
            </View>
            {s && s.total_seats > 0 ? (
              <Card>
                <CardContent className="gap-2 pt-4">
                  <Text className="font-semibold">{d('utilization_title')}</Text>
                  <View className="flex-row items-center gap-3">
                    <View className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                      <View className={cn('h-3 rounded-full', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </View>
                    <Text className="w-12 text-end text-sm font-semibold">{pct}%</Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {d('utilization_text', { filled: s.total_filled, total: s.total_seats })}
                    {s.total_seats - s.total_filled > 0 ? ` — ${d('utilization_seats_available', { count: s.total_seats - s.total_filled })}` : ''}
                  </Text>
                </CardContent>
              </Card>
            ) : null}
            {mps.list.length ? (
              <Card>
                <CardContent className="gap-2 pt-4">
                  <Text className="font-semibold">{d('marking_periods_title')}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {mps.list.map((m) => (
                      <View key={m.id} className="bg-primary/10 flex-row rounded-full px-3 py-1">
                        <Text className="text-primary text-xs font-medium">{m.short_name || m.title}</Text>
                        <Text className="text-muted-foreground ms-1.5 text-xs">({m.mp_type})</Text>
                      </View>
                    ))}
                  </View>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
