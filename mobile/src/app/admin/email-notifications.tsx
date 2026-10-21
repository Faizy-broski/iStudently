import type { NotificationSettings, NotificationType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { adminMail } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Values = Record<string, string | number | boolean | undefined>;
/** Web string prefixes: absence_alert_title, birthday_alert_title, payment_alert_title. */
const ALERT: Record<NotificationType, string> = { absences: 'absence', birthday: 'birthday', payments: 'payment' };
const SAVE_LABEL: Record<NotificationType, string> = { absences: 'save_absence_settings', birthday: 'save_birthday_settings', payments: 'save_payment_settings' };
const PERIODS = ['school_year', 'semester', 'quarter', 'month', 'week', 'day'] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {children}
    </View>
  );
}

/** Automatic emails for the campus: absences, birthdays, payment reminders (web: /admin/email/notifications). */
export default function EmailNotifications() {
  const { t } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`email.${k}`, o);
  const { campusId, campus } = useCampus();
  const settings = useApi(['admin', 'mail-notifications', campusId ?? 'school'], () => adminMail.notifications(campusId));
  const [tab, setTab] = useState<NotificationType>('absences');
  const [values, setValues] = useState<NotificationSettings>({});
  useEffect(() => {
    if (settings.data) setValues(settings.data);
  }, [settings.data]);
  const current: Values = (values[tab] as Values | undefined) ?? { is_active: false };
  const set = (k: string, v: string | number | boolean | undefined) => setValues((prev) => ({ ...prev, [tab]: { ...(prev[tab] ?? { is_active: false }), [k]: v } }));
  const save = useAction(() => adminMail.saveNotifications(campusId, tab, current), { success: e('notifications_saved'), onSuccess: () => settings.mutate() });

  if (settings.isLoading) return <LoadingList rows={5} />;
  const text = (k: string) => (current[k] == null ? '' : String(current[k]));
  const num = (k: string) => (v: string) => set(k, v.replace(/\D/g, '') ? Number(v.replace(/\D/g, '')) : undefined);

  return (
    <>
      <Stack.Screen options={{ title: e('notifications_title') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{e('notifications_desc', { campus: campus?.name ?? e('school_fallback') })}</Text>
        <FilterChips<NotificationType>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'absences', label: e('tab_absences') },
            { value: 'birthday', label: e('tab_birthday') },
            { value: 'payments', label: e('tab_payments') },
          ]}
        />
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold">{e(`${ALERT[tab]}_alert_title`)}</Text>
            <Text className="text-muted-foreground text-sm">{e(`${ALERT[tab]}_alert_desc`)}</Text>
          </View>
          <Switch checked={!!current.is_active} onCheckedChange={(v) => set('is_active', v)} />
        </View>

        {tab === 'absences' ? (
          <>
            <Field label={e('attendance_code_label')}>
              <Input value={text('attendance_code')} onChangeText={(v) => set('attendance_code', v)} placeholder={e('attendance_code_placeholder')} autoCapitalize="characters" />
            </Field>
            <Field label={e('threshold_label')}>
              <Input value={text('threshold_count')} onChangeText={num('threshold_count')} keyboardType="number-pad" placeholder={e('threshold_placeholder')} />
            </Field>
            <Field label={e('period_label')}>
              <Picker value={text('period')} onChange={(v) => set('period', v)} placeholder={e('period_select')} options={PERIODS.map((p) => ({ value: p, label: e(`period_${p}`) }))} />
            </Field>
          </>
        ) : null}
        {tab === 'payments' ? (
          <>
            <Field label={e('days_before_due')}>
              <Input value={text('days_before_due')} onChangeText={num('days_before_due')} keyboardType="number-pad" placeholder={e('days_before_due_placeholder')} />
            </Field>
            <Field label={e('days_after_due')}>
              <Input value={text('days_after_due')} onChangeText={num('days_after_due')} keyboardType="number-pad" placeholder={e('days_after_due_placeholder')} />
            </Field>
          </>
        ) : null}

        <Field label={e('email_subject_label')}>
          <Input value={text('subject')} onChangeText={(v) => set('subject', v)} placeholder={e('email_subject_placeholder')} maxLength={200} />
        </Field>
        <Field label={e('email_body_label')}>
          <Textarea value={text('body')} onChangeText={(v) => set('body', v)} placeholder={e('email_body_placeholder_short')} className="min-h-40" />
        </Field>
        <Field label={e('email_reply_to')}>
          <Input value={text('reply_to')} onChangeText={(v) => set('reply_to', v)} placeholder={e('email_reply_to_placeholder')} keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label={e('email_copy_to')}>
          <Input value={text('copy_to')} onChangeText={(v) => set('copy_to', v)} placeholder={e('email_copy_to_placeholder')} keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label={e('email_test_email')}>
          <Input value={text('test_email')} onChangeText={(v) => set('test_email', v)} placeholder={e('email_test_placeholder')} keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Button onPress={() => save.run()} disabled={save.running}>
          <Text>{save.running ? e('saving') : e(SAVE_LABEL[tab])}</Text>
        </Button>
      </Screen>
    </>
  );
}
