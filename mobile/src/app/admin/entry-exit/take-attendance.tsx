import type { RecordType, TimetableSlot } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, parseYmd, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { useAttendanceScope } from '@/features/admin/attendance';
import { useCheckpoints } from '@/features/admin/entry-exit';
import { shortName } from '@/features/admin/people';
import { adminEmployees, adminEntryExit, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Status = 'absent' | 'present' | 'late';
type Row = { student_id: string; student_name: string; student_number: string; status: Status; remarks: string };
type Teacher = { id: string; name: string; number: string };

/** JS getDay() (0=Sun) to the timetable's day (0=Mon … 6=Sun). */
const timetableDay = (ymd: string) => {
  const js = (parseYmd(ymd) ?? new Date()).getDay();
  return js === 0 ? 6 : js - 1;
};

/** Class attendance for a teacher's course that also logs present students at a checkpoint (web: /admin/entry-exit/take-attendance). */
export default function EntryExitTakeAttendance() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.take_attendance.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const checkpoints = useCheckpoints(schoolId);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [checkpointId, setCheckpointId] = useState('all');
  const [recordType, setRecordType] = useState<RecordType>('ENTRY');
  const [date, setDate] = useState(todayYmd);
  const [entryId, setEntryId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const teachers = useApi(['admin', 'ee-ta-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { page: 1, limit: 1000 }));
  const teacherId = teacher?.id ?? null;
  const timetable = useApi(teacherId && yearId ? ['admin', 'ee-ta-timetable', teacherId, yearId] : null, ([, , tid, y]) => adminTimetable.byTeacher(tid as string, y as string));

  const courses = new Map<string, { key: string; label: string; gradeName: string; entries: TimetableSlot[] }>();
  for (const e of timetable.data ?? []) {
    const k = `${e.section_id}|${e.subject_id}`;
    if (!courses.has(k)) {
      const sectionName = e.section_name || e.section?.name || '';
      const subjectName = e.subject_name || e.subject?.name || '';
      courses.set(k, { key: k, label: subjectName ? `${subjectName} (${sectionName})` : sectionName, gradeName: e.grade_name || e.section?.grade?.name || e.section?.grade_level?.name || '', entries: [] });
    }
    courses.get(k)!.entries.push(e);
  }
  const course = courses.get(courseKey) ?? null;
  const dow = timetableDay(date);
  const periodOptions = course ? (course.entries.some((e) => e.day_of_week === dow) ? course.entries.filter((e) => e.day_of_week === dow) : course.entries) : [];
  const activeEntry = periodOptions.find((e) => e.id === entryId) ?? periodOptions[0] ?? null;
  const activeEntryId = activeEntry?.id ?? null;

  const records = useApi(activeEntryId ? ['admin', 'class-attendance', activeEntryId, date] : null, ([, , id, d]) => adminTimetable.classAttendance(id as string, d as string));
  const leaves = useApi(schoolId && activeEntryId ? ['admin', 'ee-ta-leaves', schoolId, date] : null, () => adminEntryExit.eveningLeaves({ school_id: schoolId, date }));
  const gate = useApi(schoolId && activeEntryId && checkpointId !== 'all' ? ['admin', 'ee-ta-gate', schoolId, checkpointId, date] : null, () =>
    adminEntryExit.records({ school_id: schoolId, checkpoint_id: checkpointId, person_type: 'STUDENT', date_from: date, date_to: date }),
  );

  useEffect(() => {
    if (!records.data) return;
    setRows(records.data.map((r) => ({ student_id: r.student_id, student_name: r.student_name || r.student_id.slice(0, 8), student_number: r.student_number || '', status: r.status === 'late' ? 'late' : r.status === 'present' ? 'present' : 'absent', remarks: r.remarks ?? '' })));
  }, [records.data]);

  async function save() {
    if (!activeEntryId) return toast.error(a('msg_error_no_class'));
    if (!rows.length) return toast.error(a('msg_error_no_students'));
    setSaving(true);
    try {
      const res = await adminTimetable.bulkUpdateAttendance(activeEntryId, date, rows.map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks || undefined })));
      if (!res.success) return toast.error(res.error || a('msg_error_save'));
      if (checkpointId !== 'all') {
        const present = rows.filter((r) => r.status === 'present').map((r) => r.student_id);
        if (present.length) {
          const ee = await adminEntryExit.createBulkRecords({ school_id: schoolId, checkpoint_id: checkpointId, person_ids: present, person_type: 'STUDENT', record_type: recordType });
          if (!ee.success) return toast.error(ee.error || a('msg_error_save'));
        }
      }
      toast.success(a('msg_success_saved'));
      gate.mutate();
    } finally {
      setSaving(false);
    }
  }

  const periodText = (e: TimetableSlot) => (e.period?.period_number ? `${a('label_period')} ${e.period.period_number} (${e.period.start_time?.slice(0, 5) ?? ''}–${e.period.end_time?.slice(0, 5) ?? ''})` : e.start_time ? `${e.start_time.slice(0, 5)}–${(e.end_time ?? '').slice(0, 5)}` : a('label_period'));
  const time = (iso: string) => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  if (!teacher) {
    const q = teacherSearch.toLowerCase();
    const list = (teachers.data ?? []).map((s) => ({ id: s.id, name: shortName(s.profile) || s.employee_number || s.id, number: s.employee_number ?? '' })).filter((x) => !q || x.name.toLowerCase().includes(q) || x.number.toLowerCase().includes(q));
    return (
      <>
        <Stack.Screen options={{ title: a('page_title') }} />
        <View className="bg-background flex-1">
          <DataList
            header={
              <View className="gap-3 p-4">
                <Text variant="muted">{`${a('label_profile')}: ${a('option_teacher')}`}</Text>
                <SearchBar value={teacherSearch} onChangeText={setTeacherSearch} placeholder={a('placeholder_search_teacher')} />
              </View>
            }
            items={teachers.data ? list : undefined}
            error={teachers.error}
            isLoading={teachers.isLoading}
            onRefresh={() => teachers.mutate()}
            emptyTitle={a('msg_no_teachers')}
            keyExtractor={(x) => x.id}
            renderItem={(x) => (
              <Pressable
                onPress={() => {
                  setTeacher(x);
                  setCourseKey('');
                  setEntryId('');
                  setRows([]);
                }}
                className="px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <Initials name={x.name || '?'} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{x.name}</Text>
                    {x.number ? <Text className="text-muted-foreground text-xs">{x.number}</Text> : null}
                  </View>
                </View>
              </Pressable>
            )}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: a('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Pressable onPress={() => setTeacher(null)} className="flex-row items-center gap-1">
                <Icon as={I18nManager.isRTL ? ChevronRight : ChevronLeft} className="text-primary size-4" />
                <Text className="text-primary">{teacher.name}</Text>
              </Pressable>
              <Picker
                value={courseKey}
                onChange={(v) => {
                  setCourseKey(v);
                  setEntryId('');
                }}
                placeholder={timetable.isLoading ? a('msg_loading_courses') : courses.size ? a('placeholder_select_course') : a('msg_no_courses')}
                options={[...courses.values()].map((c) => ({ value: c.key, label: c.label }))}
              />
              <Text className="text-lg font-bold">{a('subheading_take_attendance')}</Text>
              <View className="flex-row gap-2">
                <Picker className="flex-1" value={checkpointId} onChange={setCheckpointId} options={[{ value: 'all', label: t('common.all') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
                <Picker
                  className="w-28"
                  value={recordType}
                  onChange={(v) => setRecordType(v as RecordType)}
                  options={[
                    { value: 'ENTRY', label: a('type_entry') },
                    { value: 'EXIT', label: a('type_exit') },
                  ]}
                />
              </View>
              <DateField value={date} onChange={(d) => d && setDate(d)} />
              {periodOptions.length ? <Picker value={activeEntryId ?? ''} onChange={setEntryId} options={periodOptions.map((e) => ({ value: e.id, label: periodText(e) }))} /> : null}
              {activeEntry && course ? <Text variant="muted" className="text-sm">{`${periodText(activeEntry)} - ${course.label} - ${teacher.name}`}</Text> : null}
              <Text className="text-muted-foreground text-xs">{a('msg_can_edit')}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold">{a('label_attendance')}</Text>
                <Text variant="muted">{a('stat_students_found', { count: rows.length })}</Text>
              </View>
            </View>
          }
          items={activeEntryId ? (records.data ? rows : undefined) : []}
          isLoading={records.isLoading || timetable.isLoading}
          onRefresh={() => records.mutate()}
          emptyTitle={a('msg_no_records')}
          emptyBody={!activeEntryId ? a('msg_select_prompt') : undefined}
          keyExtractor={(r) => r.student_id}
          renderItem={(r) => {
            const el = (leaves.data ?? []).find((l) => l.student_id === r.student_id);
            const rec = (gate.data ?? []).find((x) => x.person_id === r.student_id);
            return (
              <View className={cn('gap-2 px-4 py-3', r.status === 'absent' ? 'bg-destructive-soft' : r.status === 'late' ? 'bg-warning-soft' : undefined)}>
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{r.student_name}</Text>
                    <Text className="text-muted-foreground text-xs">{[r.student_number || '—', course?.gradeName || '—'].join(' · ')}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-muted-foreground text-[10px]">{`${a('table_col_evening_leave')}: `}<Text className="text-xs font-medium text-chart-6">{el ? (el.authorized_return_time?.slice(0, 5) ?? a('label_yes')) : '—'}</Text></Text>
                    <Text className="text-muted-foreground text-[10px]">{`${a('table_col_time')}: `}<Text className="text-xs font-medium">{rec ? time(rec.recorded_at) : '—'}</Text></Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  {(
                    [
                      ['absent', 'status_absent', 'border-destructive bg-destructive'],
                      ['present', 'status_present', 'border-brand bg-brand'],
                      ['late', 'status_late', 'border-border bg-muted-foreground'],
                    ] as const
                  ).map(([s, key, on]) => (
                    <Pressable
                      key={s}
                      onPress={() => setRows((p) => p.map((x) => (x.student_id === r.student_id ? { ...x, status: s } : x)))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: r.status === s }}
                      className={cn('flex-1 items-center rounded-md border py-2', r.status === s ? on : 'border-border')}>
                      <Text className={cn('text-sm font-medium', r.status === s && 'text-white')}>{a(key)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Input value={r.remarks} onChangeText={(v) => setRows((p) => p.map((x) => (x.student_id === r.student_id ? { ...x, remarks: v } : x)))} placeholder={a('table_col_comment')} className="h-9" />
              </View>
            );
          }}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={save} disabled={saving || !activeEntryId || !rows.length}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{a('btn_save')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
