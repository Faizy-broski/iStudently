import { Stack } from 'expo-router';
import { Lock, Mail, Phone, Save, Shield, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, View } from 'react-native';
import QRCode from 'react-qr-code';

import { PersonAvatar } from '@/components/app/person-avatar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardContent className="flex-row items-center gap-4 p-4">
            <View className={cn('rounded-xl border-2', female ? 'border-pink-300' : 'border-blue-200')}>
              <PersonAvatar url={profile.profile_photo_url} name={name} size={72} />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-semibold">{name}</Text>
              <Text className="text-muted-foreground capitalize">{role}</Text>
              <Text className="text-muted-foreground mt-1 text-sm">{profile.email}</Text>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 p-4">
            <Header icon={User} tone={female ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'} title={k('contact')} desc={k('contact_desc')} />
            <Field icon={Mail} label={k('email')}>
              <Input value={profile.email ?? ''} editable={false} className="bg-muted" />
              <Text className="text-muted-foreground mt-1 text-xs">{k('email_hint')}</Text>
            </Field>
            <Field icon={Phone} label={k('phone')}>
              <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={k('phone_ph')} />
            </Field>
            <Button onPress={save} disabled={saving} className={female ? 'bg-pink-500' : undefined}>
              <Icon as={Save} className="size-4 text-white" />
              <Text className="text-white">{k('save')}</Text>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 p-4">
            <Header icon={Lock} tone="bg-red-100 text-red-600" title={k('pw')} desc={k('pw_desc')} />
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
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="gap-2 p-4">
            <Text className="mb-2 font-semibold">{k('account')}</Text>
            <Row label={k('student_id')} value={profile.student_id ? `${profile.student_id.slice(0, 8)}...` : '—'} />
            <Row label={k('role')} value={role} />
            <Row label={k('since')} value={profile.created_at ? formatDate(profile.created_at) : '—'} />
            <Row label={k('last_login')} value={last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="items-center gap-3 p-4">
            <Text className="self-start font-semibold">{k('qr')}</Text>
            <Text className="text-muted-foreground self-start text-sm">{k('qr_desc')}</Text>
            <View className="rounded-xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('qr')}>
              <QRCode value={qr} size={180} bgColor="#FFFFFF" fgColor="#000000" />
            </View>
            <Text className="font-medium">{`${name} · ${role}`}</Text>
            <Button variant="outline" onPress={() => Share.share({ message: qr })}>
              <Text>{t('app.qr_share')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Header({ icon, tone, title, desc }: { icon: typeof User; tone: string; title: string; desc: string }) {
  return (
    <View className="mb-2 flex-row items-center gap-3">
      <View className={cn('rounded-lg p-3', tone)}>
        <Icon as={icon} className={cn('size-5', tone)} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold">{title}</Text>
        <Text className="text-muted-foreground text-sm">{desc}</Text>
      </View>
    </View>
  );
}

function Field({ icon, label, children }: { icon?: typeof User; label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        {icon ? <Icon as={icon} className="size-4" /> : null}
        <Text className="text-sm font-medium">{label}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-sm font-medium capitalize">{value}</Text>
    </View>
  );
}
