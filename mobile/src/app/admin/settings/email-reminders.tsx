import { Stack } from 'expo-router';
import { Bell, CalendarDays, Clock, Info, Mail, Save, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { ErrorState, LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { IconTile } from '@/components/app/layout';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** Daily class-diary reminder emails to teachers: on/off, time, days, test send (web: /admin/settings/email-reminders, school-wide). */
export default function EmailRemindersSettings() {
  const { t } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`school.email_reminders.${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const myEmail = me.status === 'ready' ? (me.me.profile.email ?? '') : '';
  // The web page reads/writes the school-wide row (no campus).
  const res = useApi(['admin', 'school-settings', 'school'], () => adminSchool.getSettings());
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [testEmail, setTestEmail] = useState(myEmail);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const data = res.data;
  const dataKey = data ? JSON.stringify([data.diary_reminder_enabled, data.diary_reminder_time, data.diary_reminder_days]) : null;
  useEffect(() => {
    if (!data) return;
    if (typeof data.diary_reminder_enabled === 'boolean') setEnabled(data.diary_reminder_enabled);
    if (typeof data.diary_reminder_time === 'string' && data.diary_reminder_time) setTime(data.diary_reminder_time.slice(0, 5));
    if (Array.isArray(data.diary_reminder_days)) setDays(data.diary_reminder_days as number[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const toggleDay = (d: number) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  async function save() {
    if (!days.length && enabled) return toast.error(e('msg_no_days'));
    setSaving(true);
    try {
      const r = await adminSchool.updateSettings({ diary_reminder_enabled: enabled, diary_reminder_time: time, diary_reminder_days: days });
      if (!r.success) return toast.error(r.error || e('msg_save_error'));
      toast.success(e('msg_save_success'));
      res.mutate();
    } catch {
      toast.error(e('msg_save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    const email = testEmail.trim();
    if (!email) return toast.error(e('msg_test_no_email'));
    setSending(true);
    try {
      const r = await adminSchool.testDiaryReminder(email);
      if (!r.success) return toast.error(r.error || e('msg_test_error'));
      toast.success(e('msg_test_success', { email }));
    } catch {
      toast.error(e('msg_test_error'));
    } finally {
      setSending(false);
    }
  }

  if (res.isLoading) return <LoadingList />;
  if (res.error) return <ErrorState message={e('msg_load_error')} onRetry={() => res.mutate()} />;

  const dim = enabled ? '' : 'opacity-50';
  const title = (icon: typeof Bell, text: string, desc: string) => (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <IconTile icon={icon} size={32} />
        <Text className="font-semibold">{text}</Text>
      </View>
      <Text className="text-muted-foreground text-sm">{desc}</Text>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: e('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{e('subtitle')}</Text>
        <View className="flex-row gap-3 rounded-xl border border-info-soft bg-info-soft p-3">
          <Icon as={Info} className="mt-0.5 size-5 text-brand dark:text-brand-secondary " />
          <View className="flex-1">
            <Text className="text-sm font-medium text-brand dark:text-brand-secondary ">{e('info_title')}</Text>
            <Text className="mt-1 text-sm text-brand dark:text-brand-secondary ">{e('info_desc')}</Text>
          </View>
        </View>

        <Card>
          <CardContent className="gap-4 pt-4">
            {title(Mail, e('card_diary_title'), e('card_diary_subtitle'))}
            <View className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold">{e('label_enable')}</Text>
                <Text className="text-muted-foreground text-sm">{e('desc_enable')}</Text>
              </View>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </View>
            <View className={`gap-2 ${dim}`} pointerEvents={enabled ? 'auto' : 'none'}>
              <View className="flex-row items-center gap-2">
                <Icon as={Clock} className="text-foreground size-4" />
                <Label>{e('label_time')}</Label>
              </View>
              <TimeField value={time} onChange={setTime} step={5} />
              <Text className="text-muted-foreground text-xs">{e('hint_time')}</Text>
            </View>
          </CardContent>
        </Card>

        <Card className={dim} pointerEvents={enabled ? 'auto' : 'none'}>
          <CardContent className="gap-4 pt-4">
            {title(CalendarDays, e('card_days_title'), e('card_days_subtitle'))}
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant="outline" onPress={() => setDays([0, 1, 2, 3, 4])}>
                <Text className="text-xs">{e('btn_weekdays')}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
                <Text className="text-xs">{e('btn_all_days')}</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => setDays([])}>
                <Text className="text-xs">{e('btn_clear')}</Text>
              </Button>
            </View>
            <View className="gap-1">
              {DAYS.map((d, i) => (
                <CheckRow key={d} checked={days.includes(i)} onPress={() => toggleDay(i)} label={e(`days.${d}`)} />
              ))}
            </View>
            <Text className="text-muted-foreground text-xs">{e('hint_days')}</Text>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            {title(Send, e('card_test_title'), e('card_test_subtitle'))}
            <Label>{e('label_test_email')}</Label>
            <Input value={testEmail} onChangeText={setTestEmail} keyboardType="email-address" autoCapitalize="none" placeholder={e('placeholder_test_email')} />
            <Button variant="outline" className="self-start" onPress={sendTest} disabled={sending || !testEmail.trim()}>
              <Icon as={Send} className="text-foreground size-4" />
              <Text>{sending ? e('btn_sending') : e('btn_send_test')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? e('btn_saving') : e('btn_save')}</Text>
        </Button>
      </View>
    </View>
  );
}
