import type { FinaReport } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Download, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { sharePublicFile } from '@/lib/share-file';

/** Monthly Fina compliance reports: generate and download (web: /admin/fina/reports). */
export default function FinaReports() {
  const { f, a, lang } = useFn('reports');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-reports', campusId ?? 'school'], () => fina.reports(campusId));
  const [busy, setBusy] = useState<string | null>(null);

  async function generate() {
    setBusy('gen');
    try {
      const r = await fina.generateReport(campusId);
      if (!r.success) return toast.error(r.error || '');
      toast.success(f('generate_button'));
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  async function download(rep: FinaReport) {
    setBusy(rep.id);
    try {
      const r = await fina.reportDownload(rep.id, campusId);
      if (!r.success || !r.data?.url) return toast.error(r.error || a('fn_download_failed'));
      await sharePublicFile(r.data.url, `fina-report-${rep.period}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : a('fn_download_failed'));
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('page_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{f('page_subtitle')}</Text>
        <Button onPress={generate} disabled={busy === 'gen'}>
          <Icon as={FileText} className="text-primary-foreground size-4" />
          <Text>{busy === 'gen' ? f('generating') : f('generate_button')}</Text>
        </Button>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{f('empty')}</Text>
        ) : (
          <Card>
            <CardContent className="py-1">
              {list.map((rep, i) => (
                <View key={rep.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="font-medium">{rep.period}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {f('col_generated')}: {new Date(rep.generated_at).toLocaleDateString(lang)}
                      </Text>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => download(rep)} disabled={busy === rep.id}>
                      <Icon as={Download} className="text-foreground size-3.5" />
                      <Text>{f('download_button')}</Text>
                    </Button>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
