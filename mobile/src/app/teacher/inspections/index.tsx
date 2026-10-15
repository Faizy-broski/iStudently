import type { VisitStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Building2, Calendar, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUS: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
};

/** Inspection visits that include the teacher; completed / in-progress ones open the evaluation (web: /teacher/inspections). */
export default function TeacherInspectionVisits() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const res = useApi(['teacher', 'inspection-visits'], () => teacherInspections.myVisits());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('teacher_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('teacher_page_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{k('no_visits')}</Text>
        ) : (
          <Card>
            <CardContent className="p-0">
              {list.map((v, i) => {
                const canOpen = v.status === 'completed' || v.status === 'in_progress';
                const tone = STATUS[v.status] ?? STATUS.rescheduled;
                return (
                  <Pressable
                    key={v.id}
                    disabled={!canOpen}
                    onPress={() => router.push({ pathname: '/teacher/inspections/[visitId]', params: { visitId: v.id } })}
                    accessibilityRole={canOpen ? 'button' : undefined}
                    className={cn('flex-row items-center gap-3 p-4', i > 0 && 'border-border border-t')}>
                    <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                      <Icon as={Building2} className="size-4 text-[#022172] dark:text-blue-300" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {v.school?.name || v.school_id}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Icon as={Calendar} className="text-muted-foreground size-3" />
                        <Text className="text-muted-foreground text-xs">{`${v.scheduled_date}${v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}`}</Text>
                      </View>
                    </View>
                    <View className={cn('rounded-full px-2 py-0.5', tone.split(' ')[0])}>
                      <Text className={cn('text-xs', tone.split(' ')[1])}>{k(`status_${v.status}`)}</Text>
                    </View>
                    {canOpen ? <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" /> : null}
                  </Pressable>
                );
              })}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
