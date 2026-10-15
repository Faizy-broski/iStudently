import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { hadithForty } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Students' Hadith Forty progress for the current year (web: /admin/resources/hadith-forty/class). */
export default function HadithFortyClass() {
  const { t } = useTranslation();
  const h = (k: string) => t(`hadithForty.class.${k}`);
  const { campusId } = useCampus();
  const res = useApi(['admin', 'hadith-class', campusId ?? 'school'], () => hadithForty.classSummary(campusId));
  const rows = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={6} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !rows.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{h('empty')}</Text>
        ) : (
          <Card>
            <CardContent className="py-1">
              {rows.map((r, i) => (
                <View key={r.profileId}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-1 py-2.5">
                    <Text className="font-medium">
                      {r.firstName} {r.lastName}
                    </Text>
                    <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
                      <Text className="text-xs">
                        {h('colMastered')}: {r.mastered} / 42
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {h('colLearning')}: {r.learning}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {h('colRepetitions')}: {r.totalRepetitions}
                      </Text>
                      <Text className={cn('text-xs', r.dueToday > 0 ? 'font-semibold text-amber-600' : 'text-muted-foreground')}>
                        {h('colDueToday')}: {r.dueToday}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
