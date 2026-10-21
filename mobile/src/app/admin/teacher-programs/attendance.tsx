import type { ClassAttendanceStatus } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CalendarDays, MessageSquare, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { DateField, todayYmd } from '@/components/app/date-field';
import { CARD_LIST_PROPS, Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { StatusChip } from '@/components/app/status-chip';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEmployees, adminEntryExit, adminGrades, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Row = { student_id: string; student_name: string; student_number: string; status: ClassAttendanceStatus; remarks?: string };
const CHOICES: { status: ClassAttendanceStatus; key: string; letter: string; on: string }[] = [
  { status: 'present', key: 'presentColumn', letter: 'P', on: 'bg-success border-success' },
  { status: 'absent', key: 'absentColumn', letter: 'A', on: 'bg-destructive border-destructive' },
  { status: 'late', key: 'tardyColumn', letter: 'L', on: 'bg-warning border-warning' },
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
  const [search, setSearch] = useState('');
  // Students whose remarks field is open (it also shows when a remark exists).
  const [notes, setNotes] = useState<Set<string>>(() => new Set());
  const toggleNote = (sid: string) => setNotes((p) => (p.has(sid) ? new Set([...p].filter((x) => x !== sid)) : new Set(p).add(sid)));

  const teachers = useApi(self ? null : ['admin', 'tp-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { page: 1, limit: 500 }));
  // Teachers edit only inside the marking period's posting window, never in the future (web: allowEdit).
  const mps = useApi(self ? ['teacher', 'marking-periods', campusId ?? 'school'] : null, () => adminGrades.markingPeriods(campusId));
  const mp = (mps.data ?? []).find((m) => m.start_date && m.end_date && date >= m.start_date && date <= m.end_date && (m.mp_type === 'QTR' || m.mp_type === 'PRO'));
  const allowEdit = !self || (!!mp && date <= todayYmd() && (!mp.post_start_date || !mp.post_end_date || (date >= mp.post_start_date && date <= mp.post_end_date)));
  const schedule = useApi(teacherId ? ['admin', 'teacher-schedule', teacherId, date] : null, ([, , tid, d]) => adminTimetable.teacherSchedule(tid as string, d as string));
  // Admin web /admin/attendance/take-attendance: pick grade → section → that weekday's timetable slot, with an optional
  // entry/exit checkpoint (shows each student's last scan and suggests absent for those not back).
  const [mode, setMode] = useState<'teacher' | 'section'>('teacher');
  const bySection = !self && mode === 'section';
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [checkpoint, setCheckpoint] = useState('');
  const { scopeId } = useCampus();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? scopeId ?? null) : null;
  const gradesQ = useApi(bySection ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const sectionsQ = useApi(bySection ? ['admin', 'sections', campusId ?? 'school', 'all'] : null, () => adminAcademics.sections(campusId));
  const year = useApi(bySection ? ['admin', 'current-year'] : null, () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;
  const sectionTt = useApi(bySection && section && yearId ? ['admin', 'timetable-section', section, yearId] : null, ([, , sid, y]) => adminTimetable.bySection(sid as string, y as string));
  const checkpoints = useApi(bySection && schoolId ? ['admin', 'ee-checkpoints', schoolId] : null, ([, , sid]) => adminEntryExit.checkpoints(sid as string));
  const ee = useApi(bySection && checkpoint && schoolId ? ['admin', 'ee-integration', schoolId, checkpoint, date] : null, ([, , sid, cp, d]) =>
    adminEntryExit.attendanceIntegration({ school_id: sid as string, checkpoint_id: cp as string, date: d as string }),
  );
  const eeMap = new Map((ee.data ?? []).map((r) => [r.student_id, r]));
  const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
  const sectionName = (sectionsQ.data ?? []).find((x) => x.id === section)?.name;
  const sectionClasses = (sectionTt.data ?? [])
    .filter((e) => e.day_of_week === weekday)
    .sort((x, y) => (x.period_number ?? 0) - (y.period_number ?? 0))
    .map((e) => ({ id: e.id, period_number: e.period_number ?? 0, subject_name: e.subject_name, section_name: e.section_name ?? sectionName, start_time: e.start_time, end_time: e.end_time, room_number: e.room_number }));
  const classes: { id: string; period_number: number; subject_name?: string | null; section_name?: string | null; start_time?: string | null; end_time?: string | null; room_number?: string | null }[] = bySection
    ? sectionClasses
    : (schedule.data ?? []);
  const activeClass = classId && classes.some((c) => c.id === classId) ? classId : (classes[0]?.id ?? '');
  const records = useApi(activeClass ? ['admin', 'class-attendance', activeClass, date] : null, ([, , cid, d]) => adminTimetable.classAttendance(cid as string, d as string));

  useEffect(() => {
    if (!records.data) return;
    setRows(records.data.map((r) => ({ student_id: r.student_id, student_name: r.student_name || 'Unknown Student', student_number: r.student_number || '', status: r.status, remarks: r.remarks ?? undefined })));
    setDirty(false);
  }, [records.data]);
  // Web: once the checkpoint data arrives, students not back are suggested absent (only those still "present").
  const eeData = ee.data;
  useEffect(() => {
    if (!eeData?.length) return;
    const suggest = new Set(eeData.filter((r) => r.suggest_absent).map((r) => r.student_id));
    if (!suggest.size) return;
    setRows((p) => p.map((r) => (suggest.has(r.student_id) && r.status === 'present' ? { ...r, status: 'absent' } : r)));
    setDirty(true);
  }, [eeData, records.data]);

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
  const rate = stats.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0;
  const q = search.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.student_name.toLowerCase().includes(q) || r.student_number.toLowerCase().includes(q)) : rows;
  const isToday = date === todayYmd();

  return (
    <>
      <Stack.Screen options={{ title: a('title') }} />
      <View className="bg-background flex-1">
        <DataList
          {...CARD_LIST_PROPS}
          ItemSeparatorComponent={() => null}
          contentContainerClassName="flex-grow px-4 pb-28"
          header={
            <View className="gap-3 pb-3 pt-4">
              {self ? null : (
                <FilterChips<'teacher' | 'section'>
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setClassId('');
                    setRows([]);
                  }}
                  options={[
                    { value: 'teacher', label: t('app.att_by_teacher') },
                    { value: 'section', label: t('app.att_by_section') },
                  ]}
                />
              )}
              {self || bySection ? null : (
                <Picker
                  value={teacherId}
                  onChange={setTeacherId}
                  placeholder={teachers.isLoading ? t('teacherPrograms.selectorLoadingTeachers') : t('teacherPrograms.selectorTeacherPlaceholder')}
                  options={(teachers.data ?? []).map((s) => ({ value: s.id, label: shortName(s.profile) || s.id }))}
                />
              )}
              {bySection ? (
                <View className="gap-2">
                  <View className="flex-row gap-2">
                    <Picker
                      className="flex-1"
                      value={grade}
                      onChange={(v) => {
                        setGrade(v);
                        setSection('');
                        setClassId('');
                        setRows([]);
                      }}
                      placeholder={t('attendance.takeAttendance_selectGrade')}
                      options={(gradesQ.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
                    />
                    <Picker
                      className="flex-1"
                      value={section}
                      onChange={(v) => {
                        setSection(v);
                        setClassId('');
                        setRows([]);
                      }}
                      placeholder={t('attendance.takeAttendance_selectSection')}
                      options={(sectionsQ.data ?? []).filter((x) => x.grade_level_id === grade && x.is_active !== false).map((x) => ({ value: x.id, label: x.name }))}
                    />
                  </View>
                  <Picker
                    value={checkpoint || '__none__'}
                    onChange={(v) => setCheckpoint(v === '__none__' ? '' : v)}
                    placeholder={t('attendance.takeAttendance_eeCheckpoint')}
                    options={[{ value: '__none__', label: `${t('attendance.takeAttendance_eeCheckpoint')}: ${t('attendance.takeAttendance_none')}` }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                  />
                </View>
              ) : null}
              {/* Class card: subject · section, date, period, Today */}
              <Panel className="gap-3 p-4">
                <View className="flex-row items-start gap-3">
                  <View className="flex-1">
                    <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                      {sel ? `${a('title')} · ${sel.section_name ?? ''}` : a('title')}
                    </Text>
                    {sel ? (
                      <Text variant="muted" className="text-xs">
                        {`${sel.subject_name ?? ''} · P${sel.period_number} · ${sel.start_time?.substring(0, 5)}–${sel.end_time?.substring(0, 5)}${sel.room_number ? ` · ${sel.room_number}` : ''}`}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setDate(todayYmd())} className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', isToday ? 'bg-info-soft' : 'bg-muted')} accessibilityRole="button">
                    <Icon as={CalendarDays} className={cn('size-3.5', isToday ? 'text-brand dark:text-brand-secondary' : 'text-muted-foreground')} />
                    <Text className={cn('text-[11px] font-semibold', isToday ? 'text-brand dark:text-brand-secondary' : 'text-muted-foreground')}>{t('app.att_today')}</Text>
                  </Pressable>
                </View>
                <DateField label={a('dateLabel')} value={date} onChange={(d) => d && setDate(d)} />
                <View className="flex-row items-center gap-2">
                  <Picker
                    className="flex-1"
                    value={activeClass}
                    onChange={setClassId}
                    placeholder={schedule.isLoading ? a('loadingClasses') : a('classPlaceholder')}
                    options={classes.map((c) => ({ value: c.id, label: `P${c.period_number} — ${c.subject_name ?? ''} · ${c.section_name ?? ''}` }))}
                  />
                  <Pressable onPress={() => records.mutate()} disabled={!activeClass} className="bg-info-soft size-11 items-center justify-center rounded-full" accessibilityLabel="Refresh">
                    <Icon as={RefreshCw} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                </View>
              </Panel>
              {self && activeClass ? (
                <View className={cn('gap-1 rounded-2xl p-3', allowEdit ? 'bg-success-soft' : 'bg-warning-soft')}>
                  <Text className={cn('text-sm font-semibold', allowEdit ? 'text-success' : 'text-warning')}>{`${allowEdit ? ta('editableAttendance') : ta('readOnlyAttendance')} · ${allowEdit ? ta('editMode') : ta('viewOnly')}`}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {mp?.post_start_date && mp?.post_end_date ? ta('postingWindow', { start: mp.post_start_date, end: mp.post_end_date }) : ta('postingWindowHint')}
                  </Text>
                  {mp ? <Text className="text-muted-foreground text-xs">{ta('markingPeriodLabel', { type: mp.mp_type })}</Text> : null}
                </View>
              ) : null}
              {(teacherId || bySection) && rows.length ? (
                <>
                  <View className="flex-row gap-3">
                    {(
                      [
                        [stats.present, a('present'), 'text-success'],
                        [stats.absent, a('absent'), 'text-destructive'],
                        [stats.late, a('late'), 'text-warning'],
                      ] as const
                    ).map(([n, label, tone]) => (
                      <Panel key={label} className="flex-1 items-center gap-0.5 py-3">
                        <Text className={cn('text-2xl font-bold', tone)}>{n}</Text>
                        <Text variant="muted" className="text-xs">
                          {label}
                        </Text>
                      </Panel>
                    ))}
                  </View>
                  <Text variant="muted" className="text-center text-xs">
                    {`${a('total')} ${stats.total}${self ? ` · ${ta('rate')} ${rate}%` : ''}`}
                  </Text>
                  <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.att_search')} />
                  {self && allowEdit ? (
                    <View className="flex-row gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('present')}>
                        <Text>{t('app.te_mark_all_present')}</Text>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onPress={() => markAll('absent')}>
                        <Text>{t('app.te_mark_all_absent')}</Text>
                      </Button>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          }
          items={teacherId || bySection ? (activeClass ? (records.data ? shown : undefined) : []) : []}
          isLoading={records.isLoading || schedule.isLoading || sectionTt.isLoading}
          error={records.error}
          onRefresh={() => records.mutate()}
          emptyTitle={bySection ? (section ? (classes.length ? a('noStudents') : t('attendance.takeAttendance_noClasses')) : t('attendance.takeAttendance_subtitle')) : teacherId ? a('noStudents') : a('selectPrompt')}
          keyExtractor={(r) => r.student_id}
          renderItem={(r, i) => {
            const noteOpen = notes.has(r.student_id) || !!r.remarks;
            return (
              <View className={cn('border-info-soft dark:border-border bg-card gap-2 border-x px-3 py-2.5', i === 0 && 'rounded-t-2xl border-t', i === shown.length - 1 && 'rounded-b-2xl border-b', i > 0 && 'border-t')}>
                <View className="flex-row items-center gap-3">
                  <View className="bg-info-soft size-9 items-center justify-center rounded-full">
                    <Text className="text-brand dark:text-brand-secondary text-xs font-bold">{initials(r.student_name)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {r.student_name}
                    </Text>
                    <Text variant="muted" className="text-[11px]">{`#${rows.indexOf(r) + 1}${r.student_number ? ` · ${r.student_number}` : ''}`}</Text>
                    {checkpoint && eeMap.get(r.student_id) ? (
                      <View className="mt-1 flex-row flex-wrap gap-1">
                        {eeMap.get(r.student_id)?.last_record_type ? (
                          <StatusChip
                            label={`${eeMap.get(r.student_id)?.last_record_type} ${(eeMap.get(r.student_id)?.last_record_time ?? '').substring(0, 5)}`}
                            tone={eeMap.get(r.student_id)?.last_record_type === 'ENTRY' ? 'success' : 'warning'}
                            className="px-1.5 py-0"
                          />
                        ) : null}
                        {eeMap.get(r.student_id)?.evening_leave_return_time ? (
                          <StatusChip label={t('app.att_eve_leave_back', { time: (eeMap.get(r.student_id)?.evening_leave_return_time ?? '').substring(0, 5) })} tone="info" className="px-1.5 py-0" />
                        ) : null}
                        {eeMap.get(r.student_id)?.suggest_absent ? <StatusChip label={t('app.att_not_returned')} tone="destructive" className="px-1.5 py-0" /> : null}
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => toggleNote(r.student_id)} hitSlop={6} className="p-1" accessibilityRole="button" accessibilityLabel={a('commentPlaceholder')}>
                    <Icon as={MessageSquare} className={cn('size-4', r.remarks ? 'text-brand dark:text-brand-secondary' : 'text-muted-foreground')} />
                  </Pressable>
                  {CHOICES.map((c) => {
                    const on = r.status === c.status;
                    return (
                      <Pressable
                        key={c.status}
                        onPress={() => update(r.student_id, { status: c.status })}
                        disabled={!allowEdit}
                        accessibilityRole="radio"
                        accessibilityLabel={a(c.key)}
                        accessibilityState={{ checked: on }}
                        className={cn('size-9 items-center justify-center rounded-full border', on ? c.on : 'border-border bg-card')}>
                        <Text className={cn('text-xs font-bold', on ? 'text-white' : 'text-muted-foreground')}>{c.letter}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {noteOpen ? <Input value={r.remarks ?? ''} onChangeText={(v) => update(r.student_id, { remarks: v })} editable={allowEdit} placeholder={a('commentPlaceholder')} className="h-10" /> : null}
              </View>
            );
          }}
        />
        <View className="bg-background absolute inset-x-0 bottom-0 px-4 pb-6 pt-3">
          <Button size="lg" onPress={save} disabled={saving || !dirty || !activeClass || !allowEdit}>
            <Text>{saving ? a('saving') : dirty ? t('app.att_save_counts', { done: stats.present + stats.late + stats.absent, total: stats.total }) : `${a('saved')} · ${a('noChanges')}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}
