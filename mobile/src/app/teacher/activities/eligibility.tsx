import type { EligibilityCode } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, CalendarX, Check, Save, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { todayYmd } from '@/components/app/date-field';
import { HeroCard, Initials, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminActivities, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const CODES: { code: EligibilityCode; key: string; on: string }[] = [
  { code: 'PASSING', key: 'columnPassing', on: 'bg-success border-success' },
  { code: 'BORDERLINE', key: 'columnBorderline', on: 'bg-warning border-warning' },
  { code: 'FAILING', key: 'columnFailing', on: 'bg-destructive border-destructive' },
  { code: 'INCOMPLETE', key: 'columnIncomplete', on: 'bg-muted-foreground border-muted-foreground' },
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
    // A failed eligibility load must not show (and then save) everyone as PASSING.
    if (!elig.success) return { ...elig, data: undefined };
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
          <Text className="text-muted-foreground text-sm">{k('selectClassHint')}</Text>
          <HeroCard>
            <View className="flex-row items-center gap-3">
              <View className="size-11 items-center justify-center rounded-full bg-white/15">
                <Icon as={Calendar} className="size-5 text-white" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-white">{new Date().toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                <Text className="text-sm text-white/80">{k('classesScheduled', { count: classes.length })}</Text>
              </View>
            </View>
          </HeroCard>
          {schedule.isLoading ? (
            <LoadingList rows={4} />
          ) : !classes.length ? (
            <EmptyState icon={CalendarX} title={k('noClassesToday')} body={k('noClassesTodayHint')} />
          ) : (
            <Panel>
              {classes.map((c, i) => {
                const live = c.start_time <= nowStr && nowStr < c.end_time;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.setParams({ class: c.id })}
                    accessibilityRole="button"
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < classes.length - 1 && 'border-info-soft dark:border-border border-b', live && 'bg-success-soft')}>
                    <View className={cn('size-12 items-center justify-center rounded-xl', live ? 'bg-success' : 'bg-brand dark:bg-brand-secondary')}>
                      <Text className="text-[10px] text-white/85">{k('period')}</Text>
                      <Text className="text-base font-bold text-white">{String(c.period_number)}</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{c.subject_name || k('unknownSubject')}</Text>
                      <Text className="text-muted-foreground text-xs">{`${c.section_name || k('unknownSection')} • ${c.grade_name || k('unknownGrade')}`}</Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{`${c.start_time?.slice(0, 5)} - ${c.end_time?.slice(0, 5)}`}</Text>
                      {c.room_number ? <Text className="text-muted-foreground text-[11px]">{k('room', { room: c.room_number })}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </Panel>
          )}
        </ScrollView>
      </>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: k('enterEligibility') }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        {cls ? (
          <Text className="font-semibold">
            {k('halfDayAmHeader', { subject: cls.subject_name ?? '', section: cls.section_name ?? '', firstName: me.status === 'ready' ? (me.me.profile.first_name ?? '') : '', lastName: me.status === 'ready' ? (me.me.profile.last_name ?? '') : '' })}
          </Text>
        ) : null}
        <Text className="text-muted-foreground text-sm">{k('studentsWereFound', { count: shown.length })}</Text>
        <SearchBar value={q} onChangeText={setQ} placeholder={k('searchEllipsis')} />
        {data.isLoading ? (
          <LoadingList rows={5} />
        ) : data.error ? (
          <ErrorState message={data.error.message} onRetry={() => data.mutate()} />
        ) : !shown.length ? (
          <EmptyState icon={Users} title={k('noStudentsFound')} />
        ) : (
          <Panel>
            {shown.map((r, i) => (
              <View key={r.student_id} className={cn('gap-2.5 px-4 py-3', i < shown.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <View className="flex-row items-center gap-3">
                  <Initials name={r.name} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{r.name}</Text>
                    {r.number ? <Text className="text-muted-foreground text-xs">{r.number}</Text> : null}
                  </View>
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
                        className={cn('flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70', on ? c.on : 'border-info-soft dark:border-border bg-card')}>
                        {on ? <Icon as={Check} strokeWidth={3} className="size-3 text-white" /> : null}
                        <Text className={cn('text-xs font-semibold', on ? 'text-white' : 'text-muted-foreground')}>{k(c.key)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
      <StickyActions>
        <Button variant="outline" onPress={() => router.setParams({ class: '' })}>
          <Text>{t('common.back')}</Text>
        </Button>
        <Button className="flex-1" onPress={save} disabled={saving || !rows.length}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{k('save')}</Text>
        </Button>
      </StickyActions>
    </View>
  );
}
