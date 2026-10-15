import type { TeacherCompletionStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ALL, useAttendanceScope } from '@/features/admin/attendance';
import { adminAcademics, adminAttendance } from '@/lib/api';
import { useApi } from '@/lib/data';

type Cell = { period: string; teacher: string; courses: { subject_name: string; section_name: string }[] };

/** Which teachers took attendance for each period on a day (web: /admin/attendance/teacher-completion). */
export default function TeacherCompletion() {
  const { t } = useTranslation();
  const a = (k: string) => t(`attendance.${k}`);
  const { schoolId, campusId } = useAttendanceScope();
  const [date, setDate] = useState(todayYmd);
  const [period, setPeriod] = useState(ALL);
  const [cell, setCell] = useState<Cell | null>(null);

  const periodsRes = useApi(['admin', 'class-periods', campusId ?? 'school'], () => adminAcademics.periods(campusId));
  const active = (periodsRes.data ?? []).filter((p) => !p.is_break);
  const display = (period === ALL ? active : active.filter((p) => p.id === period)).map((p) => ({ id: p.id, name: p.period_name || `P${p.period_number}` }));
  const list = useApi(schoolId ? ['admin', 'teacher-completion', schoolId, campusId ?? 'school', date, period] : null, () =>
    adminAttendance.getTeacherCompletion(schoolId, date, campusId, period === ALL ? undefined : period),
  );

  return (
    <>
      <Stack.Screen options={{ title: a('completion_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <DateField value={date} onChange={(d) => d && setDate(d)} />
              <Picker value={period} onChange={setPeriod} options={[{ value: ALL, label: a('allStatus') }, ...active.map((p) => ({ value: p.id, label: p.period_name || `P${p.period_number}` }))]} />
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={a('completion_noTeachers')}
          keyExtractor={(x: TeacherCompletionStatus) => x.staff_id}
          renderItem={(x: TeacherCompletionStatus) => (
            <View className="gap-2 px-4 py-3">
              <Text className="font-medium">{x.staff_name}</Text>
              <View className="flex-row flex-wrap gap-2">
                {display.map((dp) => {
                  const p = x.periods.find((pp) => pp.period_id === dp.id);
                  const assigned = !!p?.assigned;
                  return (
                    <Pressable
                      key={dp.id}
                      disabled={!assigned}
                      onPress={() => setCell({ period: dp.name, teacher: x.staff_name, courses: p?.courses ?? [] })}
                      className="border-border min-w-14 items-center gap-0.5 rounded-md border px-2 py-1">
                      <Text className="text-muted-foreground text-[10px]">{dp.name}</Text>
                      {!assigned ? (
                        <Text className="text-muted-foreground">—</Text>
                      ) : p?.completed ? (
                        <Icon as={Check} className="size-5 text-green-600" />
                      ) : (
                        <Icon as={X} className="size-5 text-red-500" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      </View>
      <Dialog open={!!cell} onOpenChange={(o) => !o && setCell(null)}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{cell ? `${cell.period} – ${cell.teacher}` : ''}</DialogTitle>
          </DialogHeader>
          <View className="gap-2">
            {cell?.courses.length ? (
              cell.courses.map((c, i) => (
                <View key={i} className={i > 0 ? 'border-border border-t pt-2' : ''}>
                  <Text className="font-semibold">{c.subject_name || '—'}</Text>
                  <Text className="text-muted-foreground text-xs">{`${cell.period} – ${c.section_name || '?'} – ${cell.teacher}`}</Text>
                </View>
              ))
            ) : (
              <Text>{cell ? `${cell.period} – ${cell.teacher}` : ''}</Text>
            )}
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}
