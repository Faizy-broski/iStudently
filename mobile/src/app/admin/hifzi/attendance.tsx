import type { HifziAttendanceStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { CheckCheck, Save } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { CirclePicker, enrollmentName, NoCircles, NoRoster, useHifziCircles, useHifziRoster, useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUSES: HifziAttendanceStatus[] = ['present', 'late', 'absent_excused', 'absent_unexcused', 'permitted', 'on_leave'];
const STATUS_COLORS: Record<HifziAttendanceStatus, string> = {
  present: 'bg-success-soft border-success  ',
  late: 'bg-warning-soft border-warning  ',
  absent_excused: 'bg-info-soft border-brand  ',
  absent_unexcused: 'bg-destructive-soft border-destructive  ',
  permitted: 'bg-chart-6/10 border-chart-6  ',
  on_leave: 'bg-muted border-border  ',
};

/** Mark a circle's attendance for a day; re-opening a past date edits what was saved (web: /admin/hifzi/attendance). */
export default function HifziAttendance() {
  const { h, a } = useHz('attendance');
  const toast = useToast();
  const { campusId } = useCampus();
  const circles = useHifziCircles();
  const list = circles.data ?? [];
  const [picked, setPicked] = useState('');
  const circleId = list.some((c) => c.id === picked) ? picked : (list[0]?.id ?? '');
  const today = todayYmd();
  const [date, setDate] = useState(today);
  const roster = useHifziRoster(circleId || null);
  const saved = useApi(circleId ? ['admin', 'hifzi-attendance', circleId, date, campusId ?? 'school'] : null, ([, , c, d]) => adminHifzi.attendance(c as string, d as string, campusId));
  // Local edits on top of: saved status, else "present".
  const [edits, setEdits] = useState<Record<string, HifziAttendanceStatus>>({});
  const [editsKey, setEditsKey] = useState('');
  const key = `${circleId}|${date}`;
  if (editsKey !== key) {
    setEditsKey(key);
    setEdits({});
  }
  const [saving, setSaving] = useState(false);

  const rows = roster.data ?? [];
  const savedRows = saved.data ?? [];
  const savedBy = new Map(savedRows.map((r) => [r.student_id, r.status]));
  const status = (studentId: string): HifziAttendanceStatus => edits[studentId] ?? savedBy.get(studentId) ?? 'present';

  async function save() {
    setSaving(true);
    try {
      const res = await adminHifzi.markAttendanceBulk(circleId, date, rows.map((e) => ({ student_id: e.student_id, status: status(e.student_id) })), campusId);
      if (!res.success) return toast.error(res.error || a('hz_save_failed'));
      toast.success(h('save'));
      setEdits({});
      saved.mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (roster.mutate(), saved.mutate())} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : circles.error ? (
          <ErrorState message={circles.error.message} onRetry={() => circles.mutate()} />
        ) : !list.length ? (
          <NoCircles />
        ) : (
          <>
            <CirclePicker circles={list} value={circleId} onChange={setPicked} />
            <DateField value={date} onChange={(d) => d && setDate(d)} max={today} />
            {roster.isLoading || saved.isLoading ? (
              <LoadingList rows={4} />
            ) : !rows.length ? (
              <NoRoster circleId={circleId} />
            ) : (
              <>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onPress={() => setEdits(Object.fromEntries(rows.map((e) => [e.student_id, 'present' as const])))}>
                    <Icon as={CheckCheck} className="text-foreground size-4" />
                    <Text>{h('markAll')}</Text>
                  </Button>
                  {savedRows.length ? <Text className="text-xs text-warning">{h('alreadyRecorded')}</Text> : null}
                </View>
                {rows.map((e) => (
                  <Card key={e.id}>
                    <CardContent className="gap-2 pt-3 pb-3">
                      <View className="flex-row items-center gap-3">
                        <Initials name={enrollmentName(e) || '?'} />
                        <Text className="flex-1 text-sm font-semibold">{enrollmentName(e)}</Text>
                      </View>
                      <View className="flex-row flex-wrap gap-1.5">
                        {STATUSES.map((s) => {
                          const on = status(e.student_id) === s;
                          return (
                            <Pressable
                              key={s}
                              onPress={() => setEdits((p) => ({ ...p, [e.student_id]: s }))}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                              className={cn('rounded-md border px-2 py-1', on ? STATUS_COLORS[s] : 'border-transparent')}>
                              <Text className={cn('text-xs', !on && 'text-muted-foreground')}>{h(s)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </CardContent>
                  </Card>
                ))}
                <Button onPress={save} disabled={saving || !rows.length}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{h('save')}</Text>
                </Button>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
