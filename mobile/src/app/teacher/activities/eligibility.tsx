import type { EligibilityCode } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { todayYmd } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminActivities, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const CODES: { code: EligibilityCode; key: string; on: string }[] = [
  { code: 'PASSING', key: 'columnPassing', on: 'bg-green-600 border-green-600' },
  { code: 'BORDERLINE', key: 'columnBorderline', on: 'bg-yellow-500 border-yellow-500' },
  { code: 'FAILING', key: 'columnFailing', on: 'bg-red-500 border-red-500' },
  { code: 'INCOMPLETE', key: 'columnIncomplete', on: 'bg-gray-500 border-gray-500' },
];

/** Today's classes, then each student's activity eligibility for the chosen class (web: /teacher/activities/eligibility). */
export default function TeacherEligibility() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.activitiesEligibility.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const { campusId } = useCampus();
  const { class: classId } = useLocalSearchParams<{ class?: string }>();
  const [today] = useState(todayYmd);
  const schedule = useApi(staffId ? ['teacher', 'schedule', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherSchedule(s as string, d as string));
  const data = useApi(classId ? ['teacher', 'eligibility', classId, today, campusId ?? 'school'] : null, async ([, , c, d]) => {
    const [roster, elig] = await Promise.all([adminTimetable.classAttendance(c as string, d as string), adminActivities.eligibility(c as string, d as string, campusId)]);
    if (!roster.success) return { ...roster, data: undefined };
    const byStudent = new Map((elig.data ?? []).map((e) => [e.student_id, e.eligibility_code]));
    return { success: true, data: (roster.data ?? []).map((r) => ({ student_id: r.student_id, name: r.student_name || k('unknownStudent'), number: r.student_number || '', code: (byStudent.get(r.student_id) ?? 'PASSING') as EligibilityCode })) };
  });
  const [edits, setEdits] = useState<Record<string, EligibilityCode>>({});
  const [editsFor, setEditsFor] = useState('');
  if (editsFor !== (classId ?? '')) {
    setEditsFor(classId ?? '');
    setEdits({});
  }
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const classes = (schedule.data ?? []).filter((c) => !c.is_break);
  const cls = classes.find((c) => c.id === classId) ?? null;
  const rows = (data.data ?? []).map((r) => ({ ...r, code: edits[r.student_id] ?? r.code }));
  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((r) => r.name.toLowerCase().includes(term) || r.number.toLowerCase().includes(term)) : rows;
  const loc = i18n.language === 'ar' ? 'ar' : 'en';

  async function save() {
    if (!classId) return toast.error(k('errorNoClassSelected'));
    setSaving(true);
    const r = await adminActivities.saveEligibility({ course_period_id: classId, school_date: today, campus_id: campusId, records: rows.map((x) => ({ student_id: x.student_id, eligibility_code: x.code })) });
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('failedToSaveEligibility'));
    toast.success(k('eligibilitySavedSuccessfully'));
    setEdits({});
    data.mutate();
  }

  if (!classId) {
    const nowStr = new Date().toTimeString().slice(0, 5);
    return (
      <>
        <Stack.Screen options={{ title: k('enterEligibility') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => schedule.mutate()} />}>
          <Text variant="muted">{k('selectClassHint')}</Text>
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="flex-row items-center gap-3 py-4">
              <Icon as={Calendar} className="size-6 text-blue-600" />
              <View>
                <Text className="font-semibold text-blue-900 dark:text-blue-200">{new Date().toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                <Text className="text-sm text-blue-700 dark:text-blue-300">{k('classesScheduled', { count: classes.length })}</Text>
              </View>
            </CardContent>
          </Card>
          {schedule.isLoading ? (
            <LoadingList rows={4} />
          ) : !classes.length ? (
            <Card>
              <CardContent className="items-center py-12">
                <Text className="mb-2 text-xl font-semibold">{k('noClassesToday')}</Text>
                <Text className="text-muted-foreground text-center">{k('noClassesTodayHint')}</Text>
              </CardContent>
            </Card>
          ) : (
            classes.map((c) => {
              const live = c.start_time <= nowStr && nowStr < c.end_time;
              return (
                <Pressable key={c.id} onPress={() => router.setParams({ class: c.id })} accessibilityRole="button">
                  <Card className={cn('border-2', live ? 'border-green-500' : 'border-border')}>
                    <CardContent className="flex-row items-center gap-3 p-4">
                      <View className="size-14 items-center justify-center rounded-lg bg-blue-600">
                        <Text className="text-xs text-white">{k('period')}</Text>
                        <Text className="text-xl font-bold text-white">{String(c.period_number)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold">{c.subject_name || k('unknownSubject')}</Text>
                        <Text className="text-muted-foreground text-sm">{`${c.section_name || k('unknownSection')} • ${c.grade_name || k('unknownGrade')}`}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-semibold text-blue-600">{`${c.start_time?.slice(0, 5)} - ${c.end_time?.slice(0, 5)}`}</Text>
                        {c.room_number ? <Text className="text-muted-foreground text-xs">{k('room', { room: c.room_number })}</Text> : null}
                      </View>
                    </CardContent>
                  </Card>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: k('enterEligibility') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-24" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        {cls ? (
          <Text className="font-semibold">
            {k('halfDayAmHeader', { subject: cls.subject_name ?? '', section: cls.section_name ?? '', firstName: me.status === 'ready' ? (me.me.profile.first_name ?? '') : '', lastName: me.status === 'ready' ? (me.me.profile.last_name ?? '') : '' })}
          </Text>
        ) : null}
        <Text className="text-sm font-semibold">{k('studentsWereFound', { count: shown.length })}</Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={k('searchEllipsis')} />
        {data.isLoading ? (
          <LoadingList rows={5} />
        ) : !shown.length ? (
          <Text className="text-muted-foreground py-8 text-center">{k('noStudentsFound')}</Text>
        ) : (
          shown.map((r) => (
            <Card key={r.student_id}>
              <CardContent className="gap-2 p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium">{r.name}</Text>
                  <Text className="text-muted-foreground text-xs">{r.number}</Text>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {CODES.map((c) => {
                    const on = r.code === c.code;
                    return (
                      <Pressable
                        key={c.code}
                        onPress={() => setEdits((e) => ({ ...e, [r.student_id]: c.code }))}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        className={cn('rounded-md border px-2.5 py-1.5', on ? c.on : 'border-border')}>
                        <Text className={cn('text-xs font-medium', on && 'text-white')}>{k(c.key)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 flex-row gap-2 border-t px-4 pt-3 pb-6">
        <Button variant="outline" onPress={() => router.setParams({ class: '' })}>
          <Text>{t('common.back')}</Text>
        </Button>
        <Button className="flex-1" onPress={save} disabled={saving || !rows.length}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{k('save')}</Text>
        </Button>
      </View>
    </>
  );
}
