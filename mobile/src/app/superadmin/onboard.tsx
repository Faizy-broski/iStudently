import { zodResolver } from '@hookform/resolvers/zod';
import type { BillingCycle, OnboardSchoolResult, PaymentStatus } from '@studently/api-client';
import { DEFAULT_ROLE_HREFS } from '@studently/shared-types';
import { dueDateFor, planPrice, todayIso, v, vBilling } from '@studently/shared-utils';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { Building2, Copy, CopyPlus, CreditCard, ImagePlus, KeyRound, RefreshCw, School, UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';
import { z } from 'zod';

import { FormError, NumberField, SwitchField, TextField } from '@/components/app/form';
import { SelectField } from '@/components/app/picker';
import { SchoolLogo } from '@/components/app/school-logo';
import { FormSection, HeroCard, IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { media, platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { generatePassword, slugify } from '@/lib/password';
import { pickImage } from '@/lib/upload';

const CYCLES: BillingCycle[] = ['Monthly', 'Quarterly', 'Yearly'];
const STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid'];

const schema = z
  .object({
    name: v.required(200),
    slug: v.slug(),
    contact_email: v.email(),
    address: v.optional(300),
    website: v.url(),
    is_trial: z.boolean(),
    trial_ends_at: z.string().trim().optional(),
    first_name: v.required(80),
    last_name: v.required(80),
    username: z.string().trim().max(60, 'app.v_too_long').regex(/^[a-z0-9._-]*$/i, 'app.v_slug').optional(),
    admin_email: z.string().trim().email('app.v_email').optional().or(z.literal('')),
    password: z.string().min(8, 'app.v_min8').max(128, 'app.v_too_long'),
    add_billing: z.boolean(),
    billing_plan_id: z.string().optional(),
    billing_cycle: z.enum(CYCLES),
    amount: z.number().min(0, 'app.v_min_zero'),
    currency: vBilling.currency(),
    start_date: vBilling.date(),
    payment_status: z.enum(STATUSES),
  })
  .refine((f) => !f.is_trial || /^\d{4}-\d{2}-\d{2}$/.test(f.trial_ends_at ?? ''), { path: ['trial_ends_at'], message: 'app.v_date' })
  .refine((f) => !f.add_billing || !!f.billing_plan_id, { path: ['billing_plan_id'], message: 'app.v_required' });
type FormValues = z.infer<typeof schema>;

function Credentials({ result, password, onAnother }: { result: OnboardSchoolResult; password: string; onAnother: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('onboard-credentials').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('onboard-credentials').catch(() => {});
    };
  }, []);
  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast.success(t('app.sa_copied'));
  };
  const rows: [string, string][] = [
    [t('app.sa_username'), result.admin.username],
    [t('app.sa_password'), password],
  ];
  return (
    <Screen scroll edges={['bottom']}>
      <HeroCard>
        <Text className="text-lg font-bold text-white">{t('app.ob_done_title', { name: result.school.name })}</Text>
        <Text className="text-xs text-white/80">{t('app.ob_done_body')}</Text>
      </HeroCard>
      <Panel>
        {rows.map(([label, value], i) => (
          <View key={label} className={i < rows.length - 1 ? 'border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3' : 'flex-row items-center gap-3 px-4 py-3'}>
            <IconTile icon={i === 0 ? UserRound : KeyRound} size={36} />
            <View className="flex-1 gap-0.5">
              <Text className="text-muted-foreground text-[11px]">{label}</Text>
              <Text selectable className="text-sm font-semibold">
                {value}
              </Text>
            </View>
            <Pressable onPress={() => copy(value)} hitSlop={8} accessibilityLabel={t('app.sa_copy')} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
              <Icon as={Copy} className="text-brand dark:text-brand-secondary size-4" />
            </Pressable>
          </View>
        ))}
      </Panel>
      {/* Web: after the credentials card, offer to copy settings from another school. */}
      <Button variant="secondary" onPress={() => router.replace({ pathname: '/superadmin/school/copy-settings', params: { id: result.school.id, name: result.school.name } })}>
        <Icon as={CopyPlus} className="size-4" />
        <Text>{t('app.ob_copy_settings')}</Text>
      </Button>
      <Button onPress={() => router.replace({ pathname: '/superadmin/school/[id]', params: { id: result.school.id } })}>
        <Text>{t('app.ob_open_school')}</Text>
      </Button>
      <Button variant="outline" onPress={onAnother}>
        <Text>{t('app.ob_another')}</Text>
      </Button>
    </Screen>
  );
}

