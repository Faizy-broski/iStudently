import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { monthGrid, monthNames, todayYmd, weekdayNames, ymd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow, CodeSelect, GradeSectionPickers, useAttendanceCodes, useAttendanceScope, useGradeSection } from '@/features/admin/attendance';
import { shortName } from '@/features/admin/people';
import { adminAcademics, adminAttendance, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Record an absence code for many students, periods and dates at once (web: /admin/attendance/add-absences). */
export default function AddAbsences() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const gs = useGradeSection();
  const now = new Date();
  const [periodIds, setPeriodIds] = useState<string[]>([]);
  const [codeId, setCodeId] = useState('');
  const [reason, setReason] = useState('');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dates, setDates] = useState<Set<string>>(() => new Set([todayYmd()]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [offDays, setOffDays] = useState<number[]>([5, 6]);
  const [submitting, setSubmitting] = useState(false);

  const codesRes = useAttendanceCodes();
  const codes = codesRes.data ?? [];
  const defaultCodeId = (codes.find((c) => c.state_code === 'A') ?? codes[0])?.id ?? '';
  const effectiveCodeId = codeId || defaultCodeId;

  const periodsRes = useApi(['admin', 'class-periods', campusId ?? 'school'], () => adminAcademics.periods(campusId));
  const activePeriods = (periodsRes.data ?? []).filter((p) => !p.is_break);

  const students = useApi(['admin', 'absence-students', campusId ?? 'school', gs.gradeName ?? 'all'], () =>
    adminStudents.list(campusId, { grade_level: gs.gradeName ? [gs.gradeName] : undefined, limit: 500, is_active: true }),
  );

  const lastDay = new Date(year, month + 1, 0).getDate();
  const start = ymd(new Date(year, month, 1));
  const end = ymd(new Date(year, month, lastDay));
  const calendar = useApi(schoolId ? ['admin', 'attendance-calendar', schoolId, campusId ?? 'school', start, end] : null, () =>
    adminAttendance.getCalendar(schoolId, start, end, campusId),
  );
  const schoolDays = new Set((calendar.data ?? []).filter((d) => d.is_school_day && d.minutes > 0).map((d) => d.school_date));

  const q = search.trim().toLowerCase();
  const rows = (students.data ?? []).filter((s) => {
    if (gs.sectionId && s.section_id !== gs.sectionId) return false;
    if (!q) return true;
    return `${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`.toLowerCase().includes(q) || (s.student_number ?? '').toLowerCase().includes(q);
  });

  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const allPeriods = activePeriods.length > 0 && periodIds.length === activePeriods.length;
  const toggleAllPeriods = () => setPeriodIds(allPeriods ? [] : activePeriods.map((p) => p.id));
  const allStudents = rows.length > 0 && rows.every((s) => selected.has(s.id));
  const days = weekdayNames(i18n.language);
  const months = monthNames(i18n.language);

  async function submit() {
    if (!selected.size) return toast.error(a('addAbsences_selectStudent'));
    if (!dates.size) return toast.error(a('addAbsences_selectDate'));
    if (!periodIds.length) return toast.error(a('addAbsences_selectPeriod'));
    if (!effectiveCodeId) return toast.error(a('addAbsences_selectCode'));
    setSubmitting(true);
    try {
      let created = 0;
      let updated = 0;
      for (const date of dates) {
        const res = await adminAttendance.addAbsences({
          school_id: schoolId,
          campus_id: campusId ?? null,
          student_ids: [...selected],
          attendance_date: date,
          period_ids: periodIds,
          attendance_code_id: effectiveCodeId,
          reason: reason || undefined,
        });
        if (res.success && res.data) {
          created += res.data.created;
          updated += res.data.updated;
        } else toast.error(`${date}: ${res.error ?? ''}`);
      }
      toast.success(t('app.at_absences_recorded', { created, updated }));
      setSelected(new Set());
      setDates(new Set());
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !selected.size || !dates.size || !periodIds.length;

  const header = (
    <View className="gap-4 p-4">
      <Text variant="muted">{a('addAbsences_subtitle')}</Text>
      <Card>
        <CardContent className="gap-4 pt-4">
          <View className="gap-1">
            <Label>{t('app.at_periods')}</Label>
            {activePeriods.length ? (
              <View className="flex-row flex-wrap gap-x-4">
                {activePeriods.map((p) => (
                  <CheckRow
                    key={p.id}
                    checked={periodIds.includes(p.id)}
                    onPress={() => setPeriodIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                    label={p.period_name || `P${p.period_number}`}
                  />
                ))}
              </View>
            ) : (
              <Text variant="muted">{periodsRes.isLoading ? '…' : a('noPeriods')}</Text>
            )}
            <CheckRow checked={allPeriods} onPress={toggleAllPeriods} label={`${a('addAbsences_addToPeriods')} · ${a('addAbsences_checkAll')}`} />
          </View>

          <View className="gap-1.5">
            <Label>{a('addAbsences_absenceCode')}</Label>
            <View className="flex-row">
              <CodeSelect codes={codes} value={effectiveCodeId} onChange={setCodeId} allowEmpty={false} showTitle />
            </View>
          </View>

          <View className="gap-1.5">
            <Label>{a('addAbsences_reason')}</Label>
            <Textarea value={reason} onChangeText={setReason} className="min-h-16" />
          </View>

          <View className="gap-2">
            <Label>{a('addAbsences_offDays')}</Label>
            <View className="flex-row flex-wrap gap-x-3">
              {days.map((d, i) => (
                <CheckRow key={i} checked={offDays.includes(i)} onPress={() => setOffDays((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))} label={d} tone={offDays.includes(i) ? 'danger' : undefined} />
              ))}
            </View>
            <View className="flex-row gap-2">
              <Picker className="flex-1" value={String(month)} onChange={(v) => setMonth(Number(v))} options={months.map((m, i) => ({ value: String(i), label: m }))} />
              <Picker className="w-28" value={String(year)} onChange={(v) => setYear(Number(v))} options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))} />
            </View>
            <View className="flex-row">
              {days.map((d, i) => (
                <Text key={i} className="text-muted-foreground flex-1 text-center text-xs">
                  {d}
                </Text>
              ))}
            </View>
            {monthGrid(year, month).map((week, wi) => (
              <View key={wi} className="flex-row">
                {week.map((day, di) => {
                  if (!day) return <View key={di} className="h-10 flex-1" />;
                  const s = ymd(new Date(year, month, day));
                  const off = offDays.includes(di);
                  const schoolDay = !off && (schoolDays.size === 0 || schoolDays.has(s));
                  const on = dates.has(s);
                  return (
                    <Pressable
                      key={di}
                      disabled={!schoolDay}
                      onPress={() => setDates((x) => toggle(x, s))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: !schoolDay }}
                      className="h-10 flex-1 items-center justify-center p-0.5">
                      <View className={cn('size-9 items-center justify-center rounded-md border', on ? 'border-primary bg-primary' : 'border-input', !schoolDay && 'opacity-30')}>
                        <Text className={cn('text-sm', on ? 'text-primary-foreground font-semibold' : off ? 'text-red-500' : 'text-foreground')}>{day}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      <GradeSectionPickers gs={gs} />
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
      <View className="flex-row items-center justify-between">
        <CheckRow checked={allStudents} onPress={() => setSelected(allStudents ? new Set() : new Set(rows.map((s) => s.id)))} label={t('app.at_select_all')} />
        <Text variant="muted">{t('app.at_students_found', { count: rows.length })}</Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: a('addAbsences_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={header}
          items={students.data ? rows : undefined}
          error={students.error}
          isLoading={students.isLoading}
          onRefresh={() => students.mutate()}
          emptyTitle={a('addAbsences_noStudentsFound')}
          keyExtractor={(s) => s.id}
          renderItem={(s) => (
            <Pressable onPress={() => setSelected((x) => toggle(x, s.id))} className={cn('flex-row items-center gap-3 px-4 py-3', selected.has(s.id) && 'bg-primary/10')}>
              <CheckRow checked={selected.has(s.id)} onPress={() => setSelected((x) => toggle(x, s.id))} label="" />
              <View className="flex-1">
                <Text className="font-medium">{shortName(s.profile) || s.student_number}</Text>
                <Text className="text-muted-foreground text-xs">{[s.student_number, s.grade?.name ?? s.grade_level].filter(Boolean).join(' · ') || '-'}</Text>
              </View>
            </Pressable>
          )}
          contentContainerClassName="flex-grow pb-24"
        />
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={submit} disabled={disabled}>
            <Text>{`${a('addAbsences_btn')}${selected.size ? ` (${selected.size})` : ''}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
