import { Stack } from 'expo-router';
import { CalendarDays, Clock, IdCard, Lock, Mail, Phone, QrCode, Save, Shield, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection, PersonHero } from '@/components/app/layout';
import { InfoRow, Panel, PanelTitle } from '@/components/app/panel';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The student's account: phone, password, account details and identity QR (web: /student/profile). */
export default function StudentProfile() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_pf_${key}`);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const pid = profile?.id ?? null;
  const last = useApi(pid ? ['portal', 'last-login', pid] : null, ([, , id]) => auth.lastLogin(id as string));
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  if (!profile) return null;

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || k('student');
  const female = (profile.gender || '').toLowerCase() === 'female';
  const role = t(`app.role_${profile.role}`, { defaultValue: profile.role });
  const qr = `${env.webUrl}/verify/${profile.id}`;

  async function save() {
    setSaving(true);
    const r = await auth.updateProfile({ phone });
    setSaving(false);
    if (!r.success) return toast.error(r.error || k('save_failed'));
    toast.success(k('saved'));
  }
  async function changePassword() {
    if (pw.next.length < 8) return toast.error(k('pw_short'));
    if (pw.next !== pw.confirm) return toast.error(k('pw_mismatch'));
    setChanging(true);
    const r = await auth.changePassword(pw.next);
    setChanging(false);
    if (!r.success) return toast.error(r.error || k('pw_failed'));
    toast.success(k('pw_done'));
    setPw({ next: '', confirm: '' });
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <PersonHero
          name={name}
          subtitle={profile.email}
          photo={profile.profile_photo_url}
          chips={
            <View className={cn('rounded-full px-3 py-1', female ? 'bg-chart-6/40' : 'bg-white/15')}>
              <Text className="text-xs font-semibold capitalize text-white">{role}</Text>
            </View>
          }
        />

        <Panel className="gap-3 p-4">
          <Header icon={User} tone={female ? 'bg-chart-6/15 text-chart-6' : 'bg-info-soft text-brand dark:text-brand-secondary'} title={k('contact')} desc={k('contact_desc')} />
          <Field icon={Mail} label={k('email')}>
            <Input value={profile.email ?? ''} editable={false} className="bg-muted" />
            <Text className="text-muted-foreground mt-1 text-xs">{k('email_hint')}</Text>
          </Field>
          <Field icon={Phone} label={k('phone')}>
            <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={k('phone_ph')} />
          </Field>
          <Button onPress={save} disabled={saving} className={female ? 'bg-chart-6' : undefined}>
            <Icon as={Save} className="size-4 text-white" />
            <Text className="text-white">{k('save')}</Text>
          </Button>
        </Panel>

        <Panel className="gap-3 p-4">
          <Header icon={Lock} tone="bg-destructive-soft text-destructive" title={k('pw')} desc={k('pw_desc')} />
          <Field label={k('new')}>
            <Input value={pw.next} onChangeText={(next) => setPw((p) => ({ ...p, next }))} secureTextEntry placeholder={k('new_ph')} autoCapitalize="none" />
          </Field>
          <Field label={k('confirm')}>
            <Input value={pw.confirm} onChangeText={(confirm) => setPw((p) => ({ ...p, confirm }))} secureTextEntry placeholder={k('confirm_ph')} autoCapitalize="none" />
          </Field>
          <Button variant="outline" onPress={changePassword} disabled={changing || !pw.next}>
            <Icon as={Shield} className="size-4" />
            <Text>{k('pw')}</Text>
          </Button>
        </Panel>

        <Panel className="pb-1">
          <PanelTitle title={k('account')} />
          <InfoRow icon={IdCard} label={k('student_id')} value={profile.student_id ? `${profile.student_id.slice(0, 8)}...` : '—'} />
          <InfoRow icon={Shield} label={k('role')} value={role} />
          <InfoRow icon={CalendarDays} label={k('since')} value={profile.created_at ? formatDate(profile.created_at) : '—'} />
          <InfoRow icon={Clock} label={k('last_login')} value={last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'} last />
        </Panel>

        <FormSection icon={QrCode} title={k('qr')} description={k('qr_desc')}>
          <View className="items-center gap-3">
            <View className="rounded-2xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('qr')}>
              <QRCode value={qr} size={180} bgColor={colors.white} fgColor={colors.black} />
            </View>
            <Text className="text-sm font-semibold">{`${name} · ${role}`}</Text>
            <Button variant="outline" onPress={() => Share.share({ message: qr })}>
              <Text>{t('app.qr_share')}</Text>
            </Button>
          </View>
        </FormSection>
      </ScrollView>
    </>
  );
}

function Header({ icon, tone, title, desc }: { icon: typeof User; tone: string; title: string; desc: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className={cn('size-8 items-center justify-center rounded-xl', tone)}>
        <Icon as={icon} strokeWidth={2.2} className={cn('size-4', tone)} />
      </View>
      <View className="flex-1">
        <Text className="font-semibold">{title}</Text>
        <Text className="text-muted-foreground text-xs">{desc}</Text>
      </View>
    </View>
  );
}

function Field({ icon, label, children }: { icon?: typeof User; label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        {icon ? <Icon as={icon} className="text-muted-foreground size-4" /> : null}
        <Text className="text-sm font-medium">{label}</Text>
      </View>
      {children}
    </View>
  );
}