export default function OnboardSchool() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const plans = useApi(['platform', 'plans', 'all'], () => platform.listPlans(true));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: OnboardSchoolResult; password: string } | null>(null);

  const defaults: FormValues = useMemo(
    () => ({
      name: '',
      slug: '',
      contact_email: '',
      address: '',
      website: '',
      is_trial: false,
      trial_ends_at: '',
      first_name: '',
      last_name: '',
      username: '',
      admin_email: '',
      password: generatePassword(),
      add_billing: false,
      billing_plan_id: '',
      billing_cycle: 'Monthly',
      amount: 0,
      currency: 'USD',
      start_date: todayIso(),
      payment_status: 'unpaid',
    }),
    [],
  );
  const { control, handleSubmit, setValue, getFieldState, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const [name, isTrial, addBilling, planId, cycle] = useWatch({ control, name: ['name', 'is_trial', 'add_billing', 'billing_plan_id', 'billing_cycle'] });

  // New invoices use the platform currency from Settings (not a fixed USD), unless changed by hand.
  const platformSettings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const platformCurrency = platformSettings.data?.currency ?? null;
  useEffect(() => {
    if (platformCurrency && !getFieldState('currency').isDirty) setValue('currency', platformCurrency);
  }, [platformCurrency, setValue, getFieldState]);

  // Suggest the web address from the name (until edited by hand).
  useEffect(() => {
    if (!getFieldState('slug').isDirty) setValue('slug', slugify(name ?? ''));
  }, [name, setValue, getFieldState]);
  // Price from plan + cycle (until edited by hand).
  useEffect(() => {
    const plan = plans.data?.find((p) => p.id === planId);
    if (plan && !getFieldState('amount').isDirty) setValue('amount', planPrice(plan, cycle));
  }, [planId, cycle, plans.data, setValue, getFieldState]);

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

  const onSubmit = handleSubmit(async (f) => {
    setServerError(null);
    setSubmitting(true);
    const res = await platform.onboardSchool({
      school: {
        name: f.name,
        slug: f.slug,
        contact_email: f.contact_email,
        address: f.address || null,
        website: f.website || null,
        logo_url: logoUrl,
        is_trial: f.is_trial,
        trial_ends_at: f.is_trial ? f.trial_ends_at || null : null,
      },
      admin: {
        first_name: f.first_name,
        last_name: f.last_name,
        password: f.password,
        username: f.username || undefined,
        email: f.admin_email || undefined,
      },
      billing:
        f.add_billing && f.billing_plan_id
          ? {
              billing_plan_id: f.billing_plan_id,
              billing_cycle: f.billing_cycle,
              amount: f.amount,
              currency: f.currency,
              start_date: f.start_date,
              due_date: dueDateFor(f.start_date, f.billing_cycle),
              payment_status: f.payment_status,
            }
          : undefined,
    });
    setSubmitting(false);
    if (!res.success || !res.data) {
      setServerError(res.error || t('app.error_title'));
      return;
    }
    // Default staff roles for the new school (non-fatal; admins can refresh them later).
    platform.seedDefaultRoles(res.data.school.id, { teacher: DEFAULT_ROLE_HREFS.teacher, staff: DEFAULT_ROLE_HREFS.staff, librarian: DEFAULT_ROLE_HREFS.librarian }).catch(() => {});
    mutate((key) => Array.isArray(key) && key[0] === 'platform');
    setDone({ result: res.data, password: f.password });
  });

  if (done) {
    return (
      <>
        <Stack.Screen options={{ title: t('app.ob_title') }} />
        <Credentials
          result={done.result}
          password={done.password}
          onAnother={() => {
            setDone(null);
            setLogoUrl(null);
            reset({ ...defaults, currency: platformCurrency ?? defaults.currency, password: generatePassword() });
          }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ob_title') }} />
      <Screen scroll edges={['bottom']}>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="size-11 items-center justify-center rounded-2xl bg-white/15">
              <Icon as={School} strokeWidth={2.2} className="size-5 text-white" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-white">{t('app.ob_intro_title')}</Text>
              <Text className="text-xs text-white/80">{t('app.ob_intro_body')}</Text>
            </View>
          </View>
        </HeroCard>
        <FormSection title={t('app.ob_school')} icon={Building2}>
          <TextField control={control} name="name" label={t('app.ob_name')} />
          <TextField control={control} name="slug" label={t('app.ob_slug')} hint={t('app.ob_slug_hint')} autoCapitalize="none" autoCorrect={false} />
          <TextField control={control} name="contact_email" label={t('app.ob_contact_email')} keyboardType="email-address" autoCapitalize="none" />
          <TextField control={control} name="address" label={t('app.sa_address')} />
          <TextField control={control} name="website" label={t('app.sa_website')} keyboardType="url" autoCapitalize="none" placeholder="https://" />
          <View className="gap-1.5">
            <Label>{t('app.ob_logo')}</Label>
            <View className="flex-row items-center gap-3">
              <SchoolLogo url={logoUrl} size={56} />
              <Button variant="outline" size="sm" onPress={chooseLogo} disabled={uploading}>
                <Icon as={ImagePlus} className="size-4" />
                <Text>{uploading ? t('app.ob_uploading') : logoUrl ? t('app.ob_change_logo') : t('app.ob_pick_logo')}</Text>
              </Button>
            </View>
          </View>
          <SwitchField control={control} name="is_trial" label={t('app.ob_trial')} />
          {isTrial ? (
            <TextField control={control} name="trial_ends_at" label={t('app.ob_trial_ends')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
          ) : null}
        </FormSection>

        <FormSection title={t('app.ob_admin')} icon={UserRound}>
          <TextField control={control} name="first_name" label={t('app.ob_first_name')} />
          <TextField control={control} name="last_name" label={t('app.ob_last_name')} />
          <TextField control={control} name="username" label={t('app.ob_username')} hint={t('app.ob_username_hint')} autoCapitalize="none" autoCorrect={false} />
          <TextField control={control} name="admin_email" label={t('app.ob_admin_email')} keyboardType="email-address" autoCapitalize="none" />
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <TextField control={control} name="password" label={t('app.ob_password')} hint={t('app.ob_password_hint')} autoCapitalize="none" autoCorrect={false} />
            </View>
            <Button variant="outline" size="icon" onPress={() => setValue('password', generatePassword(), { shouldValidate: true })} accessibilityLabel={t('app.ob_generate')} className="mb-6">
              <Icon as={RefreshCw} className="size-4" />
            </Button>
          </View>
        </FormSection>

        <FormSection title={t('app.ob_billing')} icon={CreditCard}>
          <SwitchField control={control} name="add_billing" label={t('app.ob_add_billing')} />
          {addBilling ? (
            <>
              <SelectField
                control={control}
                name="billing_plan_id"
                label={t('app.bl_plan')}
                placeholder={t('app.bl_pick_plan')}
                options={(plans.data ?? []).filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name }))}
              />
              <SelectField control={control} name="billing_cycle" label={t('app.bl_cycle')} options={CYCLES.map((c) => ({ value: c, label: t(`app.bl_cycle_${c}`) }))} />
              <NumberField control={control} name="amount" label={t('app.bl_amount')} />
              <TextField control={control} name="currency" label={t('app.bl_currency')} autoCapitalize="characters" maxLength={3} />
              <TextField control={control} name="start_date" label={t('app.bl_start_date')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
              <SelectField control={control} name="payment_status" label={t('app.bl_status')} options={STATUSES.map((s) => ({ value: s, label: t(`app.sa_pay_status_${s}`) }))} />
            </>
          ) : null}
        </FormSection>

        <FormError message={serverError} />
        <Button onPress={onSubmit} disabled={submitting || uploading}>
          <Text>{t('app.ob_submit')}</Text>
        </Button>
      </Screen>
    </>
  );
}
