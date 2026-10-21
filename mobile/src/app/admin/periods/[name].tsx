import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminPeriods } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Classes scheduled in one bell period (web: /admin/periods/[name]/classes). */
export default function PeriodClasses() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`app.pc_${k}`, o);
  const { name } = useLocalSearchParams<{ name: string }>();
  const { campusId, campus } = useCampus();
  const period = useApi(['admin', 'period-by-name', name, campusId ?? 'school'], ([, , n]) => adminPeriods.byName(n as string, campusId));
  const classes = useApi(['admin', 'period-classes', name, campusId ?? 'school'], ([, , n]) => adminPeriods.classesByName(n as string, campusId));
  const [q, setQ] = useState('');
  const term = q.toLowerCase();
  const rows = (classes.data ?? []).filter((x) => !term || [x.section_name, x.grade_name, x.subject_name, x.teacher_name, x.day_name].some((v) => v?.toLowerCase().includes(term)));
  const pd = period.data;
  return (
    <>
      <Stack.Screen options={{ title: c('title', { name: pd?.title || name }) }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="muted" className="flex-1">{[pd?.short_name, pd?.length_minutes != null ? c('minutes', { count: pd.length_minutes }) : null, campus?.name].filter(Boolean).join(' • ')}</Text>
                <Badge>
                  <Text>{c('classes', { count: rows.length })}</Text>
                </Badge>
              </View>
              <SearchBar value={q} onChangeText={setQ} placeholder={c('search')} />
            </View>
          }
          items={classes.data ? rows : undefined}
          error={classes.error}
          isLoading={classes.isLoading}
          onRefresh={() => classes.mutate()}
          emptyTitle={q ? c('no_match') : c('none')}
          emptyBody={q ? c('try_other') : c('go_timetable_hint')}
          ListFooterComponent={
            !q && classes.data && !rows.length ? (
              <View className="items-center pb-6">
                <Button onPress={() => router.push('/admin/timetable')}>
                  <Text>{c('go_timetable')}</Text>
                </Button>
              </View>
            ) : null
          }
          keyExtractor={(x) => `${x.id}-${x.day_of_week}`}
          renderItem={(x) => (
            <View className="gap-0.5 px-4 py-3">
              <Text className="text-sm font-semibold">{`${x.subject_name}${x.subject_code ? ` (${x.subject_code})` : ''}`}</Text>
              <Text className="text-muted-foreground text-xs">{[`${x.grade_name} ${x.section_name}`.trim(), x.teacher_name].filter(Boolean).join(' · ')}</Text>
              <Text className="text-sm">{[x.day_name, x.room_number ? c('room', { room: x.room_number }) : null].filter(Boolean).join(' · ')}</Text>
            </View>
          )}
        />
      </View>
    </>
  );
}
