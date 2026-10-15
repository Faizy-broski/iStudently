import type { AdminTimetableEntry, BellPeriod, RoomType } from '@studently/api-client';
import { AlertCircle, Copy, Eraser, Lock, Plus, Sparkles, Trash2, Unlock, User } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEmployees, adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

// Shared by the timetable overview, builder and generator review (web: components/timetable/*).

/** Badge colours per room type (web: ROOM_TYPE_BADGE_CLASS). */
export const ROOM_TYPE_TONE: Record<RoomType, string> = {
  classroom: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  lab: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  auditorium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  library: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  gym: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  office: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

/** Weekdays the timetable covers; the index is the API's day_of_week (0 = Monday). */
export const TT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type TtDay = (typeof TT_DAYS)[number];

export const sortPeriods = (periods: BellPeriod[]) => [...periods].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
export const periodShort = (p: BellPeriod) => p.short_name || `P${p.sort_order}`;
export const periodTitle = (p: BellPeriod) => p.title || p.short_name || `P${p.sort_order}`;
const hm = (s?: string | null) => (s ? s.slice(0, 5) : '');
export const periodTime = (p: BellPeriod, minLabel: string) => (p.start_time && p.end_time ? `${hm(p.start_time)}–${hm(p.end_time)}` : p.length_minutes ? `${p.length_minutes}${minLabel}` : '');
export const entryAt = (entries: AdminTimetableEntry[], dayIdx: number, periodId: string) => entries.find((e) => e.day_of_week === dayIdx && e.period_id === periodId);

/** Teachers of the campus as picker options (web: getAllTeachers, limit 500). */
export function useTeacherOptions() {
  const { campusId } = useCampus();
  const res = useApi(['admin', 'tt-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { limit: 500 }));
  return (res.data ?? []).map((x) => ({ value: x.id, label: shortName(x.profile) || x.employee_number }));
}

/**
 * Days × periods grid that scrolls sideways. Vertical = periods as rows, days as columns;
 * horizontal = days as rows, periods as columns (web: the layout toggle).
 */
export function TimetableGrid({
  periods,
  orientation,
  renderCell,
  dayHeader,
  cellWidth = 104,
}: {
  periods: BellPeriod[];
  orientation: 'vertical' | 'horizontal';
  renderCell: (day: TtDay, dayIdx: number, period: BellPeriod) => ReactNode;
  dayHeader?: (day: TtDay, dayIdx: number) => ReactNode;
  cellWidth?: number;
}) {
  const { t } = useTranslation();
  const tt = (k: string) => t(`school.timetable.${k}`);
  const sorted = sortPeriods(periods);
  const headCell = (key: string, child: ReactNode, w = cellWidth) => (
    <View key={key} style={{ width: w }} className="border-border bg-muted/50 justify-center border p-1.5">
      {child}
    </View>
  );
  const periodHead = (p: BellPeriod) => (
    <View>
      <Text className="text-xs font-semibold">{periodShort(p)}</Text>
      <Text className="text-muted-foreground text-[10px]">{periodTime(p, tt('unit_min'))}</Text>
    </View>
  );
  const dayHead = (d: TtDay, i: number) => (
    <View className="gap-1">
      <Text className="text-xs font-semibold">{t(`school.timetable.days.${d}`)}</Text>
      {dayHeader?.(d, i)}
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator className="grow-0" style={{ flexGrow: 0 }}>
      {orientation === 'vertical' ? (
        <View>
          <View className="flex-row">
            {headCell('h', <Text className="text-xs font-semibold">{tt('header_period_time')}</Text>, 84)}
            {TT_DAYS.map((d, i) => headCell(d, dayHead(d, i)))}
          </View>
          {sorted.map((p) => (
            <View key={p.id} className="flex-row">
              {headCell(`p-${p.id}`, periodHead(p), 84)}
              {TT_DAYS.map((d, i) => (
                <View key={d} style={{ width: cellWidth }} className="border-border border">
                  {renderCell(d, i, p)}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View>
          <View className="flex-row">
            {headCell('h', <Text className="text-xs font-semibold">{tt('table_day')}</Text>, 96)}
            {sorted.map((p) => headCell(`p-${p.id}`, periodHead(p)))}
          </View>
          {TT_DAYS.map((d, i) => (
            <View key={d} className="flex-row">
              {headCell(d, dayHead(d, i), 96)}
              {sorted.map((p) => (
                <View key={p.id} style={{ width: cellWidth }} className="border-border border">
                  {renderCell(d, i, p)}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export interface SlotTarget {
  sectionId: string;
  sectionName: string;
  gradeId?: string;
  gradeName?: string;
  dayIdx: number;
  period: BellPeriod;
  existing?: AdminTimetableEntry;
}

/**
 * Assign / edit one slot. `withCoursePeriods` = the overview dialog (pick a course period, or
 * subject + teacher directly, with a room clash check); otherwise the builder's subject + teacher
 * dialog (web: AssignSlotDialog / TimetableBuilder dialog).
 */
export function SlotDialog({ target, academicYearId, withCoursePeriods, onClose, onSaved }: { target: SlotTarget | null; academicYearId: string; withCoursePeriods: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`school.timetable.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const sectionId = target?.sectionId ?? null;
  const gradeId = target?.gradeId ?? null;
  const dayIdx = target?.dayIdx ?? 0;
  const periodId = target?.period.id ?? null;
  const existingId = target?.existing?.id ?? null;

  const cps = useApi(withCoursePeriods && sectionId ? ['admin', 'tt-cps', sectionId, academicYearId] : null, ([, , sid, y]) => adminTimetable.sectionCoursePeriods(sid, y));
  const subjectsRes = useApi(sectionId ? ['admin', 'tt-subjects', campusId ?? 'school', gradeId ?? 'all'] : null, ([, , , g]) => adminAcademics.subjects(campusId, g === 'all' ? undefined : g));
  const subjects = (subjectsRes.data ?? []).filter((s) => !withCoursePeriods || s.is_active !== false);
  const teachers = useTeacherOptions();

  const [cpId, setCpId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);

  const key = target ? `${target.sectionId}:${target.dayIdx}:${target.period.id}:${existingId ?? ''}` : null;
  useEffect(() => {
    if (!target) return;
    setCpId('');
    setSubjectId(target.existing?.subject_id ?? '');
    setTeacherId(target.existing?.teacher_id ?? '');
    setRoom(target.existing?.room_number ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Editing: preselect the course period taught by the same teacher (web).
  const cpList = cps.data ?? [];
  const existingTeacher = target?.existing?.teacher_id ?? null;
  useEffect(() => {
    if (!existingTeacher || !cpList.length) return;
    const match = cpList.find((cp) => cp.teacher_id === existingTeacher);
    if (match) setCpId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cps.data, existingTeacher]);

  const cp = cpList.find((x) => x.id === cpId) ?? null;
  const effTeacher = cp?.teacher_id || teacherId;
  const effSubject = cp?.course?.subject?.id || subjectId;
  const effRoom = (room || cp?.room || '').trim();

  const conflict = useApi(target && effTeacher && periodId ? ['admin', 'tt-conflict', effTeacher, dayIdx, periodId, academicYearId, existingId ?? ''] : null, ([, , tid, d, pid, y, ex]) =>
    adminTimetable.checkConflict({ teacherId: tid, dayOfWeek: Number(d), periodId: pid, academicYearId: y, excludeEntryId: ex || undefined }),
  );
  const roomCheck = useApi(withCoursePeriods && target && effTeacher && effRoom && periodId ? ['admin', 'tt-room', effTeacher, effRoom, dayIdx, periodId, academicYearId, existingId ?? '', campusId ?? ''] : null, ([, , tid, r, d, pid, y, ex]) =>
    adminTimetable.validateChange({ academicYearId: y, teacherId: tid, roomNumber: r, dayOfWeek: Number(d), periodId: pid, campusId, excludeEntryId: ex || undefined }),
  );
  const conflictText = conflict.data?.has_conflict ? `⚠️ ${conflict.data.conflict_details}` : '';
  const roomClash = roomCheck.data && (roomCheck.data.conflictType === 'room_double_booked' || roomCheck.data.conflictType === 'both') ? roomCheck.data : null;

  async function save() {
    if (!target) return;
    if (withCoursePeriods) {
      if (!cp && !(subjectId && teacherId)) return toast.error(tt('err_select_cp'));
      if (!effSubject || !effTeacher) return toast.error(tt('err_missing_data'));
    } else {
      if (!subjectId) return toast.error(tt('err_select_subject'));
      if (!teacherId) return toast.error(tt('err_select_teacher'));
    }
    setSaving(true);
    try {
      const roomNumber = (withCoursePeriods ? room || cp?.room : room) || undefined;
      const r = target.existing
        ? await adminTimetable.updateEntry(target.existing.id, { subject_id: effSubject, teacher_id: effTeacher, room_number: roomNumber })
        : await adminTimetable.createEntry({
            section_id: target.sectionId,
            subject_id: effSubject,
            teacher_id: effTeacher,
            period_id: target.period.id,
            day_of_week: target.dayIdx,
            academic_year_id: academicYearId,
            room_number: roomNumber,
            campus_id: campusId,
          });
      if (!r.success) return toast.error(r.error || tt('err_save'));
      toast.success(target.existing ? tt('success_updated') : tt('success_assigned'));
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const loading = (withCoursePeriods && cps.isLoading) || subjectsRes.isLoading;
  const canSave = withCoursePeriods ? !!(cp || (subjectId && teacherId)) && !conflictText && !roomClash : true;
  const info = (label: string, value?: string) =>
    value ? (
      <Text className="text-sm">
        <Text className="text-muted-foreground text-sm">{label}: </Text>
        {value}
      </Text>
    ) : null;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.existing ? (withCoursePeriods ? tt('dialog_title_edit') : tt('dialog_title_edit_class')) : tt('dialog_title_assign')}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[480px]" contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
          {target ? (
            <View className="bg-muted/50 gap-0.5 rounded-lg p-3">
              {info(tt('label_section'), target.sectionName)}
              {info(tt('label_grade'), target.gradeName)}
              {info(tt('label_day'), t(`school.timetable.days.${TT_DAYS[target.dayIdx]}`))}
              {info(tt('label_period'), periodTitle(target.period))}
              {info(tt('label_time'), periodTime(target.period, tt('unit_min')) || undefined)}
            </View>
          ) : null}
          {conflictText ? (
            <View className="border-destructive/50 bg-destructive/5 flex-row gap-2 rounded-md border p-2.5">
              <Icon as={AlertCircle} className="text-destructive size-4" />
              <Text className="text-destructive flex-1 text-sm">{conflictText}</Text>
            </View>
          ) : null}
          {roomClash ? (
            <View className="border-destructive/50 bg-destructive/5 gap-2 rounded-md border p-2.5">
              <Text className="text-destructive text-sm">{roomClash.conflictReason}</Text>
              {roomClash.suggestedAlternativeRoom ? (
                <Button size="sm" variant="outline" className="self-start" onPress={() => setRoom(roomClash.suggestedAlternativeRoom!)}>
                  <Text>{tt('btn_use_suggested_room', { room: roomClash.suggestedAlternativeRoom })}</Text>
                </Button>
              ) : null}
            </View>
          ) : null}
          {loading ? (
            <Text className="text-muted-foreground py-6 text-center">{t('common.loading')}</Text>
          ) : (
            <>
              {withCoursePeriods ? (
                <View className="gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Label>{tt('label_course_period')} *</Label>
                    <Text className="text-muted-foreground text-xs">{tt('label_available', { count: cpList.length })}</Text>
                  </View>
                  {cpList.length ? (
                    <Picker
                      value={cpId}
                      onChange={setCpId}
                      placeholder={tt('placeholder_course_period')}
                      options={[
                        { value: '', label: '—' },
                        ...cpList.map((x) => ({
                          value: x.id,
                          label: `${x.course?.title || x.title || tt('label_untitled')} — ${shortName(x.teacher?.profile) || tt('label_no_teacher')}${x.course?.subject ? ` · ${x.course.subject.name}` : ''}`,
                        })),
                      ]}
                    />
                  ) : (
                    <Text className="text-muted-foreground text-sm">{tt('no_course_periods')}</Text>
                  )}
                </View>
              ) : null}
              {!withCoursePeriods || !cp ? (
                <View className={cn('gap-3', withCoursePeriods && 'border-border rounded-lg border border-dashed p-3')}>
                  {withCoursePeriods ? <Text className="text-muted-foreground text-xs">{cpList.length ? tt('direct_hint') : tt('direct_hint_none')}</Text> : null}
                  <View className="gap-1.5">
                    <Label>{tt('label_subject')} *</Label>
                    {subjects.length ? (
                      <Picker value={subjectId} onChange={setSubjectId} placeholder={tt('placeholder_subject')} options={subjects.map((s) => ({ value: s.id, label: s.code && !withCoursePeriods ? `${s.name} (${s.code})` : s.name }))} />
                    ) : (
                      <Text className="text-muted-foreground text-sm">{withCoursePeriods ? tt('no_subjects_for_grade') : tt('no_subjects')}</Text>
                    )}
                  </View>
                  <View className="gap-1.5">
                    <Label>{tt('label_teacher')} *</Label>
                    {teachers.length ? (
                      <Picker value={teacherId} onChange={setTeacherId} placeholder={tt('placeholder_teacher')} options={teachers} />
                    ) : (
                      <Text className="text-muted-foreground text-sm">{tt('no_teachers')}</Text>
                    )}
                  </View>
                </View>
              ) : (
                <View className="bg-muted/30 border-border gap-1 rounded-lg border p-3">
                  {info(tt('label_subject'), cp.course?.subject ? `${cp.course.subject.name}${cp.course.subject.code ? ` (${cp.course.subject.code})` : ''}` : undefined)}
                  {info(tt('label_teacher'), shortName(cp.teacher?.profile) || undefined)}
                  {cp.room ? <Text className="text-muted-foreground text-xs">{`${tt('label_default_room')}: ${cp.room}`}</Text> : null}
                </View>
              )}
              <View className="gap-1.5">
                <Label>
                  {tt('label_room_number')} {withCoursePeriods ? (cp?.room ? tt('label_override') : tt('label_optional')) : tt('label_optional_lower')}
                </Label>
                <Input value={room} onChangeText={setRoom} placeholder={cp?.room || tt('placeholder_room')} />
              </View>
            </>
          )}
        </ScrollView>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onClose}>
            <Text>{tt('btn_cancel')}</Text>
          </Button>
          <Button onPress={save} disabled={!canSave || saving || loading}>
            <Text>{saving ? tt('btn_saving') : target?.existing ? tt('btn_update') : tt('btn_assign')}</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}

/** One section's interactive builder: erase mode, cell locks, copy/clear day, stats (web: TimetableBuilder). */
export function TimetableBuilder({
  sectionId,
  sectionName,
  gradeId,
  gradeName,
  periods,
  entries,
  academicYearId,
  orientation,
  loading,
  onChange,
}: {
  sectionId: string;
  sectionName: string;
  gradeId: string;
  gradeName?: string;
  periods: BellPeriod[];
  entries: AdminTimetableEntry[];
  academicYearId: string;
  orientation: 'vertical' | 'horizontal';
  loading: boolean;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`school.timetable.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.tt_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [erase, setErase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locking, setLocking] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [slot, setSlot] = useState<SlotTarget | null>(null);
  const locked = (e: AdminTimetableEntry) => (e.id in overrides ? overrides[e.id] : !!e.locked);
  const dayName = (i: number) => t(`school.timetable.days.${TT_DAYS[i]}`);

  async function toggleLock(e: AdminTimetableEntry) {
    const next = !locked(e);
    setOverrides((o) => ({ ...o, [e.id]: next }));
    setLocking(e.id);
    try {
      const r = await adminTimetable.lockEntry(e.id, next);
      if (!r.success) {
        setOverrides((o) => ({ ...o, [e.id]: !next }));
        return toast.error(r.error || a('lock_failed'));
      }
      toast.success(next ? a('cell_locked') : a('cell_unlocked'));
      onChange();
    } finally {
      setLocking(null);
    }
  }

  async function bulkLock(lock: boolean) {
    if (lock && !(await confirm({ title: a('lock_all_title', { section: sectionName }), body: a('lock_all_body'), confirmLabel: a('lock_all') }))) return;
    setBusy(true);
    try {
      const r = await adminTimetable.bulkLock({ section_id: sectionId, locked: lock });
      if (!r.success) return toast.error(r.error || a('bulk_lock_failed'));
      toast.success(lock ? a('locked_n', { count: r.data?.updated_count ?? 0 }) : a('unlocked_n', { count: r.data?.updated_count ?? 0 }));
      setOverrides({});
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function tap(dayIdx: number, p: BellPeriod) {
    const e = entryAt(entries, dayIdx, p.id);
    if (e && locked(e)) return toast.info(a('locked_cell'));
    if (erase) {
      if (!e) return;
      const r = await adminTimetable.deleteEntry(e.id);
      if (!r.success) return toast.error(tt('err_remove_entry'));
      toast.success(tt('success_removed_entry'));
      return onChange();
    }
    setSlot({ sectionId, sectionName, gradeId, gradeName, dayIdx, period: p, existing: e });
  }

  async function copyDay(from: number) {
    const to = (from + 1) % TT_DAYS.length;
    const list = entries.filter((e) => e.day_of_week === from);
    if (!list.length) return toast.error(tt('err_no_entries_day', { day: dayName(from) }));
    setBusy(true);
    let ok = 0;
    let skip = 0;
    try {
      for (const e of list) {
        if (entries.some((x) => x.day_of_week === to && x.period_id === e.period_id)) {
          skip++;
          continue;
        }
        const c = await adminTimetable.checkConflict({ teacherId: e.teacher_id, dayOfWeek: to, periodId: e.period_id, academicYearId });
        if (c.data?.has_conflict) {
          skip++;
          continue;
        }
        const r = await adminTimetable.createEntry({ section_id: sectionId, subject_id: e.subject_id, teacher_id: e.teacher_id, period_id: e.period_id, day_of_week: to, academic_year_id: academicYearId, room_number: e.room_number || undefined, campus_id: campusId });
        if (!r.success) throw new Error(r.error);
        ok++;
      }
      toast.success(tt('success_copy', { successCount: ok, skipCount: skip }));
    } catch {
      toast.error(tt('err_copy'));
    } finally {
      setBusy(false);
      onChange();
    }
  }

  async function clearDay(day: number) {
    const list = entries.filter((e) => e.day_of_week === day);
    if (!list.length) return toast.info(tt('info_nothing_to_clear', { day: dayName(day) }));
    if (!(await confirm({ title: tt('confirm_clear_day', { count: list.length, day: dayName(day) }), destructive: true, confirmLabel: tt('tip_clear_day') }))) return;
    setBusy(true);
    try {
      for (const e of list) {
        const r = await adminTimetable.deleteEntry(e.id);
        if (!r.success) throw new Error(r.error);
      }
      toast.success(tt('success_cleared_day', { count: list.length }));
    } catch {
      toast.error(tt('err_clear_day'));
    } finally {
      setBusy(false);
      onChange();
    }
  }

  if (loading) return <LoadingList rows={4} />;
  const subjects = new Set(entries.map((e) => e.subject_id)).size;
  const teachers = new Set(entries.map((e) => e.teacher_id)).size;

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="bg-primary rounded-md px-2 py-0.5">
            <Text className="text-primary-foreground text-sm font-semibold">{sectionName}</Text>
          </View>
          {gradeName ? <Text className="text-muted-foreground text-sm">{gradeName}</Text> : null}
          <Text className="text-muted-foreground text-sm">• {tt('classes_count', { count: entries.length })}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || !entries.length} onPress={() => bulkLock(true)}>
            <Icon as={Lock} className="text-foreground size-4" />
            <Text>{a('lock_all')}</Text>
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !entries.length} onPress={() => bulkLock(false)}>
            <Icon as={Unlock} className="text-foreground size-4" />
            <Text>{a('unlock_all')}</Text>
          </Button>
          <Button size="sm" variant={erase ? 'destructive' : 'outline'} onPress={() => setErase((v) => !v)}>
            <Icon as={Eraser} className={erase ? 'size-4 text-white' : 'text-foreground size-4'} />
            <Text>{erase ? tt('btn_exit_erase') : tt('btn_enter_erase')}</Text>
          </Button>
        </View>
        {erase ? (
          <View className="border-destructive/40 bg-destructive/5 rounded-md border p-2">
            <Text className="text-destructive text-xs">{tt('erase_active_desc')}</Text>
          </View>
        ) : null}
        <TimetableGrid
          periods={periods}
          orientation={orientation}
          dayHeader={(_d, i) => (
            <View className="flex-row gap-2">
              <Pressable disabled={busy} onPress={() => copyDay(i)} hitSlop={6} accessibilityLabel={tt('tip_copy_next')}>
                <Icon as={Copy} className="text-muted-foreground size-3.5" />
              </Pressable>
              <Pressable disabled={busy} onPress={() => clearDay(i)} hitSlop={6} accessibilityLabel={tt('tip_clear_day')}>
                <Icon as={Trash2} className="text-muted-foreground size-3.5" />
              </Pressable>
            </View>
          )}
          renderCell={(_d, dayIdx, p) => {
            const e = entryAt(entries, dayIdx, p.id);
            const isLocked = e ? locked(e) : false;
            return (
              <Pressable
                onPress={() => tap(dayIdx, p)}
                className={cn('min-h-14 justify-center p-1.5', e && (isLocked ? 'bg-amber-50 dark:bg-amber-950/20' : erase ? 'bg-red-50 dark:bg-red-950/20' : 'bg-blue-50 dark:bg-blue-950/20'))}>
                {e ? (
                  <View className="gap-0.5">
                    <View className="flex-row items-start justify-between gap-1">
                      <Text className="text-primary flex-1 text-[11px] font-medium" numberOfLines={1}>
                        {e.subject_name}
                      </Text>
                      <Pressable onPress={() => toggleLock(e)} disabled={locking === e.id} hitSlop={6} accessibilityLabel={isLocked ? a('unlock_cell') : a('lock_cell')}>
                        <Icon as={isLocked ? Lock : Unlock} className={isLocked ? 'size-3 text-amber-600' : 'text-muted-foreground size-3'} />
                      </Pressable>
                    </View>
                    <View className="flex-row items-center gap-0.5">
                      <Icon as={User} className="text-muted-foreground size-2.5" />
                      <Text className="text-muted-foreground flex-1 text-[10px]" numberOfLines={1}>
                        {e.teacher_name}
                      </Text>
                    </View>
                    {e.room_number ? <Text className="text-muted-foreground text-[10px]">{e.room_number}</Text> : null}
                    {e.generated_by_job_id ? (
                      <View className="flex-row items-center gap-0.5 self-start rounded bg-purple-100 px-1 dark:bg-purple-950/40">
                        <Icon as={Sparkles} className="size-2.5 text-purple-700 dark:text-purple-300" />
                        <Text className="text-[9px] text-purple-700 dark:text-purple-300">{a('generated')}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Icon as={Plus} className="text-muted-foreground/30 size-4 self-center" />
                )}
              </Pressable>
            );
          }}
        />
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Text className="text-xs font-medium">{tt('classes_count', { count: entries.length })}</Text>
          <Text className="text-xs font-medium">{tt('empty_slots_count', { count: periods.length * TT_DAYS.length - entries.length })}</Text>
          <Text className="text-xs font-medium">{tt('subjects_count', { count: subjects })}</Text>
          <Text className="text-xs font-medium">{tt('teachers_count', { count: teachers })}</Text>
        </View>
        <Text className="text-muted-foreground text-xs">{a('builder_hint')}</Text>
      </CardContent>
      <SlotDialog target={slot} academicYearId={academicYearId} withCoursePeriods={false} onClose={() => setSlot(null)} onSaved={onChange} />
    </Card>
  );
}
