import { zodResolver } from '@hookform/resolvers/zod';
import type { LogoShape } from '@studently/api-client';
import { v } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Building2, Frame, ImagePlus, Image as ImageIcon, Phone, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { colors } from '@/lib/colors';
import { FilterChips } from '@/components/app/filter-chips';
import { NumberField, SwitchField, TextField } from '@/components/app/form';
import { FormSection } from '@/components/app/layout';
import { SchoolLogo } from '@/components/app/school-logo';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { media, platform } from '@/lib/api';
import { confirmIdentity } from '@/lib/biometric';
import { useApi } from '@/lib/data';
import { pickImage } from '@/lib/upload';

const schema = z
  .object({
    name: v.required(200),
    short_name: v.optional(60),
    contact_email: v.email(),
    phone: v.optional(40),
    website: v.url(),
    address: v.optional(300),
    city: v.optional(100),
    state: v.optional(100),
    zip_code: v.optional(20),
    principal_name: v.optional(120),
    school_number: v.optional(60),
    is_trial: z.boolean(),
    trial_ends_at: z.string().trim().optional(),
    // Logo display (web EditSchoolModal "Logo Display").
    logo_border_width: z.number({ error: 'app.v_number' }).int().min(0, 'app.v_min_zero').max(12, 'app.v_too_long'),
    logo_border_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'app.v_hex'),
    // Admin account (main schools only; campuses are run by the parent school's admin).
    admin_name: v.optional(120),
    admin_username: v.optional(60),
    admin_email: z.string().trim().email('app.v_email').or(z.literal('')),
    admin_password: z.string().max(128, 'app.v_too_long'),
    admin_confirm: z.string(),
  })
  .refine((f) => !f.is_trial || /^\d{4}-\d{2}-\d{2}$/.test(f.trial_ends_at ?? ''), { path: ['trial_ends_at'], message: 'app.v_date' })
  .refine((f) => !f.admin_password || f.admin_password.length >= 8, { path: ['admin_password'], message: 'app.v_min8' })
  .refine((f) => f.admin_password === f.admin_confirm, { path: ['admin_confirm'], message: 'app.v_password_match' });

const SHAPES: LogoShape[] = ['circle', 'rounded', 'square', 'rectangle'];
type FormValues = z.infer<typeof schema>;

