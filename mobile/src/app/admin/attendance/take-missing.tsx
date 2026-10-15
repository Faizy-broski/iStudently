import { Stack } from 'expo-router';
import { CheckCircle2, Info, Play } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminAttendance } from '@/lib/api';

/** Generate missing attendance records for a date range (web: /admin/attendance/take-missing). */
export default function TakeMissingAttendance() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`attendance.${k}`, o);
  const toast = useToast();
  const [from, setFrom] = useState(todayYmd);
  const [to, setTo] = useState(todayYmd);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ total: number; days: number } | null>(null);

  async function run() {
    if (!from || !to) return toast.error(a('print_selectDateRange'));
    if (from > to) return toast.error(a('addAbsences_fromDateError'));
    setRunning(true);
    setResult(null);
    try {
      const res = await adminAttendance.generateRange({ from_date: from, to_date: to });
      if (res.success && res.data) {
        setResult({ total: res.data.total_generated, days: res.data.days_processed });
        toast.success(a('takeMissing_generated', { total: res.data.total_generated, days: res.data.days_processed }));
      } else toast.error(res.error || a('recalculate_generateFailed'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: a('takeMissing') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4">
        <Text variant="muted">{a('takeMissing_subtitle')}</Text>
        <View className="flex-row gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <Icon as={Info} className="size-5 text-blue-600" />
          <View className="flex-1">
            <Text className="text-sm font-medium text-blue-800 dark:text-blue-300">{a('takeMissing_howItWorks')}</Text>
            <Text className="mt-1 text-sm text-blue-800 dark:text-blue-300">{a('takeMissing_explanation')}</Text>
          </View>
        </View>
        <Card>
          <CardHeader>
            <CardTitle>{a('timeframe')}</CardTitle>
            <CardDescription>{a('recalculate_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={a('recalculate_from')} value={from} onChange={setFrom} />
              <DateField className="flex-1" label={a('recalculate_to')} value={to} onChange={setTo} />
            </View>
            <Text className="text-muted-foreground text-xs">{a('print_maxRange')}</Text>
            <Button onPress={run} disabled={running}>
              <Icon as={Play} className="text-primary-foreground size-4" />
              <Text>{running ? a('takeMissing_processing') : a('takeMissing')}</Text>
            </Button>
            {result ? (
              <View className="flex-row items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
                <Icon as={CheckCircle2} className="size-4 text-green-600" />
                <Text className="flex-1 text-sm text-green-800 dark:text-green-300">{a('takeMissing_generated', { total: result.total, days: result.days })}</Text>
              </View>
            ) : null}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
