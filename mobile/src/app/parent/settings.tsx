import Storage from 'expo-sqlite/kv-store';
import { router, Stack } from 'expo-router';
import { Bell, Clock, Lock, Mail, MapPin, Phone, Save, Settings, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import QRCode from 'react-qr-code';

import { ScrollView } from '@/components/app/keyboard';
import { PersonAvatar } from '@/components/app/person-avatar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { pickImage } from '@/lib/upload';

const NOTIFY = ['attendance', 'grades', 'assignments', 'fees', 'events', 'announcements'] as const;
type Notify = Record<(typeof NOTIFY)[number], boolean>;
const DEFAULTS: Notify = { attendance: true, grades: true, assignments: true, fees: true, events: true, announcements: false };

/**
 * Parent account settings (web: /parent/settings): profile (photo, names, phone), notification
 * preferences, password and 2FA, and the personal QR code. The web saves notification preferences
 * nowhere (simulated); the app keeps them on the device.
 */
export default function ParentSettings() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_set_${key}`);
  const toast = useToast();
  const { me, refreshMe } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const profileId = profile?.id ?? null;
  const last = useApi(profileId ? ['portal', 'last-login', profileId] : null, ([, , id]) => auth.lastLogin(id as string));
  const [form, setForm] = useState(() => ({ first: profile?.first_name ?? '', last: profile?.last_name ?? '', phone: profile?.phone ?? '', address: '' }));
  const notifyKey = `parent.notify.${profileId ?? ''}`;
  const [notify, setNotify] = useState<Notify>(() => {
    try {
      const raw = Storage.getItemSync(notifyKey);
      return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Notify>) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [saving, setSaving] = useState<'profile' | 'notify' | 'photo' | null>(null);

  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

  async function saveProfile() {
    setSaving('profile');
    const r = await auth.updateProfile({ first_name: form.first.trim(), last_name: form.last.trim(), phone: form.phone.trim() });
    setSaving(null);
    if (!r.success) return toast.error(r.error || k('profile_error'));
    toast.success(k('profile_saved'));
    refreshMe();
  }

  async function changePhoto() {
    const picked = await pickImage({ maxDimension: 800, keepTransparency: false });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setSaving('photo');
    const up = await media.uploadImage(picked.file);
    if (!up.success || !up.data) {
      setSaving(null);
      return toast.error(up.error || k('profile_error'));
    }
    const r = await auth.updateProfile({ avatar_url: up.data.url, profile_photo_url: up.data.url });
    setSaving(null);
    if (!r.success) return toast.error(r.error || k('profile_error'));
    toast.success(k('profile_saved'));
    refreshMe();
  }

  function saveNotify() {
    try {
      Storage.setItemSync(notifyKey, JSON.stringify(notify));
      toast.success(k('notify_saved'));
    } catch {
      toast.error(k('profile_error'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{k('subtitle')}</Text>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={User} className="size-5" />
            <CardTitle>{k('profile')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row items-center gap-4">
              <PersonAvatar url={profile.profile_photo_url} name={name} size={80} />
              <View className="flex-1 gap-1">
                <Button variant="outline" size="sm" className="self-start" onPress={changePhoto} disabled={saving === 'photo'}>
                  <Text>{k('change_photo')}</Text>
                </Button>
                <Text className="text-muted-foreground text-xs">{k('photo_hint')}</Text>
              </View>
            </View>
            <Separator />
            <Field label={k('first_name')} value={form.first} onChange={(v) => setForm({ ...form, first: v })} />
            <Field label={k('last_name')} value={form.last} onChange={(v) => setForm({ ...form, last: v })} />
            <Field label={k('email')} icon={Mail} value={profile.email ?? ''} editable={false} />
            <Field label={k('phone')} icon={Phone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" placeholder={k('phone_placeholder')} />
            <Field label={k('address')} icon={MapPin} value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder={k('address_placeholder')} />
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Icon as={Clock} className="size-4" />
                <Label>{k('last_login')}</Label>
              </View>
              <Text className="text-sm font-medium">{last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'}</Text>
            </View>
            <Button className="self-end bg-[#57A3CC]" onPress={saveProfile} disabled={saving === 'profile'}>
              <Icon as={Save} className="size-4 text-white" />
              <Text className="text-white">{saving === 'profile' ? k('saving') : k('save_profile')}</Text>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={Bell} className="size-5" />
            <CardTitle>{k('notifications')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            {NOTIFY.map((n) => (
              <View key={n} className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="font-medium">{k(`n_${n}`)}</Text>
                  <Text className="text-muted-foreground text-xs">{k(`n_${n}_desc`)}</Text>
                </View>
                <Switch checked={notify[n]} onCheckedChange={(v) => setNotify({ ...notify, [n]: v })} />
              </View>
            ))}
            <Button className="self-end bg-[#57A3CC]" onPress={saveNotify}>
              <Icon as={Save} className="size-4 text-white" />
              <Text className="text-white">{k('save_prefs')}</Text>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={Lock} className="size-5" />
            <CardTitle>{k('security')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-medium">{k('password')}</Text>
                <Text className="text-muted-foreground text-xs">{k('password_desc')}</Text>
              </View>
              <Button variant="outline" size="sm" onPress={() => router.push('/change-password')}>
                <Text>{k('change_password')}</Text>
              </Button>
            </View>
            <Separator />
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-medium">{k('two_fa')}</Text>
                <Text className="text-muted-foreground text-xs">{k('two_fa_desc')}</Text>
              </View>
              <Button variant="outline" size="sm" onPress={() => router.push({ pathname: '/two-fa', params: { mode: 'setup' } })}>
                <Text>{k('enable_2fa')}</Text>
              </Button>
            </View>
            <Separator />
            <Button variant="ghost" size="sm" className="self-start" onPress={() => router.push('/settings')}>
              <Icon as={Settings} className="size-4" />
              <Text>{k('app_settings')}</Text>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{k('qr')}</CardTitle>
          </CardHeader>
          <CardContent className="items-center gap-3">
            <View className="rounded-xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('qr')}>
              <QRCode value={`${env.webUrl}/verify/${profile.id}`} size={180} bgColor="#FFFFFF" fgColor="#000000" />
            </View>
            <Text className="font-medium">{name}</Text>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Field({
  label,
  icon,
  value,
  onChange,
  editable = true,
  placeholder,
  keyboardType,
}: {
  label: string;
  icon?: typeof Mail;
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  keyboardType?: 'phone-pad';
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        {icon ? <Icon as={icon} className="size-4" /> : null}
        <Label>{label}</Label>
      </View>
      <Input value={value} onChangeText={onChange} editable={editable} placeholder={placeholder} keyboardType={keyboardType} className={editable ? undefined : 'opacity-60'} />
    </View>
  );
}
