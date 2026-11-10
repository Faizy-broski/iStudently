import { router, Stack } from 'expo-router';
import { Bell, Camera, Clock, KeyRound, Mail, Phone, QrCode, Save, Settings, ShieldCheck, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import QRCode from 'react-qr-code';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection, RowPill } from '@/components/app/layout';
import { ActionRow, InfoRow, Panel, PanelTitle } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { pickImage } from '@/lib/upload';

/**
 * Teacher account settings (web: /teacher/settings): photo, names, phone; notification preferences;
 * password and 2FA; account details and the personal QR code. The web's notification switches are
 * saved nowhere (simulated), so the app links to the real push setting (/settings) instead, and opens
 * the real password change where the web says "coming soon".
 */
export default function TeacherSettings() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.settings.${key}`, o);
  const toast = useToast();
  const { me, refreshMe } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const profileId = profile?.id ?? null;
  const last = useApi(profileId ? ['portal', 'last-login', profileId] : null, ([, , id]) => auth.lastLogin(id as string));
  const [form, setForm] = useState(() => ({ first: profile?.first_name ?? '', last: profile?.last_name ?? '', phone: profile?.phone ?? '' }));
  const twoFaOn = me.status === 'ready' ? !!me.me.gates.two_fa?.enabled : false;
  const [saving, setSaving] = useState<'profile' | 'photo' | null>(null);

  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

  async function saveProfile() {
    setSaving('profile');
    const r = await auth.updateProfile({ first_name: form.first.trim(), last_name: form.last.trim(), phone: form.phone.trim() });
    setSaving(null);
    if (!r.success) return toast.error(r.error || k('failedToUpdateProfile'));
    toast.success(k('profileUpdatedSuccessfully'));
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
      return toast.error(k('uploadFailed', { message: up.error || '' }));
    }
    const r = await auth.updateProfile({ avatar_url: up.data.url, profile_photo_url: up.data.url });
    setSaving(null);
    if (!r.success) return toast.error(r.error || k('failedToUploadPhoto'));
    toast.success(k('photoUpdatedSuccessfully'));
    refreshMe();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('settings') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted" className="text-sm">
          {k('manageProfileAndPreferences')}
        </Text>

        <FormSection title={k('profileInformation')} description={k('updateYourPersonalDetails')} icon={User}>
          <View className="flex-row items-center gap-4">
            <View className="border-info-soft rounded-full border-2">
              <PersonAvatar url={profile.profile_photo_url} name={name} size={72} />
            </View>
            <View className="flex-1 items-start gap-1.5">
              <RowPill icon={Camera} label={k('changePhoto')} onPress={() => (saving === 'photo' ? undefined : changePhoto())} />
              <Text variant="muted" className="text-xs">
                {k('photoFormatHint')}
              </Text>
            </View>
          </View>
          <Separator />
          <Field label={k('firstName')} value={form.first} onChange={(v) => setForm({ ...form, first: v })} placeholder={k('enterFirstName')} />
          <Field label={k('lastName')} value={form.last} onChange={(v) => setForm({ ...form, last: v })} placeholder={k('enterLastName')} />
          <Field label={k('emailAddress')} icon={Mail} value={profile.email ?? ''} editable={false} />
          <Field label={k('phoneNumber')} icon={Phone} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" placeholder={k('enterPhoneNumber')} />
          <Button className="self-end rounded-full" onPress={saveProfile} disabled={saving === 'profile'}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{k('saveProfile')}</Text>
          </Button>
        </FormSection>

        <FormSection title={k('notificationPreferences')} description={k('chooseWhatNotifications')} icon={Bell}>
          <Button variant="outline" className="self-start rounded-full" onPress={() => router.push('/settings')}>
            <Icon as={Settings} className="size-4" />
            <Text>{t('app.pa_set_app_settings')}</Text>
          </Button>
        </FormSection>

        <Panel>
          <PanelTitle title={k('changePassword')} />
          <Text variant="muted" className="px-4 pb-2 text-xs">
            {k('updateYourAccountPassword')}
          </Text>
          <ActionRow icon={KeyRound} title={k('changePassword')} onPress={() => router.push('/change-password')} />
          <ActionRow
            icon={ShieldCheck}
            title={t('app.pa_set_two_fa')}
            subtitle={t('app.pa_set_two_fa_desc')}
            onPress={() => router.push({ pathname: '/two-fa', params: { mode: 'setup' } })}
            trailing={twoFaOn ? undefined : <RowPill label={t('app.pa_set_enable_2fa')} onPress={() => router.push({ pathname: '/two-fa', params: { mode: 'setup' } })} />}
          />
          <ActionRow icon={Settings} title={t('app.pa_set_app_settings')} onPress={() => router.push('/settings')} last />
        </Panel>

        <Panel>
          <PanelTitle title={k('accountInformation')} />
          <InfoRow icon={User} label={k('role')} value={t(`app.role_${profile.role}`, { defaultValue: profile.role })} />
          <InfoRow icon={Clock} label={k('lastLogin')} value={last.data?.last_sign_in ? formatDateTime(last.data.last_sign_in) : '—'} last />
        </Panel>

        <FormSection title={k('myQrCode')} description={k('scanToVerifyIdentity')} icon={QrCode}>
          <View className="items-center gap-3">
            <View className="rounded-2xl bg-white p-4" accessibilityRole="image" accessibilityLabel={k('myQrCode')}>
              <QRCode value={`${env.webUrl}/verify/${profile.id}`} size={180} bgColor={colors.white} fgColor={colors.black} />
            </View>
            <Text className="text-sm font-semibold">{`${name} · ${t(`app.role_${profile.role}`, { defaultValue: profile.role })}`}</Text>
          </View>
        </FormSection>
      </ScrollView>
    </>
  );
}

function Field({ label, icon, value, onChange, editable = true, placeholder, keyboardType }: { label: string; icon?: typeof Mail; value: string; onChange?: (v: string) => void; editable?: boolean; placeholder?: string; keyboardType?: 'phone-pad' }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        {icon ? <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" /> : null}
        <Label>{label}</Label>
      </View>
      <Input value={value} onChangeText={onChange} editable={editable} placeholder={placeholder} keyboardType={keyboardType} className={editable ? undefined : 'opacity-60'} />
    </View>
  );
}
