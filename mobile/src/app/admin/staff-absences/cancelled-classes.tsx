import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, formatYmd, todayYmd } from '@/components/app/date-field';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminStaffAbsences } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Classes cancelled because of staff absences (web: /admin/staff-absences/cancelled-classes). */
export default function CancelledClasses() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`staffAbsences.${k}`, o);
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [end, setEnd] = useState(todayYmd);
  const list = useApi(schoolId ? ['admin', 'cancelled-classes', schoolId, campusId ?? 'school', start, end] : null, () =>
    adminStaffAbsences.cancelledClasses({ school_id: schoolId, campus_id: campusId, start_date: start, end_date: end }),
  );
  const rows = list.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: s('cancelledClasses.title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={s('filters.from')} value={start} onChange={setStart} clearable />
                <DateField className="flex-1" label={s('filters.to')} value={end} onChange={setEnd} clearable />
              </View>
              <Text variant="muted">{s('cancelledClasses.resultsCount', { count: rows.length })}</Text>
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('empty.cancelledClasses')}
          keyExtractor={(r) => `${r.absence_id}-${r.course_period_id}`}
          renderItem={(r) => (
            <View className="gap-0.5 px-4 py-3">
              <Text className="font-medium">{r.staff_name}</Text>
              <Text className="text-sm">
                {r.course_period_title} <Text className="text-muted-foreground font-mono text-xs">{r.short_name}</Text>
              </Text>
              <Text className="text-muted-foreground text-xs">{`${formatYmd(r.start_date, i18n.language)} → ${formatYmd(r.end_date, i18n.language)}`}</Text>
            </View>
          )}
        />
      </View>
    </>
  );
}
