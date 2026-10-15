import type { FinalGradeListOptions } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useMarkingPeriods } from '@/features/admin/grades';
import type { usePrintContext } from '@/features/admin/print-context';
import { ReportActions } from '@/features/admin/report-actions';
import { outputReports } from '@/features/admin/report-print';
import { CheckRow, MarkingPeriodChecks } from '@/features/admin/report-students';
import { adminGrades } from '@/lib/api';

/**
 * Final grade lists for chosen students and marking periods (web: /admin and /parent grades/final-grades).
 * `chosen()` returns the student ids; `list` renders the student picker; `quartersOnly` lists only
 * quarters when the campus has them (parent page).
 */
export function FinalGradeListsView({ ctx, campusId, chosen, list, subtitle, quartersOnly }: { ctx: ReturnType<typeof usePrintContext>; campusId: string | null | undefined; chosen: () => string[]; list: ReactNode; subtitle?: string; quartersOnly?: boolean }) {
  const { t } = useTranslation();
  const f = (k: string) => t(`school.grades_module.final_grades.${k}`);
  const toast = useToast();
  const mps = useMarkingPeriods(campusId ?? null);
  const quarters = mps.list.filter((m) => m.mp_type === 'QTR');
  const mpList = quartersOnly && quarters.length ? quarters : mps.list;
  const [o, setO] = useState<FinalGradeListOptions>({
    include_teacher: true,
    include_comments: true,
    include_percents: false,
    include_min_max_grades: false,
    include_ytd_absences: true,
    include_other_attendance_ytd: false,
    other_attendance_ytd_type: 'Absent',
    include_mp_absences: true,
    include_other_attendance_mp: false,
    other_attendance_mp_type: 'Absent',
    include_period_absences: false,
  });
  const [mpIds, setMpIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FinalGradeListOptions) => (v: boolean) => setO({ ...o, [k]: v });
  const att = [
    { value: 'Absent', label: f('absent') },
    { value: 'Tardy', label: f('tardy') },
    { value: 'Half Day', label: f('half_day') },
  ];

  async function run(mode: 'print' | 'pdf') {
    const students = chosen();
    if (!students.length) return toast.error(f('select_student_error'));
    if (!mpIds.length) return toast.error(f('select_mp_error'));
    setBusy(true);
    try {
      const r = await adminGrades.generateFinalGradeLists({ student_ids: students, marking_period_ids: mpIds, campus_id: campusId ?? undefined, options: o });
      if (!r.success) return toast.error(r.error || t('common.error'));
      const n = await outputReports({ title: t('app.rp_final_grade_list'), cards: r.data?.grade_lists ?? [], ctx, t, mode, fileName: 'final-grade-lists.pdf' });
      if (!n) toast.success(t('app.rp_generated', { count: students.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const actions = <ReportActions label={f('btn_create')} busy={busy} ready={ctx.ready} onRun={run} />;
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: f('title') }} />
      <Text className="text-muted-foreground text-sm">{subtitle ?? f('subtitle')}</Text>
      {actions}
      <Card>
        <CardContent className="gap-1 pt-4">
          <Text className="pb-1 text-xs font-semibold uppercase">{f('include_section')}</Text>
          <CheckRow label={f('teacher')} value={o.include_teacher} onChange={set('include_teacher')} />
          <CheckRow label={f('comments')} value={o.include_comments} onChange={set('include_comments')} />
          <CheckRow label={f('percents')} value={o.include_percents} onChange={set('include_percents')} />
          <CheckRow label={f('min_max_grades')} value={o.include_min_max_grades} onChange={set('include_min_max_grades')} />
          <Separator className="my-1" />
          <CheckRow label={f('ytd_absences')} value={o.include_ytd_absences} onChange={set('include_ytd_absences')} />
          <CheckRow label={f('other_attendance_ytd')} value={o.include_other_attendance_ytd} onChange={set('include_other_attendance_ytd')} />
          {o.include_other_attendance_ytd ? <Picker value={o.other_attendance_ytd_type} onChange={(v) => setO({ ...o, other_attendance_ytd_type: v })} options={att} /> : null}
          <CheckRow label={f('mp_absences')} value={o.include_mp_absences} onChange={set('include_mp_absences')} />
          <CheckRow label={f('other_attendance_mp')} value={o.include_other_attendance_mp} onChange={set('include_other_attendance_mp')} />
          {o.include_other_attendance_mp ? <Picker value={o.other_attendance_mp_type} onChange={(v) => setO({ ...o, other_attendance_mp_type: v })} options={att} /> : null}
          <CheckRow label={f('period_absences')} value={o.include_period_absences} onChange={set('include_period_absences')} />
          <Separator className="my-1" />
          <Text className="text-xs font-semibold uppercase">{f('marking_periods')}</Text>
          <MarkingPeriodChecks list={mpList} value={mpIds} onChange={setMpIds} />
        </CardContent>
      </Card>
      {list}
      {actions}
    </ScrollView>
  );
}
