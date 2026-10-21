import { Stack } from 'expo-router';
import { BookOpenCheck, Download, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, RowItem, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MushafHeatmap, useHz } from '@/features/admin/hifzi';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { sharePublicFile } from '@/lib/share-file';

/**
 * Memorization heatmap, recent recitations and report card PDF (web: /student and /parent hifzi);
 * the parent page also lists the child's achievements (`milestones`).
 */
export function HifziProgressView({ studentId, milestones }: { studentId: string | null; milestones?: boolean }) {
  const { h: t } = useHz();
  const toast = useToast();
  const achievements = useApi(milestones && studentId ? ['portal', 'hifzi-milestones', studentId] : null, ([, , s]) => adminHifzi.milestones(s as string));
  const heatmap = useApi(studentId ? ['portal', 'hifzi-heatmap', studentId] : null, ([, , s]) => adminHifzi.heatmap(s as string));
  const sessions = useApi(studentId ? ['portal', 'hifzi-sessions', studentId] : null, ([, , s]) => adminHifzi.sessions(s as string, 10));
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!studentId) return;
    setBusy(true);
    try {
      const r = await adminHifzi.reportCard(studentId);
      if (!r.success || !r.data?.url) return toast.error(r.error || t('reports.generateError'));
      await sharePublicFile(r.data.url, 'hifzi-report-card.pdf', 'application/pdf');
    } catch {
      toast.error(t('reports.generateError'));
    } finally {
      setBusy(false);
    }
  }

  if (!studentId) return <Text className="text-muted-foreground p-6 text-sm">—</Text>;
  if (heatmap.isLoading || sessions.isLoading) return <LoadingList rows={5} />;
  return (
    <>
      <Stack.Screen options={{ title: t('heatmap.title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              heatmap.mutate();
              sessions.mutate();
              achievements.mutate();
            }}
          />
        }>
        <Button variant="outline" size="sm" className="self-start" onPress={download} disabled={busy}>
          <Icon as={Download} className="size-4" />
          <Text>{t('reports.downloadPdf')}</Text>
        </Button>
        <Panel className="p-4">
          <MushafHeatmap cells={heatmap.data ?? []} />
        </Panel>
        {achievements.data?.length ? (
          <Section title={t('milestones.title')}>
            <View className="flex-row flex-wrap gap-2">
              {achievements.data.map((m) => (
                <View key={m.id} className="bg-warning-soft flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
                  <Icon as={Trophy} className="text-warning size-3.5" />
                  <Text className="text-warning text-xs font-semibold">{t(`milestones.${m.milestoneType === 'syllabus_grade' ? 'syllabusGrade' : m.milestoneType}`, { n: m.unitNumber })}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}
        <Section title={t('recitation.title')}>
          {(sessions.data ?? []).length ? (
            <Panel>
              {(sessions.data ?? []).map((s, i, arr) => (
                <RowItem
                  key={s.id}
                  leading={<IconTile icon={BookOpenCheck} size={36} />}
                  title={s.raw_score?.toFixed(2) ?? '—'}
                  meta={formatDate(s.created_at)}
                  trailing={<StatusChip label={s.grade_code ?? '—'} tone="info" />}
                  last={i === arr.length - 1}
                />
              ))}
            </Panel>
          ) : null}
        </Section>
      </ScrollView>
    </>
  );
}
