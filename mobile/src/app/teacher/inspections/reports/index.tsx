import { router, Stack } from 'expo-router';
import { Building2, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Inspection reports about the teacher, to read and sign (web: /teacher/inspections/reports). */
export default function TeacherInspectionReports() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.reports.${key}`);
  const res = useApi(['teacher', 'inspection-reports'], () => teacherInspections.myReports());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('list_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('teacher_list_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{k('no_reports')}</Text>
        ) : (
          <Card>
            <CardContent className="p-0">
              {list.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/teacher/inspections/reports/[id]', params: { id: r.id } })}
                  accessibilityRole="button"
                  className={cn('flex-row items-center gap-3 p-4', i > 0 && 'border-border border-t')}>
                  <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                    <Icon as={Building2} className="size-4 text-[#022172] dark:text-blue-300" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium" numberOfLines={1}>
                      {r.school?.name ?? ''}
                    </Text>
                    <Text className="text-muted-foreground text-xs">{formatDate(r.created_at)}</Text>
                  </View>
                  <Badge variant={r.status === 'fully_signed' ? 'secondary' : 'outline'} className="flex-row items-center gap-1">
                    <Icon as={FileText} className="size-3" />
                    <Text className="text-xs">{k(`status_${r.status}`)}</Text>
                  </Badge>
                </Pressable>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
