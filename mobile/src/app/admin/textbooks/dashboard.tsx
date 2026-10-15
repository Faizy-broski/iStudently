import { router, Stack } from 'expo-router';
import { BookX, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminTextbooks } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** How many students still wait on each textbook, by book and by section (web: /admin/textbooks/dashboard). */
export default function TextbookMissing() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`textbooks.dashboard.${k}`, o);
  const { campusId } = useCampus();
  const res = useApi(['admin', 'textbook-missing', campusId ?? 'school'], () => adminTextbooks.missingSummary(campusId));
  const data = res.data;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('pageTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{d('pageSubtitle')}</Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => router.push('/admin/textbooks/matrix')}>
          <Text>{d('goToMatrix')}</Text>
        </Button>
        {res.isLoading ? (
          <LoadingList />
        ) : res.error || !data ? (
          <ErrorState message={d('loadError')} onRetry={() => res.mutate()} />
        ) : (
          <>
            {!data.by_book.length ? <Text className="text-muted-foreground">{d('noActiveTextbooks')}</Text> : null}
            <View className="flex-row flex-wrap gap-3">
              {data.by_book.map((b) => {
                const bad = b.missing_count > 0;
                return (
                  <Card key={b.book_id} className={cn('min-w-[46%] flex-1', bad && 'border-red-200 dark:border-red-900')}>
                    <CardContent className="gap-1 pt-4">
                      <View className="flex-row items-start gap-2">
                        <View className="flex-1">
                          <Text className="font-medium">{b.title}</Text>
                          <Text className="text-muted-foreground text-xs">{b.grade_level_name || '—'}</Text>
                        </View>
                        <Icon as={BookX} className={cn('size-4', bad ? 'text-red-500' : 'text-muted-foreground')} />
                      </View>
                      <Text className={cn('text-2xl font-bold', bad ? 'text-red-600' : 'text-emerald-600')}>{b.missing_count}</Text>
                      <Text className="text-muted-foreground text-xs">{d('missingOf', { count: b.total_students })}</Text>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
            <Card>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={Users} className="text-foreground size-4" />
                  <Text className="font-semibold">{d('bySection')}</Text>
                </View>
                <View className="flex-row px-1">
                  <Text className="text-muted-foreground flex-1 text-xs">{d('thSection')}</Text>
                  <Text className="text-muted-foreground w-20 text-center text-xs">{d('thStudents')}</Text>
                  <Text className="text-muted-foreground w-24 text-end text-xs">{d('thMissing')}</Text>
                </View>
                {!data.by_section.length ? (
                  <Text className="text-muted-foreground py-4 text-center text-sm">{d('noSections')}</Text>
                ) : (
                  data.by_section.map((s, i) => (
                    <View key={s.section_id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="flex-row items-center px-1 py-2">
                        <Text className="flex-1 text-sm">{s.section_name}</Text>
                        <Text className="w-20 text-center text-sm">{s.total_students}</Text>
                        <Text className={cn('w-24 text-end text-sm font-semibold', s.missing_count > 0 ? 'text-red-600' : 'text-emerald-600')}>{s.missing_count}</Text>
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
