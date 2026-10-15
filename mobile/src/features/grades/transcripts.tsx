import type { TranscriptOptions } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { usePrintContext } from '@/features/admin/print-context';
import { ReportActions } from '@/features/admin/report-actions';
import { outputReports } from '@/features/admin/report-print';
import { CheckRow } from '@/features/admin/report-students';
import { adminGrades } from '@/lib/api';

/** Transcripts for chosen students (web: /admin and /parent grades/transcripts). Admin passes a student picker as `list`; the parent page passes the selected child. */
export function TranscriptsView({ ctx, campusId, chosen, list, subtitle }: { ctx: ReturnType<typeof usePrintContext>; campusId: string | null | undefined; chosen: () => string[]; list: ReactNode; subtitle?: string }) {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.transcripts.${k}`, o);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const toast = useToast();
  const [o, setO] = useState({ include_grades: true, include_student_photo: false, include_comments: false, include_credits: true, include_credit_hours: false, include_studies_certificate: false, include_graduation_paths: false });
  const [lastRow, setLastRow] = useState<TranscriptOptions['last_row']>('na');
  const [types, setTypes] = useState({ QTR: false, SEM: false, FY: false });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof o) => (v: boolean) => setO({ ...o, [k]: v });

  async function run(mode: 'print' | 'pdf') {
    const students = chosen();
    if (!students.length) return toast.error(c('select_student_error'));
    setBusy(true);
    try {
      const r = await adminGrades.generateTranscripts({
        student_ids: students,
        campus_id: campusId ?? undefined,
        options: { ...o, last_row: lastRow, marking_period_types: (['QTR', 'SEM', 'FY'] as const).filter((k) => types[k]) },
      });
      if (!r.success) return toast.error(r.error || s('toast_generate_failed'));
      const n = await outputReports({ title: t('app.rp_transcript'), cards: r.data?.transcripts ?? [], ctx, t, mode, fileName: 'transcripts.pdf' });
      if (!n) toast.success(s('toast_generated_count', { count: students.length }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : s('toast_generate_failed'));
    } finally {
      setBusy(false);
    }
  }

  const actions = <ReportActions label={s('btn_create')} busy={busy} ready={ctx.ready} onRun={run} />;
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: s('title') }} />
      <Text className="text-muted-foreground text-sm">{subtitle ?? s('subtitle')}</Text>
      {actions}
      <Card>
        <CardContent className="gap-1 pt-4">
          <Text className="pb-1 text-xs font-semibold uppercase">{s('include_on_transcript')}</Text>
          <CheckRow label={s('include_grades')} value={o.include_grades} onChange={set('include_grades')} />
          <CheckRow label={s('include_student_photo')} value={o.include_student_photo} onChange={set('include_student_photo')} />
          <CheckRow label={s('include_comments')} value={o.include_comments} onChange={set('include_comments')} />
          <CheckRow label={s('include_credits')} value={o.include_credits} onChange={set('include_credits')} />
          <CheckRow label={s('include_credit_hours')} value={o.include_credit_hours} onChange={set('include_credit_hours')} />
          <Separator className="my-1" />
          <Text className="text-muted-foreground text-xs">{c('last_row')}</Text>
          <FilterChips
            value={lastRow}
            onChange={setLastRow}
            options={[
              { value: 'na', label: t('common.na') },
              { value: 'gpa', label: s('gpa') },
              { value: 'total', label: c('total') },
            ]}
          />
          <Separator className="my-1" />
          <CheckRow label={s('studies_certificate')} value={o.include_studies_certificate} onChange={set('include_studies_certificate')} />
          <Separator className="my-1" />
          <Text className="text-xs font-semibold uppercase">{c('marking_periods')}</Text>
          <CheckRow label={s('quarter')} value={types.QTR} onChange={(v) => setTypes({ ...types, QTR: v })} />
          <CheckRow label={s('semester')} value={types.SEM} onChange={(v) => setTypes({ ...types, SEM: v })} />
          <CheckRow label={s('year')} value={types.FY} onChange={(v) => setTypes({ ...types, FY: v })} />
          <Separator className="my-1" />
          <CheckRow label={s('graduation_paths')} value={o.include_graduation_paths} onChange={set('include_graduation_paths')} />
        </CardContent>
      </Card>
      {list}
      {actions}
    </ScrollView>
  );
}
