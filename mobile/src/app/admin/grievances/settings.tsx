import type { GrievanceSettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { complaints } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Complaint settings: SLA, attachment size, anonymity/confidentiality/reopen, notification channels (web: /admin/grievances/settings). */
export default function GrievanceSettingsScreen() {
  const { t } = useTranslation();
  const s = (k: string) => t(`grievances.settings.${k}`);
  const toast = useToast();
  const res = useApi(['grievance-settings'], () => complaints.getSettings());
  const [form, setForm] = useState<GrievanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (res.data) setForm(res.data);
  }, [res.data]);

  if (res.isLoading) return <LoadingList rows={4} />;
  if (!form) return <ErrorState message={s('err_load_failed')} onRetry={() => res.mutate()} />;
  const patch = (u: Partial<GrievanceSettings>) => setForm((p) => (p ? { ...p, ...u } : p));
  const ch = form.notification_channels;

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const r = await complaints.updateSettings(form);
      if (!r.success) return toast.error(r.error || s('err_save_failed'));
      toast.success(s('msg_saved'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader>
            <CardTitle>{s('title')}</CardTitle>
            <CardDescription>{s('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <View className="gap-1.5">
              <Label>{s('label_sla_days')}</Label>
              <Input className="w-32" keyboardType="number-pad" value={String(form.sla_days_default)} onChangeText={(v) => patch({ sla_days_default: parseInt(v, 10) || 1 })} />
            </View>
            <View className="gap-1.5">
              <Label>{s('label_max_attachment')}</Label>
              <Input className="w-32" keyboardType="number-pad" value={String(form.max_attachment_mb)} onChangeText={(v) => patch({ max_attachment_mb: parseInt(v, 10) || 1 })} />
            </View>
            <View className="gap-1">
              <CheckRow checked={form.allow_anonymous} onPress={() => patch({ allow_anonymous: !form.allow_anonymous })} label={s('allow_anonymous')} />
              <CheckRow checked={form.allow_confidential} onPress={() => patch({ allow_confidential: !form.allow_confidential })} label={s('allow_confidential')} />
              <CheckRow checked={form.allow_reopen} onPress={() => patch({ allow_reopen: !form.allow_reopen })} label={s('allow_reopen')} />
            </View>
            <View className="gap-1">
              <Label>{s('notification_channels')}</Label>
              <CheckRow checked={ch.in_app} onPress={() => patch({ notification_channels: { ...ch, in_app: !ch.in_app } })} label={s('in_app_notifications')} />
              <CheckRow checked={ch.email} onPress={() => patch({ notification_channels: { ...ch, email: !ch.email } })} label={s('email_notifications')} />
              <CheckRow checked={ch.push} onPress={() => patch({ notification_channels: { ...ch, push: !ch.push } })} label={s('push_notifications')} />
            </View>
            <Button onPress={save} disabled={saving}>
              <Text>{s('btn_save')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
