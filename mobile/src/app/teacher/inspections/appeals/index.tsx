import type { AppealStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { MessageSquareWarning } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS: Record<AppealStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated: 'bg-purple-100 text-purple-800',
  upheld: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
};

/** Appeals the teacher filed against evaluations (web: /teacher/inspections/appeals). */
export default function TeacherInspectionAppeals() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.appeals.${key}`);
  const res = useApi(['teacher', 'inspection-appeals'], () => teacherInspections.myAppeals());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('list_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('teacher_list_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{k('no_appeals')}</Text>
        ) : (
          <Card>
            <CardContent className="p-0">
              {list.map((a, i) => {
                const tone = STATUS[a.status] ?? STATUS.withdrawn;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push({ pathname: '/teacher/inspections/appeals/[id]', params: { id: a.id } })}
                    accessibilityRole="button"
                    className={cn('flex-row items-center gap-3 p-4', i > 0 && 'border-border border-t')}>
                    <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                      <Icon as={MessageSquareWarning} className="size-4 text-[#022172] dark:text-blue-300" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm" numberOfLines={1}>
                        {a.reason}
                      </Text>
                      <Text className="text-muted-foreground text-xs">{formatDate(a.created_at)}</Text>
                    </View>
                    <View className={cn('rounded-full px-2 py-0.5', tone.split(' ')[0])}>
                      <Text className={cn('text-xs', tone.split(' ')[1])}>{k(`status_${a.status}`)}</Text>
                    </View>
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
