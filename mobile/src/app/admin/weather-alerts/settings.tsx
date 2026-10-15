import type { AlertSeverity } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminWeather } from '@/lib/api';
import { useApi } from '@/lib/data';

const SEVERITIES: AlertSeverity[] = ['minor', 'moderate', 'severe', 'extreme'];

/** Weather alert detection threshold and location, with a connection test (web: /admin/weather-alerts/settings). */
export default function WeatherSettings() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`weather_alerts.settings.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'weather-config', campusId ?? 'school'], () => adminWeather.config(campusId));
  const [threshold, setThreshold] = useState<AlertSeverity>('moderate');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const cfg = res.data ?? null;
  const cfgKey = cfg ? `${cfg.id}:${cfg.severity_threshold}:${cfg.location_query_override ?? ''}` : null;
  useEffect(() => {
    if (!cfg) return;
    setThreshold(cfg.severity_threshold);
    setLocation(cfg.location_query_override || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);

  async function save() {
    setSaving(true);
    try {
      const r = await adminWeather.saveConfig({ severity_threshold: threshold, location_query_override: location.trim() || null }, campusId);
      if (!r.success) return toast.error(r.error || s('saveError'));
      toast.success(s('saveSuccess'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await adminWeather.testConnection(campusId);
      if (!r.success || !r.data) return toast.error(r.error || s('testError'));
      toast.success(s('testSuccess', { location: r.data.resolvedLocation }));
    } finally {
      setTesting(false);
    }
  }

  if (res.isLoading) return <LoadingList />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{s('description')}</Text>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{s('detectionTitle')}</Text>
            <Label>{s('severityThreshold')}</Label>
            <Picker value={threshold} onChange={(v) => setThreshold(v as AlertSeverity)} options={SEVERITIES.map((x) => ({ value: x, label: s(`severity.${x}`) }))} />
            <Text className="text-muted-foreground text-xs">{s('severityThresholdHint')}</Text>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{s('locationTitle')}</Text>
            <Text className="text-muted-foreground text-sm">{s('locationHint')}</Text>
            <Label>{s('locationOverride')}</Label>
            <Input value={location} onChangeText={setLocation} placeholder={s('locationOverridePlaceholder')} />
            <Text className="text-muted-foreground text-xs">{s('locationOverrideHint')}</Text>
            <Button variant="outline" className="self-start" onPress={test} disabled={testing}>
              <Icon as={Wifi} className="text-foreground size-4" />
              <Text>{s('testConnection')}</Text>
            </Button>
            {cfg?.last_polled_at ? (
              <Text className="text-muted-foreground text-xs">{cfg.last_poll_status === 'error' ? s('lastPollError', { error: cfg.last_poll_error || '' }) : s('lastPollOk', { time: new Date(cfg.last_polled_at).toLocaleString(i18n.language) })}</Text>
            ) : null}
          </CardContent>
        </Card>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{s('save')}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
