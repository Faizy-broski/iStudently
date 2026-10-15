import { Stack } from 'expo-router';
import { KeyRound, MapPin, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';

const DEFAULTS = { radius_m: 150, max_accuracy_m: 50, photo_retention_days: 7 };
const num = (v: string) => v.replace(/[^0-9.-]/g, '');

/** Miqat school settings: geofence, attendance policy, photo retention, signing key (web: /admin/miqat/settings). */
export default function MiqatSettings() {
  const { t } = useTranslation();
  const s = (k: string) => t(`miqat.settings.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const config = useApi(['admin', 'miqat-config'], () => adminMiqat.schoolConfig());
  const existing = config.data ?? null;
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(String(DEFAULTS.radius_m));
  const [accuracy, setAccuracy] = useState(String(DEFAULTS.max_accuracy_m));
  const [retention, setRetention] = useState(String(DEFAULTS.photo_retention_days));
  const [start, setStart] = useState('07:00');
  const [grace, setGrace] = useState('5');
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!config.data) return;
    const c = config.data;
    setLat(String(c.lat ?? ''));
    setLng(String(c.lng ?? ''));
    setRadius(String(c.radius_m));
    setAccuracy(String(c.max_accuracy_m));
    setRetention(String(c.photo_retention_days));
    const policy = c.policy_json as { official_start_minutes?: number; grace_period_minutes?: number };
    if (policy?.official_start_minutes != null) setStart(`${String(Math.floor(policy.official_start_minutes / 60)).padStart(2, '0')}:${String(policy.official_start_minutes % 60).padStart(2, '0')}`);
    if (policy?.grace_period_minutes != null) setGrace(String(policy.grace_period_minutes));
  }, [config.data]);

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return toast.error(s('locationError'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
    } catch {
      toast.error(t('app.mq_location_rebuild'));
    } finally {
      setLocating(false);
    }
  }

  const base = () => ({ lat: parseFloat(lat), lng: parseFloat(lng), radius_m: parseInt(radius, 10), max_accuracy_m: parseInt(accuracy, 10), photo_retention_days: parseInt(retention, 10) });

  async function save() {
    const [h, m] = start.split(':').map(Number);
    setSaving(true);
    try {
      const res = await adminMiqat.saveSchoolConfig({ ...base(), policy_json: { official_start_minutes: h * 60 + (m || 0), grace_period_minutes: parseInt(grace, 10), late_cutoff_minutes: h * 60 + (m || 0) + 60 } });
      if (!res.success) return toast.error(res.error || s('saveError'));
      toast.success(s('saveSuccess'));
      config.mutate(res.data ?? null, { revalidate: false });
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    if (!(await confirm({ title: s('rotateKeyTitle'), body: s('rotateKeyConfirm'), destructive: true, confirmLabel: s('rotateKeyButton') }))) return;
    setRotating(true);
    try {
      const res = await adminMiqat.saveSchoolConfig({ ...base(), policy_json: existing?.policy_json ?? {}, rotate_signing_key: true });
      if (!res.success) return toast.error(res.error || s('rotateKeyError'));
      toast.success(s('rotateKeySuccess'));
      config.mutate(res.data ?? null, { revalidate: false });
    } finally {
      setRotating(false);
    }
  }

  if (config.isLoading) return <LoadingList rows={4} />;

  const field = (label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <View className="flex-1 gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChangeText={(v) => set(num(v))} keyboardType="numbers-and-punctuation" placeholder={placeholder} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {!existing ? <Text variant="muted" className="text-sm">{s('firstTimeNotice')}</Text> : null}
        <Card>
          <CardHeader>
            <CardTitle>{s('geofenceTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row gap-3">
              {field(s('lat'), lat, setLat, '32.8872')}
              {field(s('lng'), lng, setLng, '13.1913')}
            </View>
            <Button variant="outline" onPress={useCurrentLocation} disabled={locating}>
              <Icon as={MapPin} className="text-foreground size-4" />
              <Text>{s('useCurrentLocation')}</Text>
            </Button>
            <View className="flex-row gap-3">
              {field(s('radiusM'), radius, setRadius)}
              {field(s('maxAccuracyM'), accuracy, setAccuracy)}
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{s('policyTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-row gap-3">
            <TimeField className="flex-1" label={s('officialStart')} value={start} onChange={setStart} />
            {field(s('gracePeriod'), grace, setGrace)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{s('photoTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="w-40">{field(s('photoRetentionDays'), retention, setRetention)}</View>
          </CardContent>
        </Card>
        <Button onPress={save} disabled={saving || !lat || !lng}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{s('save')}</Text>
        </Button>
        {existing ? (
          <Card>
            <CardHeader>
              <CardTitle>{s('rotateKeyTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <Text variant="muted" className="text-sm">{s('rotateKeyDesc')}</Text>
              <Button variant="destructive" onPress={rotate} disabled={rotating}>
                <Icon as={KeyRound} className="size-4 text-white" />
                <Text>{s('rotateKeyButton')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
