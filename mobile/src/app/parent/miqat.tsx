import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, Send, XCircle, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useChild } from '@/features/parent/child';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const STATUS: Record<string, [LucideIcon, string]> = {
  present: [CheckCircle2, 'text-green-600'],
  late: [Clock, 'text-amber-600'],
  absent: [XCircle, 'text-red-600'],
  excused: [CheckCircle2, 'text-blue-600'],
  unclosed: [AlertTriangle, 'text-amber-600'],
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Miqat gate attendance of the selected child this month, accumulated lateness, and a full-day
 * excuse request for today (web: /parent/miqat).
 */
export default function ParentMiqat() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`miqat.guardian.${k}`, o);
  const toast = useToast();
  const { childId } = useChild();
  const kids = useApi(['parent', 'miqat-children'], () => adminMiqat.myChildren());
  // Miqat addresses people by profile id; follow the app's child switcher.
  const kid = (kids.data ?? []).find((c) => c.studentId === childId) ?? kids.data?.[0] ?? null;
  const personId = kid?.profileId ?? null;
  const [range] = useState(() => {
    const now = new Date();
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  });
  const days = useApi(personId ? ['parent', 'miqat-days', personId, range.from, range.to] : null, ([, , p, f, to]) => adminMiqat.childDays(p as string, f as string, to as string));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!personId || !reason.trim()) return;
    setBusy(true);
    const today = ymd(new Date());
    const r = await adminMiqat.createPermission({ person_id: personId, type: 'full_day', date_from: today, date_to: today, reason: reason.trim() });
    setBusy(false);
    if (!r.success) return toast.error(r.error || g('requestError'));
    toast.success(g('requestSubmitted'));
    setReason('');
  }

  if (kids.isLoading) return <LoadingList rows={4} />;
  if (!kid) return <Text className="text-muted-foreground p-6">{g('noChildren')}</Text>;
  const list = days.data ?? [];
  const lateness = list.reduce((s, d) => s + (d.lateness_minutes || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([kids.mutate(), days.mutate()])} />}>
        <Text variant="muted">{`${kid.firstName} ${kid.lastName}`}</Text>
        <Card>
          <CardContent className="p-4">
            <Text className="text-muted-foreground text-sm">{g('accumulatedLateness')}</Text>
            <Text className="text-2xl font-bold">{`${lateness} ${g('minutes')}`}</Text>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-0 py-0">
            {days.isLoading ? (
              <LoadingList rows={3} />
            ) : !list.length ? (
              <Text className="text-muted-foreground p-4 text-sm">{g('noRecords')}</Text>
            ) : (
              list.map((d) => {
                const [icon, tone] = STATUS[d.status] ?? [Clock, 'text-muted-foreground'];
                return (
                  <View key={d.id} className="border-border flex-row items-center justify-between gap-2 border-b p-3 last:border-b-0">
                    <Text className="text-sm">{formatDate(d.date)}</Text>
                    <View className="flex-row items-center gap-2">
                      <Icon as={icon} className={`size-4 ${tone}`} />
                      <Badge variant="outline">
                        <Text className="text-xs">{g(`status.${d.status}`, { defaultValue: d.status })}</Text>
                      </Badge>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-3 p-4">
            <Text className="font-medium">{g('submitExcuse')}</Text>
            <Textarea value={reason} onChangeText={setReason} placeholder={g('reasonPlaceholder')} />
            <Button className="self-start" onPress={submit} disabled={busy || !reason.trim()}>
              <Icon as={Send} className="text-primary-foreground size-4" />
              <Text>{g('submit')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
