import type { FinaReport } from '@studently/api-client';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSupervisorOverview } from '@/features/fina-supervisor/data';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { sharePublicFile } from '@/lib/share-file';

/** Monthly compliance reports of the municipality's schools: download only (web: /fina-supervisor/reports). */
export default function FinaSupervisorReports() {
  const { t, i18n } = useTranslation();
  const f = (k: string) => t(`fina.reports.${k}`);
  const toast = useToast();
  const overview = useSupervisorOverview();
  const res = useApi(['fina-supervisor', 'reports'], () => fina.reports());
  const [busy, setBusy] = useState<string | null>(null);
  const names = new Map((overview.data?.schools ?? []).map((s) => [s.id, s.name]));

  async function download(rep: FinaReport) {
    setBusy(rep.id);
    try {
      const r = await fina.reportDownload(rep.id);
      if (!r.success || !r.data?.url) return toast.error(r.error || t('app.fn_download_failed'));
      await sharePublicFile(r.data.url, `fina-report-${rep.period}.pdf`, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('app.fn_download_failed'));
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{f('page_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !list.length ? (
          <EmptyState title={f('empty')} />
        ) : (
          <Card>
            <CardContent className="py-1">
              {list.map((rep, i) => (
                <View key={rep.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{names.get(rep.school_id) || rep.school_id}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {rep.period} · {f('col_generated')}: {new Date(rep.generated_at).toLocaleDateString(i18n.language)}
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
