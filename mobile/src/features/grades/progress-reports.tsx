import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Panel } from '@/components/app/panel';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { usePrintContext } from '@/features/admin/print-context';
import { ReportActions } from '@/features/admin/report-actions';
import { outputReports } from '@/features/admin/report-print';
import { CheckRow } from '@/features/admin/report-students';
import { adminGrades } from '@/lib/api';

/** Gradebook progress reports for chosen students (web: /admin and /parent grades/progress-reports). Admin passes a student picker as `list`; the parent page passes the selected child. */
export function ProgressReportsView({ ctx, campusId, chosen, list, subtitle }: { ctx: ReturnType<typeof usePrintContext>; campusId: string | null | undefined; chosen: () => string[]; list: ReactNode; subtitle?: string }) {
  const { t } = useTranslation();
  const p = (k: string) => t(`school.grades_module.progress_reports.${k}`);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const toast = useToast();
  const [o, setO] = useState({ include_assigned_date: false, include_due_date: true, exclude_ungraded_ec: true, exclude_ungraded_not_due: false, group_by_category: false, include_mailing_labels: false });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof o) => (v: boolean) => setO({ ...o, [k]: v });

  async function run(mode: 'print' | 'pdf') {
    const students = chosen();
    if (!students.length) return toast.error(c('select_student_error'));
    setBusy(true);
    try {
      const r = await adminGrades.generateProgressReports({ student_ids: students, campus_id: campusId ?? undefined, options: o });
      if (!r.success) return toast.error(r.error || t('common.error'));
      const n = await outputReports({ title: t('app.rp_progress_report'), cards: r.data?.progress_reports ?? [], ctx, t, mode, fileName: 'progress-reports.pdf' });
      if (!n) toast.success(t('app.rp_generated', { count: students.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const actions = <ReportActions label={p('btn_create')} busy={busy} ready={ctx.ready} onRun={run} />;
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: p('title') }} />
      <Text className="text-muted-foreground text-sm">{subtitle ?? p('subtitle')}</Text>
      {actions}
      <Panel className="gap-1 p-4">
          <CheckRow label={p('assigned_date')} value={o.include_assigned_date} onChange={set('include_assigned_date')} />
          <CheckRow label={p('exclude_ungraded_ec')} value={o.exclude_ungraded_ec} onChange={set('exclude_ungraded_ec')} />
          <CheckRow label={p('due_date')} value={o.include_due_date} onChange={set('include_due_date')} />
          <CheckRow label={p('exclude_ungraded_not_due')} value={o.exclude_ungraded_not_due} onChange={set('exclude_ungraded_not_due')} />
          <CheckRow label={p('group_by_category')} value={o.group_by_category} onChange={set('group_by_category')} />
          <Separator className="my-1" />
          <CheckRow label={c('mailing_labels')} value={o.include_mailing_labels} onChange={set('include_mailing_labels')} />
      </Panel>
      {list}
      {actions}
    </ScrollView>
  );
}
