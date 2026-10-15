import { router, Stack } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';

/** Recalculate daily attendance for a date range (web: /admin/attendance/recalculate). */
export default function RecalculateAttendance() {
  const { t } = useTranslation();
  const a = (k: string) => t(`attendance.${k}`);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(todayYmd);
  const [end, setEnd] = useState(todayYmd);
  const [busy, setBusy] = useState(false);

  async function ok() {
    if (!schoolId) return;
    if (start > end) return toast.error(t('app.at_range_order'));
    setBusy(true);
    try {
      const res = await adminAttendance.recalculate({ school_id: schoolId, start_date: start, end_date: end, campus_id: campusId });
      if (res.data) toast.success(t('app.at_recalculated', { count: res.data.recalculated }));
      else toast.error(res.error || a('recalculate_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: a('recalculate_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="p-4">
        <Card>
          <CardHeader className="bg-muted/50 border-border border-b">
            <CardTitle className="text-center text-base uppercase">{a('recalculate_confirm')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4 pt-6">
            <Text className="text-center font-semibold">{a('recalculate_when')}</Text>
            <DateField label={a('recalculate_from')} value={start} onChange={(d) => d && setStart(d)} />
            <DateField label={a('recalculate_to')} value={end} onChange={(d) => d && setEnd(d)} />
            {busy ? (
              <View className="flex-row items-center justify-center gap-2 py-2">
                <ActivityIndicator />
                <Text variant="muted">{a('recalculate_subtitle')}</Text>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <Button variant="outline" className="flex-1" onPress={ok}>
                  <Icon as={RefreshCw} className="text-foreground size-4" />
                  <Text>{a('recalculate_ok')}</Text>
                </Button>
                <Button className="flex-1" onPress={() => router.back()}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
