import type { ReportCardOptions } from '@studently/api-client';
import { Stack } from 'expo-router';
import { CalendarRange, FileDown, ListChecks, Printer } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useMarkingPeriods } from '@/features/admin/grades';
import type { usePrintContext } from '@/features/admin/print-context';
import { outputReports } from '@/features/admin/report-print';
import { CheckRow, MarkingPeriodChecks } from '@/features/admin/report-students';
import { adminGrades } from '@/lib/api';

type Opts = Omit<ReportCardOptions, 'marking_period_ids'>;
const ATTENDANCE = ['Absent', 'Tardy', 'Half Day'];

/** Report cards for chosen students and marking periods, with every web option (web: /admin and /parent grades/report-cards). Admin passes a student picker as `list`; the parent page passes the selected child. */
export function ReportCardsView({ ctx, campusId, chosen, list, subtitle }: { ctx: ReturnType<typeof usePrintContext>; campusId: string | null | undefined; chosen: () => string[]; list: ReactNode; subtitle?: string }) {
  const { t } = useTranslation();
  const s = (k: string) => t(`school.grades_module.report_cards.${k}`);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const toast = useToast();
  const mps = useMarkingPeriods(campusId ?? null);
  const [o, setO] = useState<Opts>({
    include_student_photo: false,
    include_teacher: true,
    include_comments: true,
    include_percents: false,
    include_min_max_grades: false,
    include_credits: false,
    include_class_average: false,
    include_class_rank: false,
    include_group_by_subject: false,
    include_ytd_absences: true,
    include_other_attendance_ytd: false,
    other_attendance_ytd_type: 'Absent',
    include_mp_absences: true,
    include_other_attendance_mp: false,
    other_attendance_mp_type: 'Absent',
    include_period_absences: false,
    last_row_total: false,
    last_row_gpa: false,
    last_row_class_average: false,
    last_row_class_rank: false,
    include_free_text: false,
    include_mailing_labels: false,
  });
  const [twoCopies, setTwoCopies] = useState(false);
  const [mpIds, setMpIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const set = (k: keyof Opts) => (v: boolean) => setO({ ...o, [k]: v });
  const attOpts = ATTENDANCE.map((v) => ({ value: v, label: c(v === 'Half Day' ? 'half_day' : v.toLowerCase()) }));

  async function generate(mode: 'print' | 'pdf') {
    const students = chosen();
    if (!students.length) return toast.error(c('select_student_error'));
    if (!mpIds.length) return toast.error(c('select_mp_error'));
    setBusy(mode);
    try {
      const r = await adminGrades.generateReportCards({ student_ids: students, campus_id: campusId ?? undefined, options: { ...o, marking_period_ids: mpIds } });
      if (!r.success) return toast.error(r.error || t('common.error'));
      const n = await outputReports({ title: t('app.rp_report_card'), cards: r.data?.report_cards ?? [], ctx, t, mode, twoCopies, fileName: 'report-cards.pdf' });
      if (!n) toast.success(t('app.rp_generated', { count: students.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const actions = (
    <View className="flex-row gap-2">
      <Button className="flex-1" variant="outline" onPress={() => generate('pdf')} disabled={!!busy || !ctx.ready}>
        <Icon as={FileDown} className="text-brand dark:text-brand-secondary size-4" />
        <Text>PDF</Text>
      </Button>
      <Button className="flex-[2]" onPress={() => generate('print')} disabled={!!busy || !ctx.ready}>
        <Icon as={Printer} className="text-primary-foreground size-4" />
        <Text numberOfLines={1}>{s('btn_create')}</Text>
      </Button>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{subtitle ?? s('subtitle')}</Text>
        {actions}
        <FormSection title={s('include_section')} icon={ListChecks}>
          <View className="gap-1">
            <CheckRow label={s('student_photo')} value={o.include_student_photo} onChange={set('include_student_photo')} />
            <CheckRow label={c('teacher')} value={o.include_teacher} onChange={set('include_teacher')} />
            <CheckRow label={c('comments')} value={o.include_comments} onChange={set('include_comments')} />
            <CheckRow label={c('percents')} value={o.include_percents} onChange={set('include_percents')} />
            <CheckRow label={c('min_max_grades')} value={o.include_min_max_grades} onChange={set('include_min_max_grades')} />
            <CheckRow label={c('credits')} value={o.include_credits} onChange={set('include_credits')} />
            <CheckRow label={c('class_average')} value={o.include_class_average} onChange={set('include_class_average')} />
            <CheckRow label={c('class_rank')} value={o.include_class_rank} onChange={set('include_class_rank')} />
            <CheckRow label={s('group_by_subject')} value={o.include_group_by_subject} onChange={set('include_group_by_subject')} />
            <Separator className="my-1" />
            <CheckRow label={c('ytd_absences')} value={o.include_ytd_absences} onChange={set('include_ytd_absences')} />
            <CheckRow label={c('other_attendance_ytd')} value={o.include_other_attendance_ytd} onChange={set('include_other_attendance_ytd')} />
            {o.include_other_attendance_ytd ? <Picker value={o.other_attendance_ytd_type} onChange={(v) => setO({ ...o, other_attendance_ytd_type: v })} options={attOpts} /> : null}
            <CheckRow label={c('mp_absences')} value={o.include_mp_absences} onChange={set('include_mp_absences')} />
            <CheckRow label={c('other_attendance_mp')} value={o.include_other_attendance_mp} onChange={set('include_other_attendance_mp')} />
            {o.include_other_attendance_mp ? <Picker value={o.other_attendance_mp_type} onChange={(v) => setO({ ...o, other_attendance_mp_type: v })} options={attOpts} /> : null}
            <CheckRow label={c('period_absences')} value={o.include_period_absences} onChange={set('include_period_absences')} />
            <Separator className="my-1" />
            <Text className="text-muted-foreground pt-1 text-xs font-semibold">{c('last_row')}</Text>
            <CheckRow label={c('total')} value={o.last_row_total} onChange={set('last_row_total')} />
            <CheckRow label={c('gpa')} value={o.last_row_gpa} onChange={set('last_row_gpa')} />
            <CheckRow label={c('class_average')} value={o.last_row_class_average} onChange={set('last_row_class_average')} />
            <CheckRow label={c('class_rank')} value={o.last_row_class_rank} onChange={set('last_row_class_rank')} />
            <Separator className="my-1" />
            <CheckRow label={s('free_text')} value={o.include_free_text} onChange={set('include_free_text')} />
          </View>
        </FormSection>
        <FormSection title={c('marking_periods')} icon={CalendarRange}>
          <View className="gap-1">
            <MarkingPeriodChecks list={mps.list} value={mpIds} onChange={setMpIds} />
            <Separator className="my-1" />
            <CheckRow label={c('mailing_labels')} value={o.include_mailing_labels} onChange={set('include_mailing_labels')} />
          </View>
        </FormSection>
        <FormSection title={s('pdf_layout')} icon={FileDown}>
          <CheckRow label={s('two_copies_landscape')} hint={s('two_copies_landscape_desc')} value={twoCopies} onChange={setTwoCopies} />
        </FormSection>
        {list}
        {actions}
      </ScrollView>
    </View>
  );
}