export default function EditSchool() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  const school = schools.data?.find((s) => s.id === id);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shape, setShape] = useState<LogoShape>('circle');
  const [saving, setSaving] = useState(false);
  const isCampus = !!school?.parent_school_id;
  const appearance = useApi(id ? ['platform', 'logo-appearance', id] : null, ([, , sid]) => platform.getLogoAppearance(sid as string));
  const admin = useApi(id && school && !isCampus ? ['platform', 'school-admin', id] : null, ([, , sid]) => platform.getSchoolAdmin(sid as string));
  const adminSettled = isCampus || !!admin.data || !!admin.error;
  const look = appearance.data ?? null;
  const adminInfo = admin.data ?? null;

  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const isTrial = useWatch({ control, name: 'is_trial' });
  const borderWidth = useWatch({ control, name: 'logo_border_width' });
  const borderColor = useWatch({ control, name: 'logo_border_color' });
  useEffect(() => {
    if (!school || !adminSettled || (!look && !appearance.error)) return;
    setLogoUrl(school.logo_url);
    reset({
      name: school.name,
      short_name: school.short_name ?? '',
      contact_email: school.contact_email,
      phone: school.phone ?? '',
      website: school.website ?? '',
      address: school.address ?? '',
      city: school.city ?? '',
      state: school.state ?? '',
      zip_code: school.zip_code ?? '',
      principal_name: school.principal_name ?? '',
      school_number: school.school_number ?? '',
      is_trial: !!school.is_trial,
      trial_ends_at: school.trial_ends_at?.slice(0, 10) ?? '',
      logo_border_width: look?.logo_border_width ?? school.logo_border_width ?? 0,
      logo_border_color: look?.logo_border_color ?? school.logo_border_color ?? colors.black,
      admin_name: adminInfo?.admin_name ?? '',
      admin_username: adminInfo?.admin_username ?? '',
      admin_email: adminInfo?.admin_email ?? '',
      admin_password: '',
      admin_confirm: '',
    });
    setShape(look?.logo_shape ?? school.logo_shape ?? 'circle');
  }, [school, look, adminInfo, adminSettled, appearance.error, reset]);

  async function chooseLogo() {
    const picked = await pickImage({ maxDimension: 512 });
    if (!picked.ok) {
      if (picked.reason === 'permission') toast.error(t('app.ob_photo_permission'));
      return;
    }
    setUploading(true);
    const res = await media.uploadImage(picked.file);
    setUploading(false);
    if (res.success && res.data) setLogoUrl(res.data.url);
    else toast.error(res.error || t('app.error_title'));
  }

  if (!school || !adminSettled) return <LoadingList rows={6} />;

  // Same order as the web: school details, then logo display, then the admin account (partial failures reported).
  const onSubmit = handleSubmit(async (f) => {
    if (!isCampus && !f.admin_email) return toast.error(t('app.es_admin_email_required'));
    // A new admin password needs the same Face ID / passcode check as viewing credentials.
    if (!isCampus && f.admin_password && !(await confirmIdentity(t('app.sa_auth_reason')))) return toast.error(t('app.sa_auth_failed'));
    setSaving(true);
    try {
      const { logo_border_width, logo_border_color, admin_name, admin_username, admin_email, admin_password, admin_confirm: _confirm, ...details } = f;
      const res = await platform.updateSchool(id, {
        ...Object.fromEntries(Object.entries(details).map(([k, val]) => [k, val === '' ? null : val])),
        trial_ends_at: f.is_trial ? f.trial_ends_at || null : null,
        logo_url: logoUrl,
      });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      const logo = await platform.updateLogoAppearance(id, { logo_shape: shape, logo_border_width, logo_border_color });
      if (!logo.success) return toast.error([t('app.es_logo_failed'), logo.error].filter(Boolean).join(': '));
      if (!isCampus) {
        const adm = await platform.updateSchoolAdmin(id, {
          admin_email,
          ...(admin_name ? { admin_name } : {}),
          ...(admin_username ? { username: admin_username } : {}),
          ...(admin_password ? { password: admin_password } : {}),
        });
        if (!adm.success) return toast.error([t('app.es_admin_failed'), adm.error].filter(Boolean).join(': '));
      }
      toast.success(t('app.saved'));
      mutate((key) => Array.isArray(key) && key[0] === 'platform');
      router.back();
    } finally {
      setSaving(false);
    }
  });

  return (
    <>
      <Stack.Screen options={{ title: t('app.es_title') }} />
      <Screen scroll edges={['bottom']}>
        <FormSection title={t('app.ob_logo')} icon={ImageIcon}>
          <View className="flex-row items-center gap-3">
            <SchoolLogo url={logoUrl} shape={shape} size={56} borderWidth={borderWidth} borderColor={borderColor} />
            <Button variant="outline" size="sm" onPress={chooseLogo} disabled={uploading}>
              <Icon as={ImagePlus} className="size-4" />
              <Text>{uploading ? t('app.ob_uploading') : t('app.ob_change_logo')}</Text>
            </Button>
          </View>
        </FormSection>
        <FormSection title={t('app.sa_details')} icon={Building2}>
          <TextField control={control} name="name" label={t('app.ob_name')} />
          <TextField control={control} name="short_name" label={t('app.es_short_name')} />
          <TextField control={control} name="principal_name" label={t('app.sa_principal')} />
          <TextField control={control} name="school_number" label={t('app.es_school_number')} />
          <SwitchField control={control} name="is_trial" label={t('app.ob_trial')} />
          {isTrial ? (
            <TextField control={control} name="trial_ends_at" label={t('app.ob_trial_ends')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
          ) : null}
        </FormSection>
        <FormSection title={t('app.sa_contact')} icon={Phone}>
          <TextField control={control} name="contact_email" label={t('app.ob_contact_email')} keyboardType="email-address" autoCapitalize="none" />
          <TextField control={control} name="phone" label={t('app.sa_phone')} keyboardType="phone-pad" />
          <TextField control={control} name="website" label={t('app.sa_website')} keyboardType="url" autoCapitalize="none" placeholder="https://" />
          <TextField control={control} name="address" label={t('app.sa_address')} />
          <TextField control={control} name="city" label={t('app.es_city')} />
          <TextField control={control} name="state" label={t('app.es_state')} />
          <TextField control={control} name="zip_code" label={t('app.es_zip')} />
        </FormSection>

        <FormSection title={t('app.es_logo_display')} icon={Frame}>
          <Label>{t('app.st_logo_shape')}</Label>
          <FilterChips<LogoShape> value={shape} onChange={setShape} options={SHAPES.map((sh) => ({ value: sh, label: t(`app.st_shape_${sh}`) }))} />
          <NumberField control={control} name="logo_border_width" label={t('app.st_border_width')} keyboardType="number-pad" />
          <TextField control={control} name="logo_border_color" label={t('app.st_border_color')} hint={t('app.st_border_color_hint')} autoCapitalize="none" />
        </FormSection>

        {isCampus ? (
          <View className="bg-info-soft rounded-2xl p-3.5">
            <Text className="text-brand dark:text-brand-secondary text-sm">{t('app.es_admin_campus_note')}</Text>
          </View>
        ) : (
          <FormSection title={t('app.es_admin_section')} icon={UserRound}>
            <TextField control={control} name="admin_name" label={t('app.es_admin_name')} />
            <TextField control={control} name="admin_username" label={t('app.es_admin_username')} autoCapitalize="none" />
            <TextField control={control} name="admin_email" label={t('app.es_admin_email')} keyboardType="email-address" autoCapitalize="none" />
            <TextField
              control={control}
              name="admin_password"
              label={t('app.es_admin_password')}
              hint={t('app.es_admin_password_hint')}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TextField control={control} name="admin_confirm" label={t('app.st_confirm_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          </FormSection>
        )}

        <Button onPress={onSubmit} disabled={saving || uploading}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
