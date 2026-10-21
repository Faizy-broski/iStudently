import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PillPicker } from '@/features/inspector/ui';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Pick a submitted evaluation, create its report or open it to sign and generate the PDF (web: /inspector/visits/[id]/report). */
export default function VisitReport() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.reports.${key}`);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const visit = useApi(id ? ['inspector', 'visit', id] : null, ([, , v]) => inspector.visit(v as string));
  const evals = useApi(id ? ['inspector', 'visit-evaluations', id] : null, ([, , v]) => inspector.evaluationsForVisit(v as string));
  const submitted = (evals.data ?? []).filter((e) => e.status !== 'draft');
  const [picked, setPicked] = useState<string | null>(null);
  const evalId = picked ?? submitted[0]?.id ?? null;
  const report = useApi(evalId ? ['inspector', 'report-for-eval', evalId] : null, ([, , e]) => inspector.reportForEvaluation(e as string));
  const [busy, setBusy] = useState(false);
  const reportId = report.data?.id ?? null;

  async function create() {
    if (!evalId) return;
    setBusy(true);
    const r = await inspector.createReport(evalId);
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    report.mutate();
    router.push({ pathname: '/inspector/reports/[id]', params: { id: r.data.id } });
  }

  if (visit.isLoading || evals.isLoading) return <LoadingList rows={3} />;
  const v = visit.data;
  if (!v) return <ErrorState message={k('visit_not_found')} onRetry={() => visit.mutate()} />;
  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => report.mutate()} />}>
        <Text variant="muted" className="text-sm">{`${v.school?.name ?? ''} · ${v.scheduled_date}`}</Text>
        {!submitted.length ? (
          <EmptyState icon={FileText} title={k('no_evaluations')} />
        ) : (
          <>
            {submitted.length > 1 ? <PillPicker items={submitted.map((e) => ({ value: e.id, label: `${e.teacher.first_name} ${e.teacher.last_name}` }))} value={evalId} onChange={setPicked} /> : null}
            {report.isLoading ? (
              <LoadingList rows={2} />
            ) : reportId ? (
              <Button onPress={() => router.push({ pathname: '/inspector/reports/[id]', params: { id: reportId } })}>
                <Icon as={FileText} className="text-primary-foreground size-4" />
                <Text>{t('app.in_open_report')}</Text>
              </Button>
            ) : (
              <Panel className="items-center gap-3 px-4 py-10">
                  <Text className="text-muted-foreground text-sm">{k('no_report_yet')}</Text>
                  <Button onPress={create} disabled={busy}>
                    <Icon as={FileText} className="text-primary-foreground size-4" />
                    <Text>{k('btn_create_report')}</Text>
                  </Button>
              </Panel>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
