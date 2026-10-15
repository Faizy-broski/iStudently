import { coursePeriodTeacherName, type StudentScheduleEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Lock, Plus, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { CoursePeriodPicker } from '@/features/admin/scheduling-tools';
import { adminAcademics, adminCourses, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';

const longDate = (v: string, locale: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
};

/** Ask for courses for the student and remove requests (web: StudentRequests). */
function StudentRequests({ studentId, yearId, campusId, canManage, onChanged }: { studentId: string; yearId: string; campusId?: string; canManage: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.student_requests.${k}`, o);
  const toast = useToast();
  const requests = useApi(['admin', 'student-requests', studentId, yearId, campusId ?? 'school'], ([, , s, y]) => adminScheduling.requestsForYear(y as string, { student_id: s as string, campus_id: campusId }));
  const subjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const courses = useApi(['admin', 'courses', campusId ?? 'school'], () => adminCourses.courses(campusId));
  const [subject, setSubject] = useState('all');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const requested = new Set((requests.data ?? []).map((x) => x.course_id));
  const term = title.trim().toLowerCase();
  const shown = (courses.data ?? []).filter((c) => (subject === 'all' || c.subject_id === subject) && (!term || c.title.toLowerCase().includes(term)));

  async function add(courseId: string) {
    setBusy(true);
    try {
      const res = await adminScheduling.createScheduleRequest({ student_id: studentId, course_id: courseId, academic_year_id: yearId, campus_id: campusId });
      if (!res.success) return toast.error(res.error || t('common.error'));
      toast.success(r('msg_req_added'));
      requests.mutate();
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    const res = await adminScheduling.deleteScheduleRequest(id);
    if (!res.success) return toast.error(res.error || t('common.error'));
    toast.success(r('msg_req_removed'));
    requests.mutate();
    onChanged();
  }

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="text-lg font-bold">{r('title')}</Text>
        {(requests.data ?? []).length ? (
          <View>
            <Text className="pb-1 text-sm font-semibold">{r('found_requests', { count: requests.data?.length ?? 0 })}</Text>
            {(requests.data ?? []).map((x) => (
              <View key={x.id}>
                <Separator />
                <View className="flex-row items-center gap-2 py-2">
                  <View className="flex-1">
                    <Text className="text-sm">{x.course?.title || '—'}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {t(`common.status.${x.status}`, { defaultValue: x.status })} · {r('th_priority')}: {x.priority}
                    </Text>
                  </View>
                  {canManage ? (
                    <Button size="sm" variant="ghost" onPress={() => remove(x.id)}>
                      <Text className="text-destructive text-xs">{r('btn_remove')}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : !requests.isLoading ? (
          <Text className="text-sm font-semibold">{r('no_requests_found')}</Text>
        ) : null}
        <Picker value={subject} onChange={setSubject} options={[{ value: 'all', label: r('all_subjects') }, ...(subjects.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
        <Input value={title} onChangeText={setTitle} placeholder={r('course_title')} />
        <View>
          {shown.map((c) => (
            <View key={c.id}>
              <Separator />
              <View className="flex-row items-center gap-2 py-2">
                <Text className="flex-1 text-sm">{c.title}</Text>
                {requested.has(c.id) ? (
                  <Text className="text-muted-foreground text-xs">{r('already_requested')}</Text>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onPress={() => add(c.id)}>
                    <Text className="text-xs">{r('btn_add_request')}</Text>
                  </Button>
                )}
              </View>
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

/**
 * One student's schedule on a date: courses, unfilled requests and course requests (web:
 * StudentScheduleDetail). `canManage` (admins) adds drop, add a course and removing requests;
 * students and parents see the same page without them (those calls are admin-only).
 */
export function StudentScheduleView({
  studentId,
  name,
  number,
  yearId,
  campusId,
  yearsLoading,
  canManage,
  showRequests = true,
  printable,
}: {
  studentId: string | null;
  name?: string;
  number?: string;
  yearId: string | null;
  campusId?: string;
  yearsLoading?: boolean;
  canManage: boolean;
  /** Unfilled requests and the request list (web StudentScheduleDetail; the parent page has none). */
  showRequests?: boolean;
  /** Parent page: Print Schedule with Table / List and Horizontal Format. */
  printable?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.student_schedule.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.add_course_dialog.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const [date, setDate] = useState(todayYmd());
  const [inactive, setInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<'table' | 'list'>('table');
  const [horizontal, setHorizontal] = useState(false);
  const schedule = useApi(studentId && yearId ? ['admin', 'student-schedule', studentId, yearId, inactive ? 'all' : 'active'] : null, ([, , st, y, mode]) =>
    mode === 'all' ? adminScheduling.studentScheduleHistory(st as string, y as string) : adminScheduling.studentSchedule(st as string, y as string),
  );
  const unfilled = useApi(showRequests && studentId && yearId ? ['admin', 'student-unfilled', studentId, yearId, campusId ?? 'school'] : null, ([, , st, y]) =>
    adminScheduling.requestsForYear(y as string, { student_id: st as string, status: 'unfilled', campus_id: campusId }),
  );

  const active = (schedule.data ?? []).filter((x) => {
    if (!inactive && x.end_date) return false;
    if (x.start_date && date < x.start_date) return false;
    if (x.end_date && date > x.end_date) return false;
    return true;
  });
  const term = search.trim().toLowerCase();
  const shown = term
    ? active.filter((x) => (x.course?.title ?? '').toLowerCase().includes(term) || `${x.course_period?.teacher?.first_name ?? ''} ${x.course_period?.teacher?.last_name ?? ''}`.toLowerCase().includes(term))
    : active;

  async function drop(x: StudentScheduleEntry) {
    if (!studentId) return;
    if (!(await confirm({ title: s('tip_set_drop_date'), body: `${x.course?.title ?? ''} — ${longDate(date, i18n.language)}`, destructive: true, confirmLabel: s('tip_set_drop_date') }))) return;
    const r = await adminScheduling.dropStudent({ student_id: studentId, course_period_id: x.course_period_id, end_date: date });
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(s('msg_student_dropped'));
    schedule.mutate();
  }
  async function enroll(p: { coursePeriodId: string; courseId: string; availableSeats: number | null }) {
    if (!studentId || !yearId) return;
    setBusy(true);
    try {
      const conflicts = await adminScheduling.checkConflicts(studentId, p.coursePeriodId, yearId);
      if (conflicts.success && (conflicts.data ?? []).length) return toast.error(a('msg_conflict', { names: (conflicts.data ?? []).map((c) => c.conflicting_course_title).join(', ') }));
      if (p.availableSeats != null && p.availableSeats <= 0) return toast.error(a('msg_no_seats'));
      const r = await adminScheduling.enrollStudent({ student_id: studentId, course_id: p.courseId, course_period_id: p.coursePeriodId, academic_year_id: yearId, start_date: date, campus_id: campusId });
      if (!r.success) return toast.error(r.error || a('msg_enroll_error'));
      toast.success(s('msg_enrolled_success'));
      setAdding(false);
      schedule.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    const rows = shown.map((x) => {
      const cp = x.course_period;
      const days = Array.isArray(cp?.days) ? cp?.days.join(',') : cp?.days || '—';
      return [
        x.course?.title || '—',
        `${days} - ${x.course?.short_name || x.course?.title?.substring(0, 6) || '—'} - ${cp?.teacher ? coursePeriodTeacherName(cp) : '—'}`,
        cp?.room || '—',
        x.marking_period_id ? s('term_marking_period') : s('term_full_year'),
        x.start_date ? longDate(x.start_date, i18n.language) : '—',
        x.end_date ? longDate(x.end_date, i18n.language) : '—',
      ];
    });
    const heads = [s('th_course'), s('th_period_info'), s('th_room'), s('th_term'), s('th_enrolled'), s('th_dropped')];
    const body =
      format === 'table'
        ? `<table style="width:100%;border-collapse:collapse"><tr>${heads.map((h) => `<th style="text-align:start;padding:6px;border-bottom:2px solid #ccc;font-size:11px">${escapeHtml(h)}</th>`).join('')}</tr>${rows
            .map((r) => `<tr>${r.map((c) => `<td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(c)}</td>`).join('')}</tr>`)
            .join('')}</table>`
        : rows.map((r) => `<div style="padding:8px 0;border-bottom:1px solid #eee">${r.map((c, i) => `<div><b>${escapeHtml(heads[i])}:</b> ${escapeHtml(c)}</div>`).join('')}</div>`).join('');
    try {
      await printHtml(
        buildPrintHtml({
          title: s('title'),
          school: { name: '' },
          pages: [`<h2>${escapeHtml(s('title'))} — ${escapeHtml(name || '')}</h2><p>${escapeHtml(longDate(date, i18n.language))}</p>${body}`],
          extraCss: horizontal ? '@page{size:landscape}' : '',
        }),
      );
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              schedule.mutate();
              unfilled.mutate();
            }}
          />
        }>
        <Text className="text-lg font-semibold">
          {name || '—'}
          {number ? <Text className="text-muted-foreground text-sm font-normal"> #{number}</Text> : null}
        </Text>
        <DateField value={date} onChange={setDate} />
        <View className="flex-row items-center gap-3">
          <Switch checked={inactive} onCheckedChange={setInactive} />
          <Text className="flex-1 text-sm">{s('include_inactive')}</Text>
        </View>
        {printable ? (
          <View className="gap-2">
            <Button variant="link" size="sm" className="self-start px-0" onPress={print}>
              <Icon as={Printer} className="text-primary size-3.5" />
              <Text className="text-primary text-sm">{s('btn_print')}</Text>
            </Button>
            <View className="flex-row flex-wrap items-center gap-2">
              {(['table', 'list'] as const).map((f) => (
                <Button key={f} size="sm" variant={format === f ? 'default' : 'outline'} onPress={() => setFormat(f)}>
                  <Text>{s(`format_${f}`)}</Text>
                </Button>
              ))}
              <View className="flex-row items-center gap-2">
                <Switch checked={horizontal} onCheckedChange={setHorizontal} />
                <Text className="text-sm">{s('format_horizontal')}</Text>
              </View>
            </View>
          </View>
        ) : null}
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
        {schedule.isLoading || yearsLoading ? (
          <LoadingList rows={3} />
        ) : schedule.error ? (
          <ErrorState message={schedule.error.message} onRetry={() => schedule.mutate()} />
        ) : (
          <Card>
            <CardContent className="pt-3">
              <Text className="text-muted-foreground pb-2 text-sm">{s('found_courses', { count: shown.length })}</Text>
              {!shown.length ? <Text className="text-muted-foreground py-4 text-center text-sm">{s('no_courses_found')}</Text> : null}
              {shown.map((x) => {
                const cp = x.course_period;
                const teacher = cp?.teacher ? coursePeriodTeacherName(cp) : '—';
                const shortName = x.course?.short_name || x.course?.title?.substring(0, 6) || '—';
                const days = Array.isArray(cp?.days) ? cp?.days.join(',') : cp?.days || '—';
                return (
                  <View key={x.id}>
                    <Separator />
                    <View className="gap-1 py-2.5">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="flex-1 font-medium">{x.course?.title || 'Unknown Course'}</Text>
                        {x.scheduler_lock ? <Icon as={Lock} className="text-muted-foreground size-3.5" /> : null}
                      </View>
                      <Text className="text-muted-foreground text-xs">
                        {days} - {shortName} - {teacher}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {s('th_room')}: {cp?.room || '—'} · {s('th_term')}: {x.marking_period_id ? s('term_marking_period') : s('term_full_year')}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {s('th_enrolled')}: {x.start_date ? longDate(x.start_date, i18n.language) : '—'}
                        {x.end_date ? ` · ${s('th_dropped')}: ${longDate(x.end_date, i18n.language)}` : ''}
                      </Text>
                      {canManage && !x.end_date ? (
                        <Button size="sm" variant="outline" className="self-start" onPress={() => drop(x)}>
                          <Text className="text-destructive text-xs">{s('tip_set_drop_date')}</Text>
                        </Button>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </CardContent>
          </Card>
        )}
        {canManage ? (
          <Button variant="outline" onPress={() => setAdding((v) => !v)} disabled={!yearId}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{s('btn_add_course')}</Text>
          </Button>
        ) : null}
        {canManage && adding ? (
          <View className="gap-2" pointerEvents={busy ? 'none' : 'auto'}>
            <Text className="text-muted-foreground text-xs">
              {a('enrollment_date')}: {longDate(date, i18n.language)}
            </Text>
            <CoursePeriodPicker value={null} onSelect={enroll} />
          </View>
        ) : null}
        {showRequests ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              {unfilled.isLoading ? (
                <LoadingList rows={1} />
              ) : !(unfilled.data ?? []).length ? (
                <Text className="text-sm font-semibold">{s('requests_none')}</Text>
              ) : (
                <>
                  <Text className="text-sm font-semibold">{s('requests_found', { count: unfilled.data?.length ?? 0 })}</Text>
                  {(unfilled.data ?? []).map((x) => (
                    <Text key={x.id} className="text-sm">
                      {x.course?.title || '—'} · {t(`common.status.${x.status}`, { defaultValue: x.status })} · {s('th_priority')}: {x.priority}
                    </Text>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
        {showRequests && studentId && yearId ? <StudentRequests studentId={studentId} yearId={yearId} campusId={campusId} canManage={canManage} onChanged={() => unfilled.mutate()} /> : null}
      </ScrollView>
    </View>
  );
}
