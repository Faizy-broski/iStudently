import type { WeatherAlertStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { adminWeather } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUSES: WeatherAlertStatus[] = ['draft', 'approved', 'sent', 'rejected', 'expired'];
const SEVERITY_TONE: Record<string, string> = {
  minor: 'bg-info-soft text-brand dark:text-brand-secondary',
  moderate: 'bg-warning-soft text-warning',
  severe: 'bg-warning-soft text-warning',
  extreme: 'bg-destructive-soft text-destructive',
};

/** Weather alert drafts to approve (sent by push + portal note) or reject, by status (web: /admin/weather-alerts/dashboard). */
export default function WeatherDashboard() {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`weather_alerts.dashboard.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [status, setStatus] = useState<WeatherAlertStatus>('draft');
  const res = useApi(['admin', 'weather-alerts', status, campusId ?? 'school'], ([, , st]) => adminWeather.alerts(st as WeatherAlertStatus, campusId));
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const when = (s: string) => new Date(s).toLocaleString(i18n.language);

  async function approve(id: string) {
    setBusy(id);
    try {
      const r = await adminWeather.approve(id, campusId);
      if (!r.success) return toast.error(r.error || d('approveError'));
      toast.success(d('approveSuccess'));
      res.mutate();
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) return;
    setBusy(id);
    try {
      const r = await adminWeather.reject(id, reason.trim(), campusId);
      if (!r.success) return toast.error(r.error || d('rejectError'));
      toast.success(d('rejectSuccess'));
      setRejecting(null);
      setReason('');
      res.mutate();
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{d('description')}</Text>
        <FilterChips value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: d(`status.${s}`) }))} />
        {res.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState title={d('empty')} />
        ) : (
          list.map((a) => (
            <Card key={a.id}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row flex-wrap items-center gap-2">
                  <View className={cn('rounded-full px-2 py-0.5', SEVERITY_TONE[a.severity])}>
                    <Text className={cn('text-xs capitalize', SEVERITY_TONE[a.severity])}>{d(`severity.${a.severity}`)}</Text>
                  </View>
                  {a.alert_type ? <Text className="text-muted-foreground text-xs">{a.alert_type}</Text> : null}
                </View>
                <Text className="font-semibold">{a.headline}</Text>
                <Text className="text-muted-foreground text-sm">{a.description}</Text>
                <Text className="text-muted-foreground text-xs">
                  {a.effective ? when(a.effective) : ''}
                  {a.expires ? ` — ${when(a.expires)}` : ''}
                </Text>
                {a.status === 'sent' && a.sent_via ? (
                  <Text className="text-muted-foreground text-xs">
                    {d('sentVia', {
                      channels: Object.entries(a.sent_via)
                        .filter(([k, v]) => (k === 'push' || k === 'portalNoteId') && v)
                        .map(([k]) => (k === 'push' ? d('channelPush') : d('channelPortal')))
                        .join(', '),
                    })}
                  </Text>
                ) : null}
                {a.status === 'rejected' && a.rejection_reason ? <Text className="text-muted-foreground text-xs">{d('rejectedReason', { reason: a.rejection_reason })}</Text> : null}
                {a.status === 'draft' ? (
                  <View className="flex-row gap-2">
                    <Button size="sm" onPress={() => approve(a.id)} disabled={busy === a.id}>
                      <Icon as={Check} className="text-primary-foreground size-4" />
                      <Text>{d('approve')}</Text>
                    </Button>
                    <Button size="sm" variant="outline" onPress={() => setRejecting(rejecting === a.id ? null : a.id)}>
                      <Icon as={X} className="text-foreground size-4" />
                      <Text>{d('reject')}</Text>
                    </Button>
                  </View>
                ) : null}
                {rejecting === a.id ? (
                  <View className="border-border gap-2 border-t pt-2">
                    <Textarea value={reason} onChangeText={setReason} placeholder={d('rejectReasonPlaceholder')} />
                    <Button size="sm" variant="destructive" className="self-start" disabled={!reason.trim() || busy === a.id} onPress={() => reject(a.id)}>
                      <Text>{d('confirmReject')}</Text>
                    </Button>
                  </View>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
