import type { SmtpSettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Eye, EyeOff, FlaskConical, Info, Mail, Save } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { plainMessage } from '@/i18n/plain';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

const DEFAULT: SmtpSettings = { smtp_host: '', smtp_port: 465, smtp_secure: true, smtp_user: '', smtp_pass: '', smtp_from_email: '', smtp_from_name: '', has_password: false };

/** Outgoing mail server for the school or the selected campus, with a test send (web: /admin/settings/email-smtp). */
export default function EmailSmtpSettings() {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.email_smtp.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'smtp', campusId ?? 'school'], () => adminSchool.smtp(campusId));
  const [form, setForm] = useState<SmtpSettings>(DEFAULT);
  const [port, setPort] = useState('465');
  const [showPass, setShowPass] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (res.isLoading) return;
    const d = res.data ?? DEFAULT;
    setForm(d);
    setPort(String(d.smtp_port ?? 465));
  }, [res.data, res.isLoading]);

  const set = <K extends keyof SmtpSettings>(k: K, v: SmtpSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const current = (): SmtpSettings => ({ ...form, smtp_port: parseInt(port, 10) || 465 });

  async function save() {
    setSaving(true);
    try {
      const r = await adminSchool.saveSmtp(current(), campusId);
      if (!r.success) return toast.error(r.error || m('msg_save_error'));
      toast.success(m('msg_save_success'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!testEmail.trim()) return toast.error(m('msg_test_no_email'));
    setTesting(true);
    try {
      const r = await adminSchool.testSmtp({ ...current(), test_email: testEmail.trim() }, campusId);
      if (!r.success) return toast.error(r.error || m('msg_test_error'));
      toast.success(r.data?.message || r.message || m('msg_test_success'));
    } finally {
      setTesting(false);
    }
  }

  if (res.isLoading) return <LoadingList />;

  const card = (title: string, desc: string, children: ReactNode) => (
    <Card>
      <CardContent className="gap-4 pt-4">
        <View>
          <Text className="font-semibold">{title}</Text>
          <Text className="text-muted-foreground text-sm">{desc}</Text>
        </View>
        {children}
      </CardContent>
    </Card>
  );
  const field = (label: ReactNode, input: ReactNode, hint?: string) => (
    <View className="gap-1.5">
      {label}
      {input}
      {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView className="bg-background flex-1">
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start gap-2">
          <Icon as={Mail} className="text-foreground mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{m('subtitle', { type: campusId ? m('type_campus') : m('type_school') })}</Text>
        </View>

        {card(
          m('card_server_title'),
          m('card_server_subtitle'),
          <>
            {field(<Label>{m('label_host')}</Label>, <Input value={form.smtp_host} onChangeText={(v) => set('smtp_host', v)} placeholder={m('placeholder_host')} autoCapitalize="none" autoCorrect={false} />)}
            {field(<Label>{m('label_port')}</Label>, <Input value={port} onChangeText={setPort} keyboardType="number-pad" placeholder={m('placeholder_port')} />, m('hint_port'))}
            {field(
              <Label>{m('label_encryption')}</Label>,
              <View className="flex-row items-center gap-3">
                <Switch checked={form.smtp_secure} onCheckedChange={(v) => set('smtp_secure', v)} />
                <Text className="text-sm">{form.smtp_secure ? m('encryption_ssl') : m('encryption_tls')}</Text>
              </View>,
            )}
          </>,
        )}

        {card(
          m('card_auth_title'),
          m('card_auth_subtitle'),
          <>
            {field(<Label>{m('label_user')}</Label>, <Input value={form.smtp_user} onChangeText={(v) => set('smtp_user', v)} placeholder={m('placeholder_user')} autoCapitalize="none" autoCorrect={false} />)}
            {field(
              <View className="flex-row flex-wrap items-center gap-2">
                <Label>{m('label_pass')}</Label>
                {form.has_password ? <Text className="text-muted-foreground text-xs">{m('hint_pass_saved')}</Text> : null}
              </View>,
              <View className="justify-center">
                <Input
                  value={form.smtp_pass}
                  onChangeText={(v) => set('smtp_pass', v)}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  placeholder={form.has_password ? m('placeholder_pass_existing') : m('placeholder_pass_new')}
                  className="pe-10"
                />
                <Pressable onPress={() => setShowPass((v) => !v)} accessibilityRole="button" accessibilityLabel={m('label_pass')} className="absolute end-3 p-1">
                  <Icon as={showPass ? EyeOff : Eye} className="text-muted-foreground size-4" />
                </Pressable>
              </View>,
            )}
          </>,
        )}

        {card(
          m('card_from_title'),
          m('card_from_subtitle'),
          <>
            {field(<Label>{m('label_from_name')}</Label>, <Input value={form.smtp_from_name} onChangeText={(v) => set('smtp_from_name', v)} placeholder={m('placeholder_from_name')} />)}
            {field(
              <Label>{m('label_from_email')}</Label>,
              <Input value={form.smtp_from_email} onChangeText={(v) => set('smtp_from_email', v)} keyboardType="email-address" autoCapitalize="none" placeholder={m('placeholder_from_email')} />,
            )}
          </>,
        )}

        <View className="flex-row gap-2 rounded-xl border border-info-soft bg-info-soft p-3">
          <Icon as={Info} className="mt-0.5 size-4 text-brand dark:text-brand-secondary " />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-medium text-brand dark:text-brand-secondary ">{m('studently_server_title')}</Text>
            <Text className="text-sm text-brand dark:text-brand-secondary " selectable>
              {plainMessage('school.email_smtp.studently_server_details', { host: 'mail.istudent.ly', port: '465', user: 'info@istudent.ly' })}
            </Text>
          </View>
        </View>

        <Separator />

        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? m('btn_saving') : m('btn_save')}</Text>
        </Button>

        {card(
          m('card_test_title'),
          m('card_test_subtitle'),
          <>
            <Input value={testEmail} onChangeText={setTestEmail} keyboardType="email-address" autoCapitalize="none" placeholder={m('placeholder_test_email')} />
            <Button variant="outline" className="self-start" onPress={test} disabled={testing}>
              <Icon as={FlaskConical} className="text-foreground size-4" />
              <Text>{testing ? m('btn_testing') : m('btn_send_test')}</Text>
            </Button>
          </>,
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
