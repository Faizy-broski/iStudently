import { Stack } from 'expo-router';
import { Download, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <Card>
          <CardContent className="p-4">
            <MushafHeatmap cells={heatmap.data ?? []} />
          </CardContent>
        </Card>
        {achievements.data?.length ? (
          <View className="gap-2">
            <Text className="text-lg font-semibold">{t('milestones.title')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {achievements.data.map((m) => (
                <Badge key={m.id} variant="secondary" className="flex-row items-center gap-1.5 px-3 py-1.5">
                  <Icon as={Trophy} className="size-3.5 text-amber-500" />
                  <Text>{t(`milestones.${m.milestoneType === 'syllabus_grade' ? 'syllabusGrade' : m.milestoneType}`, { n: m.unitNumber })}</Text>
                </Badge>
              ))}
            </View>
          </View>
        ) : null}
        <Text className="text-lg font-semibold">{t('recitation.title')}</Text>
        {(sessions.data ?? []).map((s) => (
          <Card key={s.id} className="py-3">
            <CardContent className="flex-row items-center justify-between px-3">
              <Text className="text-muted-foreground text-sm">{formatDate(s.created_at)}</Text>
              <Badge variant="secondary">
                <Text>{s.grade_code ?? '—'}</Text>
              </Badge>
              <Text className="font-medium">{s.raw_score?.toFixed(2) ?? '—'}</Text>
            </CardContent>
          </Card>
        ))}
        <View />
      </ScrollView>
    </>
  );
}
