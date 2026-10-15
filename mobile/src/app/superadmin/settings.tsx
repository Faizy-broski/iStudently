import { zodResolver } from '@hookform/resolvers/zod';
import type { ApiResponse, LogoShape } from '@studently/api-client';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, formatDatePattern, passwordPair, v } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { FilterChips } from '@/components/app/filter-chips';
import { NumberField, TextField } from '@/components/app/form';
import { Picker, SelectField } from '@/components/app/picker';
import { SchoolLogo } from '@/components/app/school-logo';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { loadDateFormat, saveDateFormat } from '@/features/superadmin/date-format';
import { auth, media, messaging, platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';
import { useAction } from '@/lib/use-action';

const CURRENCIES = ['USD', 'LYD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TND', 'DZD', 'MAD', 'QAR', 'KWD', 'JOD', 'TRY', 'PKR', 'INR'];
const SHAPES: LogoShape[] = ['circle', 'rounded', 'square', 'rectangle'];

const generalSchema = z.object({
  support_email: v.email(),
  max_schools: z.number({ error: 'app.v_number' }).int().min(1, 'app.v_min_zero'),
  currency: z.string().min(3, 'app.v_required'),
  delete_window_minutes: z.number({ error: 'app.v_number' }).int().min(0, 'app.v_min_zero'),
});
type General = z.infer<typeof generalSchema>;

const brandingSchema = z.object({
  logo_border_width: z.number({ error: 'app.v_number' }).int().min(0, 'app.v_min_zero').max(12, 'app.v_too_long'),
  logo_border_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'app.v_hex'),
});
type Branding = z.infer<typeof brandingSchema>;

const passwordSchema = passwordPair();
type Password = z.infer<typeof passwordSchema>;

