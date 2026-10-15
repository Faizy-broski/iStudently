import type { ClassAttendanceStatus } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminEmployees, adminGrades, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Row = { student_id: string; student_name: string; student_number: string; status: ClassAttendanceStatus; remarks?: string };
const CHOICES: { status: ClassAttendanceStatus; key: string; on: string }[] = [
  { status: 'absent', key: 'absentColumn', on: 'bg-red-500 border-red-500' },
  { status: 'present', key: 'presentColumn', on: 'bg-green-600 border-green-600' },
  { status: 'late', key: 'tardyColumn', on: 'bg-yellow-500 border-yellow-500' },
];

/**
 * Take class attendance on behalf of a teacher (web: /admin/teacher-programs/attendance). In the
 * teacher app (web: /teacher/attendance and /teacher/attendance/take-attendance) the teacher is the
 * signed-in one, a class can be passed as `class`, editing is limited to the marking period's posting
 * window, and all students can be marked present or absent at once.
 */
export default function AdminTakeAttendance() {
  const { t } = useTranslation();
  const a = (k: string) => t(`teacherPrograms.attendance.${k}`);
  const ta = (k: string, o?: Record<string, unknown>) => t(`teacherPages.takeAttendance.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const { me } = useSession();
  const self = me.status === 'ready' && me.me.profile.role === 'teacher' ? (me.me.profile.staff_id ?? null) : null;
  const params = useLocalSearchParams<{ class?: string }>();
  const [teacherId, setTeacherIdRaw] = useState(self ?? '');
  const [date, setDate] = useState(todayYmd);
  const [classId, setClassId] = useState(params.class ?? '');
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const teachers = useApi(self ? null : ['admin', 'tp-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { page: 1, limit: 500 }));
  // Teachers edit only inside the marking period's posting window, never in the future (web: allowEdit).
  const mps = useApi(self ? ['teacher', 'marking-periods', campusId ?? 'school'] : null, () => adminGrades.markingPeriods(campusId));
  const mp = (mps.data ?? []).find((m) => m.start_date && m.end_date && date >= m.start_date && date <= m.end_date && (m.mp_type === 'QTR' || m.mp_type === 'PRO'));
  const allowEdit = !self || (!!mp && date <= todayYmd() && (!mp.post_start_date || !mp.post_end_date || (date >= mp.post_start_date && date <= mp.post_end_date)));
  const schedule = useApi(teacherId ? ['admin', 'teacher-schedule', teacherId, date] : null, ([, , tid, d]) => adminTimetable.teacherSchedule(tid as string, d as string));
  const classes = schedule.data ?? [];
  const activeClass = classId && classes.some((c) => c.id === classId) ? classId : (classes[0]?.id ?? '');
  const records = useApi(activeClass ? ['admin', 'class-attendance', activeClass, date] : null, ([, , cid, d]) => adminTimetable.classAttendance(cid as string, d as string));

  useEffect(() => {
    if (!records.data) return;
    setRows(records.data.map((r) => ({ student_id: r.student_id, student_name: r.student_name || 'Unknown Student', student_number: r.student_number || '', status: r.status, remarks: r.remarks ?? undefined })));
    setDirty(false);
  }, [records.data]);

  const setTeacherId = (id: string) => {
    setTeacherIdRaw(id);
    setClassId('');
    setRows([]);
  };
  const update = (sid: string, patch: Partial<Row>) => {
    if (!allowEdit) return;
    setRows((p) => p.map((r) => (r.student_id === sid ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const markAll = (status: ClassAttendanceStatus) => {
    if (!allowEdit) return;
    setRows((p) => p.map((r) => ({ ...r, status })));
    setDirty(true);
    if (status === 'present') toast.success(ta('markedAllPresent'));
    else toast.info(ta('markedAllAbsent'));
  };

  async function save() {
    if (!activeClass) return toast.error(a('noClassSelected'));
    if (!allowEdit) return toast.error(ta('cannotEditDate'));
    setSaving(true);
    try {
      const res = await adminTimetable.bulkUpdateAttendance(activeClass, date, rows.map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks })));
      if (!res.success) return toast.error(res.error || a('saveFailed'));
      setDirty(false);
      toast.success(a('saveSuccess'));
    } finally {
      setSaving(false);
    }
  }

  const sel = classes.find((c) => c.id === activeClass);
  const stats = { total: rows.length, present: rows.filter((r) => r.status === 'present').length, absent: rows.filter((r) => r.status === 'absent').length, late: rows.filter((r) => r.status === 'late').length };
  const stat = (n: number, label: string, cls: string) => (
    <View className={cn('flex-1 items-center rounded-lg border py-2', cls)}>
      <Text className="text-xl font-bold">{n}</Text>
      <Text className="text-xs">{label}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: a('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              {self ? null : (
                <Picker
                  value={teacherId}
                  onChange={setTeacherId}
                  placeholder={teachers.isLoading ? t('teacherPrograms.selectorLoadingTeachers') : t('teacherPrograms.selectorTeacherPlaceholder')}
                  options={(teachers.data ?? []).map((s) => ({ value: s.id, label: shortName(s.profile) || s.id }))}
                />
              )}
              <DateField label={a('dateLabel')} value={date} onChange={(d) => d && setDate(d)} />
              <View className="flex-row items-center gap-2">
                <Picker
                  className="flex-1"
                  value={activeClass}
                  onChange={setClassId}
                  placeholder={schedule.isLoading ? a('loadingClasses') : a('classPlaceholder')}
                  options={classes.map((c) => ({ value: c.id, label: `P${c.period_number} — ${c.subject_name ?? ''} · ${c.section_name ?? ''}` }))}
                />
                <Pressable onPress={() => records.mutate()} disabled={!activeClass} className="border-border rounded-md border p-2.5" accessibilityLabel="Refresh">
                  <Icon as={RefreshCw} className="text-foreground size-4" />
                </Pressable>
              </View>
              {sel ? (
                <Text variant="muted" className="text-sm">
                  {`${sel.subject_name ?? ''} • ${sel.section_name ?? ''} · P${sel.period_number} · ${sel.start_time?.substring(0, 5)} - ${sel.end_time?.substring(0, 5)}${sel.room_number ? ` · ${sel.room_number}` : ''}`}
                </Text>
              ) : null}
              {self && activeClass ? (
                <View className={cn('gap-1 rounded-lg border p-3', allowEdit ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20')}>
                  <Text className="text-sm font-medium">{`${allowEdit ? ta('editableAttendance') : ta('readOnlyAttendance')} · ${allowEdit ? ta('editMode') : ta('viewOnly')}`}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {mp?.post_start_date && mp?.post_end_date ? ta('postingWindow', { start: mp.post_start_date, end: mp.post_end_date }) : ta('postingWindowHint')}
                  </Text>
                  {mp ? <Text className="text-muted-foreground text-xs">{ta('markingPeriodLabel', { type: mp.mp_type })}</Text> : null}
                </View>
              ) : null}
              {teacherId && rows.length ? (
                <View className="flex-row gap-2">
                  {stat(stats.total, a('total'), 'border-border')}
                  {stat(stats.present, a('present'), 'border-green-200 bg-green-50')}
                  {stat(stats.absent, a('absent'), 'border-red-200 bg-red-50')}
                  {stat(stats.late, a('late'), 'border-yellow-200 bg-yellow-50')}
                  {self ? stat(stats.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0, `${ta('rate')} %`, 'border-blue-200 bg-blue-50') : null}
                </View>
              ) : null}
              {self && rows.length && allowEdit ? (
                <View className="flex-row gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('present')}>
                    <Text>{t('app.te_mark_all_present')}</Text>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('absent')}>
                    <Text>{t('app.te_mark_all_absent')}</Text>
                  </Button>
                </View>
              ) : null}
            </View>
          }
          items={teacherId ? (activeClass ? (records.data ? rows : undefined) : []) : []}
          isLoading={records.isLoading || schedule.isLoading}
          error={records.error}
          onRefresh={() => records.mutate()}
          emptyTitle={teacherId ? a('noStudents') : a('selectPrompt')}
          keyExtractor={(r) => r.student_id}
          renderItem={(r, i) => (
            <View className="gap-2 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-medium">{r.student_name}</Text>
                  <Text className="text-muted-foreground text-xs">{`#${i + 1}${r.student_number ? ` · ${r.student_number}` : ''}`}</Text>
                </View>
              </View>
              <View className="flex-row gap-2">
                {CHOICES.map((c) => {
                  const on = r.status === c.status;
                  return (
                    <Pressable
                      key={c.status}
                      onPress={() => update(r.student_id, { status: c.status })}
                      disabled={!allowEdit}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      className={cn('flex-1 items-center rounded-md border py-2', on ? c.on : 'border-border')}>
                      <Text className={cn('text-sm font-medium', on && 'text-white')}>{a(c.key)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input value={r.remarks ?? ''} onChangeText={(v) => update(r.student_id, { remarks: v })} editable={allowEdit} placeholder={a('commentPlaceholder')} className="h-9" />
            </View>
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={save} disabled={saving || !dirty || !activeClass || !allowEdit}>
            <Text>{saving ? a('saving') : dirty ? t('teacherPrograms.attendance.saveWithCounts', { present: stats.present, absent: stats.absent }) : `${a('saved')} · ${a('noChanges')}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
