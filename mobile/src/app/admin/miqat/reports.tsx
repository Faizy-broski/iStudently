import { miqatDownloads } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, Check, Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { DateField, monthNames, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

const FLAG_LABEL: Record<string, string> = {
  same_weekday_absences: 'sameWeekdayAbsences',
  gate_present_period_absent: 'gatePresentPeriodAbsent',
  chronic_early_checkout: 'chronicEarlyCheckout',
  teacher_not_scanning: 'teacherNotScanning',
};
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** HR timesheet and ministry exports (Excel) and pattern flags (web: /admin/miqat/reports). */
export default function MiqatReports() {
  const { t, i18n } = useTranslation();
  const r = (k: string) => t(`miqat.reports.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [from, setFrom] = useState(() => `${todayYmd().slice(0, 8)}01`);
  const [to, setTo] = useState(todayYmd);
  const [exporting, setExporting] = useState<'timesheet' | 'ministry' | null>(null);
  const flags = useApi(['admin', 'miqat-flags', campusId ?? 'school'], () => adminMiqat.flags(campusId));
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  async function exportFile(kind: 'timesheet' | 'ministry') {
    setExporting(kind);
    try {
      if (kind === 'timesheet') await shareApiFile(miqatDownloads.timesheet(ym, campusId), `Miqat_Timesheet_${ym}.xlsx`, XLSX);
      else await shareApiFile(miqatDownloads.ministry(from, to, campusId), `Miqat_Ministry_${from}_${to}.xlsx`, XLSX);
    } catch {
      toast.error(r('exportError'));
    } finally {
      setExporting(null);
    }
  }

  async function acknowledge(id: string) {
    const res = await adminMiqat.acknowledgeFlag(id, campusId);
    if (!res.success) return toast.error(res.error || r('acknowledgeError'));
    flags.mutate((rows) => rows?.filter((f) => f.id !== id), { revalidate: false });
  }

  return (
    <>
      <Stack.Screen options={{ title: r('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-4 p-4">
              <Card>
                <CardHeader>
                  <CardTitle>{r('hrTimesheet')}</CardTitle>
                </CardHeader>
                <CardContent className="gap-3">
                  <View className="flex-row gap-2">
                    <Picker className="flex-1" value={String(month)} onChange={(v) => setMonth(Number(v))} options={monthNames(i18n.language).map((n, i) => ({ value: String(i + 1), label: n }))} />
                    <Picker className="w-28" value={String(year)} onChange={(v) => setYear(Number(v))} options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))} />
                  </View>
                  <Button onPress={() => exportFile('timesheet')} disabled={exporting === 'timesheet'}>
                    <Icon as={Download} className="text-primary-foreground size-4" />
                    <Text>{r('download')}</Text>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{r('ministryReport')}</CardTitle>
                </CardHeader>
                <CardContent className="gap-3">
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={from} onChange={(d) => d && setFrom(d)} />
                    <DateField className="flex-1" value={to} onChange={(d) => d && setTo(d)} />
                  </View>
                  <Button onPress={() => exportFile('ministry')} disabled={exporting === 'ministry'}>
                    <Icon as={Download} className="text-primary-foreground size-4" />
                    <Text>{r('download')}</Text>
                  </Button>
                  <Text className="text-muted-foreground text-xs">{r('ministryPlaceholderNotice')}</Text>
                </CardContent>
              </Card>
              <View className="flex-row items-center gap-2">
                <Icon as={AlertTriangle} className="size-4 text-amber-600" />
                <Text className="font-semibold">{r('patternFlags')}</Text>
              </View>
            </View>
          }
          items={flags.data}
          error={flags.error}
          isLoading={flags.isLoading}
          onRefresh={() => flags.mutate()}
          emptyTitle={r('noFlags')}
          keyExtractor={(f) => f.id}
          renderItem={(f) => (
            <View className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-1">
                <Text className="font-medium">{f.profiles ? `${f.profiles.first_name} ${f.profiles.last_name}` : f.person_id}</Text>
                <Badge variant="outline" className="self-start">
                  <Text>{FLAG_LABEL[f.flag_type] ? r(FLAG_LABEL[f.flag_type]) : f.flag_type}</Text>
                </Badge>
              </View>
              <Button size="sm" variant="ghost" onPress={() => acknowledge(f.id)}>
                <Icon as={Check} className="text-foreground size-4" />
                <Text>{r('acknowledge')}</Text>
              </Button>
            </View>
          )}
        />
      </View>
    </>
  );
}