function GeneralCard() {
  const { t } = useTranslation();
  const settings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const msg = useApi(['platform', 'messaging-settings'], () => messaging.getMessagingSettings());
  const { control, handleSubmit, reset } = useForm<General>({
    resolver: zodResolver(generalSchema),
    defaultValues: { support_email: '', max_schools: 1000, currency: 'USD', delete_window_minutes: 0 },
  });
  useEffect(() => {
    if (settings.data && msg.data)
      reset({
        support_email: settings.data.support_email ?? '',
        max_schools: Number(settings.data.max_schools ?? 1000),
        currency: settings.data.currency ?? 'USD',
        delete_window_minutes: msg.data.delete_window_minutes ?? 0,
      });
  }, [settings.data, msg.data, reset]);

  const save = useAction(
    async (f: General): Promise<ApiResponse<unknown>> => {
      const a = await platform.updatePlatformSettings({ support_email: f.support_email, max_schools: f.max_schools, currency: f.currency });
      if (!a.success) return a;
      return messaging.updateMessagingSettings({ delete_window_minutes: f.delete_window_minutes });
    },
    { success: t('app.saved'), onSuccess: () => (settings.mutate(), msg.mutate()) },
  );

  if (settings.isLoading || msg.isLoading) return <LoadingList rows={2} />;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{t('app.st_general')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <TextField control={control} name="support_email" label={t('app.st_support_email')} keyboardType="email-address" autoCapitalize="none" />
        <NumberField control={control} name="max_schools" label={t('app.st_max_schools')} keyboardType="number-pad" />
        <SelectField control={control} name="currency" label={t('app.st_currency')} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <NumberField
          control={control}
          name="delete_window_minutes"
          label={t('app.st_delete_window')}
          hint={t('app.st_delete_window_hint')}
          keyboardType="number-pad"
        />
        <Button onPress={handleSubmit((f) => save.run(f))} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { me, refreshMe } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const branding = useApi(['platform', 'branding'], () => platform.getBranding());
  const [shape, setShape] = useState<LogoShape>('circle');
  const [uploading, setUploading] = useState(false);
  const { control, handleSubmit, reset } = useForm<Branding>({
    resolver: zodResolver(brandingSchema),
    defaultValues: { logo_border_width: 0, logo_border_color: '#000000' },
  });
  useEffect(() => {
    if (branding.data) {
      setShape(branding.data.logo_shape);
      reset({ logo_border_width: branding.data.logo_border_width, logo_border_color: branding.data.logo_border_color });
    }
  }, [branding.data, reset]);

  const save = useAction((f: Branding) => platform.updateBranding({ ...f, logo_shape: shape }), {
    success: t('app.saved'),
    onSuccess: () => branding.mutate(),
  });

  async function changePhoto() {
    const picked = await pickImage({ maxDimension: 512 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const up = await media.uploadImage(picked.file);
    if (!up.success || !up.data) {
      setUploading(false);
      return toast.error(up.error || t('app.error_title'));
    }
    const res = await platform.updateOwnProfile({ avatar_url: up.data.url, profile_photo_url: up.data.url });
    setUploading(false);
    if (res.success) {
      toast.success(t('app.saved'));
      refreshMe();
    } else toast.error(res.error || t('app.error_title'));
  }

  const photo = profile?.profile_photo_url || profile?.avatar_url;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{t('app.st_account')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <View className="flex-row items-center gap-3">
          <SchoolLogo url={photo} shape={shape} size={64} borderWidth={branding.data?.logo_border_width} borderColor={branding.data?.logo_border_color} />
          <Button variant="outline" size="sm" onPress={changePhoto} disabled={uploading}>
            <Icon as={ImagePlus} className="size-4" />
            <Text>{uploading ? t('app.ob_uploading') : t('app.st_change_photo')}</Text>
          </Button>
        </View>
        <Label>{t('app.st_logo_shape')}</Label>
        <FilterChips<LogoShape> value={shape} onChange={setShape} options={SHAPES.map((s) => ({ value: s, label: t(`app.st_shape_${s}`) }))} />
        <NumberField control={control} name="logo_border_width" label={t('app.st_border_width')} keyboardType="number-pad" />
        <TextField control={control} name="logo_border_color" label={t('app.st_border_color')} hint={t('app.st_border_color_hint')} autoCapitalize="none" />
        <Button onPress={handleSubmit((f) => save.run(f))} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Web "Preferred Date Format": saved on this device, used for dates across the super admin screens. */
function DateFormatCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { me } = useSession();
  const userId = me.status === 'ready' ? me.me.profile.id : null;
  const [pattern, setPattern] = useState<string>(() => loadDateFormat(userId) ?? DEFAULT_DATE_FORMAT);
  const today = new Date();
  function save() {
    if (!userId) return;
    try {
      saveDateFormat(userId, pattern);
      toast.success(t('app.saved'));
    } catch {
      toast.error(t('app.error_title'));
    }
  }
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{t('app.st_date_format')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <Text variant="muted">{t('app.st_date_format_hint')}</Text>
        <Picker value={pattern} onChange={setPattern} options={DATE_FORMAT_OPTIONS.map((p) => ({ value: p, label: formatDatePattern(today, p) }))} />
        <Text className="text-sm">{t('app.st_date_format_preview', { date: formatDatePattern(today, pattern) })}</Text>
        <Button onPress={save}>
          <Text>{t('app.st_date_format_save')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm<Password>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } });
  const change = useAction((f: Password) => auth.changePassword(f.password), { success: t('app.st_password_changed'), onSuccess: () => reset() });
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{t('app.st_password')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <TextField control={control} name="password" label={t('app.st_new_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <TextField control={control} name="confirm" label={t('app.st_confirm_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Button variant="outline" onPress={handleSubmit((f) => change.run(f))} disabled={change.running}>
          <Text>{t('app.st_password')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PlatformSettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.st_title') }} />
      <Screen scroll edges={['bottom']}>
        <GeneralCard />
        <DateFormatCard />
        <AccountCard />
        <PasswordCard />
      </Screen>
    </>
  );
}
