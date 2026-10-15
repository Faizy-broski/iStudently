import { Stack } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CirclePicker, MushafHeatmap, NoCircles, NoRoster, RosterPicker, useHifziCircles, useHifziRoster, useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { sharePublicFile } from '@/lib/share-file';

/** Per-student memorization heatmap and Hifzi report card PDF (web: /admin/hifzi/reports). */
export default function HifziReports() {
  const { h } = useHz('reports');
  const toast = useToast();
  const { campusId } = useCampus();
  const circles = useHifziCircles();
  const list = circles.data ?? [];
  const [pickedCircle, setPickedCircle] = useState('');
  const circleId = list.some((c) => c.id === pickedCircle) ? pickedCircle : (list[0]?.id ?? '');
  const roster = useHifziRoster(circleId || null);
  const rows = roster.data ?? [];
  const [pickedStudent, setPickedStudent] = useState('');
  const studentId = rows.some((e) => e.student_id === pickedStudent) ? pickedStudent : (rows[0]?.student_id ?? '');
  const heatmap = useApi(studentId ? ['admin', 'hifzi-heatmap', studentId, campusId ?? 'school'] : null, ([, , s]) => adminHifzi.heatmap(s as string, campusId));
  const [generating, setGenerating] = useState(false);

  async function download() {
    if (!studentId) return;
    setGenerating(true);
    try {
      const res = await adminHifzi.reportCard(studentId, campusId);
      if (!res.success || !res.data?.url) return toast.error(res.error || h('generateError'));
      await sharePublicFile(res.data.url, `hifzi-report-card-${studentId.slice(0, 8)}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : h('generateError'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => heatmap.mutate()} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : circles.error ? (
          <ErrorState message={circles.error.message} onRetry={() => circles.mutate()} />
        ) : !list.length ? (
          <NoCircles />
        ) : (
          <>
            <CirclePicker circles={list} value={circleId} onChange={setPickedCircle} />
            {rows.length ? <RosterPicker roster={rows} value={studentId} onChange={setPickedStudent} /> : null}
            <Button variant="outline" onPress={download} disabled={generating || !studentId}>
              <Icon as={Download} className="text-foreground size-4" />
              <Text>{generating ? h('generating') : h('downloadPdf')}</Text>
            </Button>
            {roster.isLoading ? (
              <LoadingList rows={2} />
            ) : !rows.length ? (
              <NoRoster circleId={circleId} />
            ) : heatmap.isLoading ? (
              <LoadingList rows={3} />
            ) : heatmap.error ? (
              <ErrorState message={heatmap.error.message} onRetry={() => heatmap.mutate()} />
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <MushafHeatmap cells={heatmap.data ?? []} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
