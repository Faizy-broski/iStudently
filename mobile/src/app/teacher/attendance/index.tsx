import type { ClassAttendanceStatus } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, BookOpen, Calendar, CheckCircle, Clock, RefreshCw, Save, UserCheck, UserX, XCircle, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { HeaderButton, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import i18n from '@/i18n';
import { adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '');
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

const CYCLE: Record<ClassAttendanceStatus, ClassAttendanceStatus> = { present: 'absent', absent: 'late', late: 'present', excused: 'present' };
const TONE: Record<ClassAttendanceStatus, { bar: string; soft: string; fg: string }> = {
  present: { bar: 'bg-success', soft: 'bg-success-soft', fg: 'text-success' },
  absent: { bar: 'bg-destructive', soft: 'bg-destructive-soft', fg: 'text-destructive' },
  late: { bar: 'bg-warning', soft: 'bg-warning-soft', fg: 'text-warning' },
  excused: { bar: 'bg-info', soft: 'bg-info-soft', fg: 'text-brand-secondary' },
};

type Filter = ClassAttendanceStatus | 'all';

/**
 * Today's classes and quick attendance marking (web: /teacher/attendance). Without `class` it lists
 * today's classes; with `class` (a timetable entry id) it marks that class for today. Taking
 * attendance for another date with marking-period rules is /teacher/attendance/take-attendance.
 */
export default function TeacherQuickAttendance() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.attendance.${key}`, o);
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const params = useLocalSearchParams<{ class?: string }>();
  const classId = params.class ?? null;
  const [today] = useState(localToday);

  const schedule = useApi(staffId ? ['teacher', 'schedule', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherSchedule(s as string, d as string));
  const classes = (schedule.data ?? []).filter((c) => !c.is_break);

  if (!classId) {
    const now = nowHHMM();
    return (
      <>
        <Stack.Screen options={{ title: k('pageTitle') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={() => schedule.mutate()} />}>
          <Text variant="muted">{k('selectClassHint')}</Text>
          <Panel className="flex-row items-center gap-3 p-4">
            <Icon as={Calendar} className="text-brand dark:text-brand-secondary size-6" />
            <View className="flex-1">
              <Text className="font-semibold">{`${new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { weekday: 'long' })}, ${formatDate(today)}`}</Text>
              <Text variant="muted" className="text-xs">
                {k('classesScheduledCount', { count: classes.length })}
              </Text>
            </View>
          </Panel>
          {schedule.isLoading ? (
            <LoadingList rows={4} />
          ) : schedule.error ? (
            <ErrorState message={schedule.error.message} onRetry={() => schedule.mutate()} />
          ) : !classes.length ? (
            <EmptyState icon={Calendar} title={k('noClassesToday')} body={k('noClassesTodayHint')} />
          ) : (
            classes.map((c) => {
              const inProgress = c.start_time <= now && now < c.end_time;
              const done = c.end_time < now;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/teacher/attendance', params: { class: c.id } })}
                  accessibilityRole="button"
                  className={cn('bg-card flex-row items-center gap-3 rounded-2xl border-2 p-4 active:opacity-80', inProgress ? 'border-success bg-success-soft' : done ? 'border-border' : 'border-info-soft')}>
                  <View className={cn('size-14 items-center justify-center rounded-xl', inProgress ? 'bg-success' : 'bg-brand dark:bg-brand-secondary')}>
                    <Text className="text-2xs text-white">{k('period')}</Text>
                    <Text className="text-xl font-bold text-white">{String(c.period_number)}</Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-base font-bold" numberOfLines={1}>
                        {c.subject_name || k('unknownSubject')}
                      </Text>
                      {inProgress ? <StatusChip label={k('now')} tone="success" /> : done ? <StatusChip label={k('completed')} tone="muted" /> : null}
                    </View>
                    <Text variant="muted" className="text-xs" numberOfLines={1}>
                      {[c.section_name || k('unknownSection'), c.grade_name || k('unknownGrade')].join(' • ')}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-brand dark:text-brand-secondary text-sm font-semibold">{`${hhmm(c.start_time)} - ${hhmm(c.end_time)}`}</Text>
                    {c.room_number ? (
                      <Text variant="muted" className="text-xs">
                        {k('roomLabel', { room: c.room_number })}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </>
    );
  }

  return <MarkClass classId={classId} date={today} info={classes.find((c) => c.id === classId) ?? null} />;
}

function MarkClass({ classId, date, info }: { classId: string; date: string; info: { subject_name: string | null; section_name: string | null; grade_name: string | null; period_number: number; start_time: string; end_time: string; room_number: string | null } | null }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.attendance.${key}`, o);
  const toast = useToast();
  const records = useApi(['teacher', 'class-attendance', classId, date], ([, , c, d]) => adminTimetable.classAttendance(c as string, d as string));
  const [edits, setEdits] = useState<Record<string, ClassAttendanceStatus>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);

  const rows = (records.data ?? []).map((r) => ({ ...r, student_name: r.student_name || k('unknownStudent'), student_number: r.student_number || '', status: edits[r.student_id] ?? r.status }));
  const changed = Object.keys(edits).length > 0;
  const count = (s: ClassAttendanceStatus) => rows.filter((r) => r.status === s).length;
  const stats = { total: rows.length, present: count('present'), absent: count('absent'), late: count('late') };
  const rate = rows.length ? Math.round(((stats.present + stats.late) / rows.length) * 100) : 0;
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => (!q || r.student_name.toLowerCase().includes(q) || r.student_number.toLowerCase().includes(q)) && (filter === 'all' || r.status === filter));

  const set = (studentId: string, status: ClassAttendanceStatus) => setEdits((e) => ({ ...e, [studentId]: status }));
  const markAll = (status: ClassAttendanceStatus) => {
    setEdits(Object.fromEntries(rows.map((r) => [r.student_id, status])));
    if (status === 'present') toast.success(k('markedAllPresent'));
    else toast.info(k('markedAllAbsent'));
  };
  const reload = () => {
    setEdits({});
    records.mutate();
  };

  async function save() {
    setSaving(true);
    const res = await adminTimetable.bulkUpdateAttendance(
      classId,
      date,
      rows.map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks ?? undefined }))
    );
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || k('saveAttendanceFailed'));
      return;
    }
    toast.success(k('attendanceSaved'));
    setEdits({});
    records.mutate();
  }

  const title = info ? `${info.subject_name || k('unknownSubject')} • ${info.section_name || k('unknownSection')} • ${k('periodLabel', { number: info.period_number })}` : '';

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle'), headerRight: () => <HeaderButton icon={RefreshCw} label={k('refresh')} onPress={reload} /> }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-8">
        {title ? <Text variant="muted">{title}</Text> : null}
        {info ? (
          <Panel className="flex-row items-center gap-3 p-4">
            <Icon as={BookOpen} className="text-brand dark:text-brand-secondary size-5" />
            <View className="flex-1">
              <Text className="font-semibold">{info.subject_name || k('unknownSubject')}</Text>
              <Text variant="muted" className="text-xs">{`${info.section_name || k('unknownSection')} - ${info.grade_name || k('unknownGrade')}`}</Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-medium">{`${hhmm(info.start_time)} - ${hhmm(info.end_time)}`}</Text>
              {info.room_number ? (
                <Text variant="muted" className="text-xs">
                  {k('roomLabel', { room: info.room_number })}
                </Text>
              ) : null}
            </View>
          </Panel>
        ) : null}

        {records.isLoading ? (
          <LoadingList rows={6} />
        ) : records.error ? (
          <ErrorState message={records.error.message || k('loadAttendanceFailed')} onRetry={reload} />
        ) : (
          <>
            <View className="flex-row gap-2">
              <MiniStat value={String(stats.total)} label={k('total')} />
              <MiniStat value={String(stats.present)} label={k('present')} tone="present" />
              <MiniStat value={String(stats.absent)} label={k('absent')} tone="absent" />
              <MiniStat value={String(stats.late)} label={k('late')} tone="late" />
              <MiniStat value={`${rate}%`} label={k('rate')} tone="excused" />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('present')}>
                <Icon as={UserCheck} className="size-4" />
                <Text>{k('allPresent')}</Text>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('absent')}>
                <Icon as={UserX} className="size-4" />
                <Text>{k('allAbsent')}</Text>
              </Button>
            </View>
            <SearchBar value={query} onChangeText={setQuery} placeholder={k('searchPlaceholder')} />
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: k('all') },
                { value: 'present', label: k('present') },
                { value: 'absent', label: k('absent') },
                { value: 'late', label: k('late') },
              ]}
            />
            <Text variant="muted" className="text-center text-xs">
              {k('cycleInstruction')}
            </Text>
            {!rows.length ? (
              <EmptyState icon={AlertCircle} title={k('noStudentsFound')} body={k('noStudentsFoundHint')} />
            ) : (
              shown.map((s, i) => {
                const tone = TONE[s.status];
                return (
                  <Pressable key={s.student_id} onPress={() => set(s.student_id, CYCLE[s.status])} accessibilityRole="button" accessibilityLabel={s.student_name} className={cn('flex-row overflow-hidden rounded-2xl active:opacity-80', tone.soft)}>
                    <View className={cn('w-1.5', tone.bar)} />
                    <View className="flex-1 flex-row items-center gap-3 p-3">
                      <View className="bg-muted size-8 items-center justify-center rounded-full">
                        <Text className="text-sm font-medium">{String(i + 1)}</Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-medium" numberOfLines={1}>
                          {s.student_name}
                        </Text>
                        {s.student_number ? (
                          <Text variant="muted" className="text-xs">
                            {s.student_number}
                          </Text>
                        ) : null}
                      </View>
                      <StatusButton icon={CheckCircle} on={s.status === 'present'} tone="present" label={k('markPresent')} onPress={() => set(s.student_id, 'present')} />
                      <StatusButton icon={XCircle} on={s.status === 'absent'} tone="absent" label={k('markAbsent')} onPress={() => set(s.student_id, 'absent')} />
                      <StatusButton icon={Clock} on={s.status === 'late'} tone="late" label={k('markLate')} onPress={() => set(s.student_id, 'late')} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
      {rows.length ? (
        <StickyActions>
          <Button size="lg" className="flex-1" variant={changed ? 'default' : 'outline'} disabled={saving || !changed} onPress={save}>
            <Icon as={changed ? Save : CheckCircle} className={cn('size-4', changed && 'text-white')} />
            <Text>{saving ? k('savingAttendance') : changed ? k('saveAttendanceWithCounts', { present: stats.present, absent: stats.absent }) : k('allChangesSaved')}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}

function MiniStat({ value, label, tone }: { value: string; label: string; tone?: ClassAttendanceStatus }) {
  return (
    <View className={cn('flex-1 items-center rounded-xl border px-1 py-2', tone ? cn(TONE[tone].soft, 'border-transparent') : 'border-border bg-card')}>
      <Text className={cn('text-lg font-bold', tone && TONE[tone].fg)} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className={cn('text-2xs', tone ? TONE[tone].fg : 'text-muted-foreground')} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatusButton({ icon, on, tone, label, onPress }: { icon: LucideIcon; on: boolean; tone: ClassAttendanceStatus; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} className={cn('rounded-lg p-2', on && 'bg-card')}>
      <Icon as={icon} className={cn('size-5', on ? TONE[tone].fg : 'text-muted-foreground')} />
    </Pressable>
  );
}

