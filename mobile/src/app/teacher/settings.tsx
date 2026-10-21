import Storage from 'expo-sqlite/kv-store';
import { router, Stack } from 'expo-router';
import { Bell, Camera, Clock, Fingerprint, Hash, KeyRound, Mail, Phone, QrCode, Save, Settings, ShieldCheck, User } from 'lucide-react-native';
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
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { pickImage } from '@/lib/upload';

const NOTIFY = [
  ['email_notifications', 'emailNotifications', 'receiveEmailUpdates'],
  ['assignment_reminders', 'assignmentReminders', 'getRemindedAboutAssignmentDeadlines'],
  ['exam_reminders', 'examReminders', 'getNotifiedAboutUpcomingExams'],
  ['attendance_alerts', 'attendanceAlerts', 'receiveAlertsAboutAttendanceIssues'],
] as const;
type Notify = Record<(typeof NOTIFY)[number][0], boolean>;
const DEFAULTS: Notify = { email_notifications: true, assignment_reminders: true, exam_reminders: true, attendance_alerts: false };

/**
 * Teacher account settings (web: /teacher/settings): photo, names, phone; notification preferences;
 * password and 2FA; account details and the personal QR code. The web saves notification preferences
 * nowhere (simulated) and its password button is "coming soon"; the app keeps preferences on the device
 * and opens the real password change.
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
  const notifyKey = `teacher.notify.${profileId ?? ''}`;
  const [notify, setNotify] = useState<Notify>(() => {
    try {
      const raw = Storage.getItemSync(notifyKey);
      return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Notify>) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
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

  function saveNotify() {
    try {
      Storage.setItemSync(notifyKey, JSON.stringify(notify));
      toast.success(k('notificationSettingsUpdated'));
    } catch {
      toast.error(k('failedToUpdateSettings'));
    }
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
              <Text variant="muted" className="text-[11px]">
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
          {NOTIFY.map(([key, title, desc]) => (
            <View key={key} className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold">{k(title)}</Text>
                <Text variant="muted" className="text-[11px]">
                  {k(desc)}
                </Text>
              </View>
              <Switch checked={notify[key]} onCheckedChange={(v) => setNotify({ ...notify, [key]: v })} />
            </View>
          ))}
          <Button className="self-end rounded-full" onPress={saveNotify}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{k('savePreferences')}</Text>
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
            trailing={<RowPill label={t('app.pa_set_enable_2fa')} onPress={() => router.push({ pathname: '/two-fa', params: { mode: 'setup' } })} />}
          />
          <ActionRow icon={Settings} title={t('app.pa_set_app_settings')} onPress={() => router.push('/settings')} last />
        </Panel>

        <Panel>
          <PanelTitle title={k('accountInformation')} />
          <InfoRow icon={Fingerprint} label={k('userId')} value={`${profile.id.slice(0, 8)}...`} />
          <InfoRow icon={User} label={k('role')} value={t(`app.role_${profile.role}`, { defaultValue: profile.role })} />
          <InfoRow icon={Hash} label={k('campusId')} value={profile.school_id ? `${profile.school_id.slice(0, 8)}...` : '—'} />
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
