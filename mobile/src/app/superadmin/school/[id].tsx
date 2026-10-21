import type { PlatformSchool, SchoolAdminCredentials } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { CalendarDays, Copy, Eye, EyeOff, Globe, KeyRound, LayoutGrid, Link2, ListPlus, Mail, MapPin, Pencil, PanelLeft, Phone, ShieldCheck, ShieldOff, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { BrandGradient } from '@/components/app/brand-gradient';
import { useConfirm } from '@/components/app/confirm';
import { ActionRow, InfoRow, Panel, PanelTitle } from '@/components/app/panel';
import { SchoolLogo } from '@/components/app/school-logo';
import { ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PAY_TONE } from '@/features/superadmin/billing';
import { onTrial } from '@/features/superadmin/school-status';
import { platform } from '@/lib/api';
import { confirmIdentity } from '@/lib/biometric';
import { useApi } from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/format';
import { useAction } from '@/lib/use-action';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="gap-0.5 py-1.5">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text selectable>{value}</Text>
    </View>
  );
}

/** Login details: revealed only after Face ID / fingerprint / passcode; screenshots blocked while shown. */
function AdminCredentials({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [creds, setCreds] = useState<SchoolAdminCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const regenerate = useAction(platform.regenerateSchoolAdminCredentials, { success: t('app.sa_regenerated_ok') });

  // Block screenshots / screen recording and blank the app-switcher preview while visible.
  useEffect(() => {
    if (!creds) return;
    ScreenCapture.preventScreenCaptureAsync('credentials').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('credentials').catch(() => {});
    };
  }, [creds]);

  async function reveal() {
    if (!(await confirmIdentity(t('app.sa_auth_reason')))) return toast.error(t('app.sa_auth_failed'));
    setLoading(true);
    const res = await platform.getSchoolAdminCredentials(schoolId);
    setLoading(false);
    if (res.success && res.data) setCreds(res.data);
    else toast.error(res.error || t('app.error_title'));
  }

  async function reset() {
    const ok = await confirm({ title: t('app.sa_regenerate_title'), body: t('app.sa_regenerate_body'), destructive: true, confirmLabel: t('app.sa_regenerate') });
    if (!ok || !(await confirmIdentity(t('app.sa_auth_reason')))) return;
    const result = await regenerate.run(schoolId);
    if (result.ok && result.data) setCreds(result.data);
  }

  async function copy(value: string) {
    await Clipboard.setStringAsync(value);
    toast.success(t('app.sa_copied'));
  }

  if (!creds) {
    return (
      <Button variant="outline" onPress={reveal} disabled={loading}>
        <Icon as={Eye} className="size-4" />
        <Text>{t('app.sa_show_credentials')}</Text>
      </Button>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Field label={t('app.sa_username')} value={creds.username} />
        <Pressable onPress={() => copy(creds.username)} hitSlop={8} accessibilityLabel={t('app.sa_copy')}>
          <Icon as={Copy} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
      {creds.has_password && creds.password ? (
        <View className="flex-row items-center justify-between gap-2">
          <Field label={t('app.sa_password')} value={creds.password} />
          <Pressable onPress={() => copy(creds.password!)} hitSlop={8} accessibilityLabel={t('app.sa_copy')}>
            <Icon as={Copy} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
      ) : (
        <Text variant="muted">{t('app.sa_no_password')}</Text>
      )}
      <View className="flex-row flex-wrap gap-2 pt-1">
        <Button variant="ghost" size="sm" onPress={() => setCreds(null)}>
          <Icon as={EyeOff} className="size-4" />
          <Text>{t('app.sa_hide')}</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={reset} disabled={regenerate.running}>
          <Icon as={KeyRound} className="size-4" />
          <Text>{t('app.sa_regenerate')}</Text>
        </Button>
      </View>
    </View>
  );
}

export default function SchoolDetail() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  const admin = useApi(['platform', 'school-admin', id], () => platform.getSchoolAdmin(id), { shouldRetryOnError: false });
  const invoices = useApi(['platform', 'records', 'school', id], () => platform.listRecords({ school_id: id, limit: 20 }));

  const school = useMemo(() => schools.data?.find((s) => s.id === id), [schools.data, id]);
  const campuses = useMemo(() => (schools.data ?? []).filter((s) => s.parent_school_id === id), [schools.data, id]);

  const setStatus = useAction(platform.setSchoolStatus, {
    onSuccess: (updated?: PlatformSchool) => {
      schools.mutate((list) => list?.map((s) => (s.id === id && updated ? { ...s, ...updated } : s)), { revalidate: true });
    },
  });

  if (schools.isLoading && !schools.data) return <LoadingList />;
  if (schools.error && !schools.data) return <ErrorState message={schools.error.message} offline={schools.error.offline} onRetry={() => schools.mutate()} />;
  if (!school) return <ErrorState message={t('app.sa_no_schools')} />;

  const suspended = school.status === 'suspended';

  async function toggleStatus() {
    const s = school!;
    const ok = await confirm(
      suspended
        ? { title: t('app.sa_activate_title', { name: s.name }), body: t('app.sa_activate_body'), confirmLabel: t('app.sa_activate') }
        : {
            title: t('app.sa_suspend_title', { name: s.name }),
            body: t('app.sa_suspend_body'),
            confirmLabel: t('app.sa_suspend'),
            destructive: true,
            typeToConfirm: s.name,
          },
    );
    if (!ok) return;
    const result = await setStatus.run(s.id, suspended ? 'active' : 'suspended');
    if (result.ok) toast.success(suspended ? t('app.sa_activated_ok') : t('app.sa_suspended_ok'));
  }

  const campusLabel = t('app.sa_campuses', { count: campuses.length });
  const quick: [LucideIcon, string, () => void][] = [
    [Pencil, t('app.sd_edit'), () => router.push({ pathname: '/superadmin/school/edit', params: { id: school.id } })],
    [LayoutGrid, t('app.sd_modules'), () => router.push({ pathname: '/superadmin/school/modules', params: { id: school.id, name: school.name } })],
    [PanelLeft, t('app.sd_sidebar'), () => router.push({ pathname: '/superadmin/sidebar', params: { schoolId: school.id, name: school.name } })],
    [ListPlus, t('app.sd_fields'), () => router.push({ pathname: '/superadmin/school/fields', params: { id: school.id, name: school.name } })],
  ];

  return (
    <>
      <Stack.Screen options={{ title: school.short_name || school.name }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={schools.isValidating && !schools.isLoading}
            onRefresh={() => {
              schools.mutate();
              admin.mutate();
              invoices.mutate();
            }}
          />
        }>
        {/* Hero: logo, name, status, quick actions */}
        <BrandGradient variant="primary" angle={150} style={{ borderRadius: 24 }}>
          <View className="gap-4 p-5">
            <View className="flex-row items-center gap-3">
              <View className="bg-white rounded-2xl p-1.5">
                <SchoolLogo url={school.logo_url} shape={school.logo_shape} size={52} borderWidth={school.logo_border_width} borderColor={school.logo_border_color} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-white text-lg font-bold" numberOfLines={2}>
                  {school.name}
                </Text>
                <Text className="text-white text-xs opacity-80" numberOfLines={1}>
                  {[school.city, campusLabel, t('app.sd_since', { date: formatDate(school.created_at) })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View className="bg-overlay-light rounded-full px-2.5 py-1">
                <Text className="text-white text-[11px] font-semibold">{suspended ? t('app.sa_status_suspended') : onTrial(school) ? t('app.sa_status_trial') : t('app.sa_status_active')}</Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              {quick.map(([icon, label, onPress]) => (
                <Pressable key={label} onPress={onPress} className="w-[23%] items-center gap-1.5 active:opacity-70" accessibilityRole="button">
                  <View className="bg-overlay-light size-12 items-center justify-center rounded-2xl">
                    <Icon as={icon} strokeWidth={2.2} className="size-5 text-white" />
                  </View>
                  <Text className="text-white text-[11px] font-medium" numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </BrandGradient>

        {/* Status */}
        <Panel className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className={suspended ? 'bg-destructive-soft size-9 items-center justify-center rounded-full' : 'bg-success-soft size-9 items-center justify-center rounded-full'}>
              <Icon as={suspended ? ShieldOff : ShieldCheck} className={suspended ? 'text-destructive size-4' : 'text-success size-4'} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold">{t('app.sa_status_section')}</Text>
              <Text variant="muted" className="text-xs">
                {school.is_trial && school.trial_ends_at
                  ? `${onTrial(school) ? t('app.sa_trial_until') : t('app.sa_trial_ended')} ${formatDate(school.trial_ends_at)}`
                  : suspended
                    ? t('app.sa_status_suspended')
                    : t('app.sa_status_active')}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={toggleStatus}
            disabled={setStatus.running}
            className={suspended ? 'bg-success-soft h-11 items-center justify-center rounded-full active:opacity-80' : 'bg-destructive-soft h-11 items-center justify-center rounded-full active:opacity-80'}
            accessibilityRole="button">
            <Text className={suspended ? 'text-success font-semibold' : 'text-destructive font-semibold'}>{suspended ? t('app.sa_activate') : t('app.sa_suspend')}</Text>
          </Pressable>
        </Panel>

        {/* Details */}
        <Panel>
          <PanelTitle title={t('app.sa_details')} />
          <InfoRow icon={Mail} label={t('app.sa_email')} value={school.contact_email} />
          <InfoRow icon={Phone} label={t('app.sa_phone')} value={school.phone} />
          <InfoRow icon={Globe} label={t('app.sa_website')} value={school.website} />
          <InfoRow icon={MapPin} label={t('app.sa_address')} value={[school.address, school.city, school.state].filter(Boolean).join(', ')} />
          <InfoRow icon={UserRound} label={t('app.sa_principal')} value={school.principal_name} />
          <InfoRow icon={Link2} label={t('app.sa_slug')} value={school.slug} />
          <InfoRow icon={CalendarDays} label={t('app.sa_created')} value={formatDate(school.created_at)} last />
        </Panel>

        {/* School administrator */}
        <Panel>
          <PanelTitle title={t('app.sa_admin_section')} />
          <View className="gap-3 px-4 pb-4 pt-2">
            {admin.data ? (
              <>
                <View className="flex-row items-center gap-3">
                  <View className="bg-info-soft size-10 items-center justify-center rounded-full">
                    <Text className="text-brand dark:text-brand-secondary font-bold">{(admin.data.admin_name || '?').trim().charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {admin.data.admin_name}
                    </Text>
                    <Text variant="muted" className="text-xs" numberOfLines={1} selectable>
                      {admin.data.admin_email}
                    </Text>
                  </View>
                </View>
                <AdminCredentials schoolId={school.id} />
              </>
            ) : admin.isLoading ? (
              <LoadingList rows={1} />
            ) : (
              <Text variant="muted">{t('app.sa_no_admin')}</Text>
            )}
          </View>
        </Panel>

        {/* Setup */}
        <Panel>
          <ActionRow icon={Copy} title={t('app.cs_entry')} last onPress={() => router.push({ pathname: '/superadmin/school/copy-settings', params: { id: school.id, name: school.name } })} />
        </Panel>

        {campuses.length > 0 ? (
          <Panel>
            <PanelTitle title={t('app.sa_campuses_section')} />
            {campuses.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/superadmin/school/[id]', params: { id: c.id } })}
                className={i < campuses.length - 1 ? 'border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-2.5 active:opacity-70' : 'flex-row items-center gap-3 px-4 py-2.5 active:opacity-70'}>
                <SchoolLogo url={c.logo_url} shape={c.logo_shape} size={32} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.city ? (
                    <Text variant="muted" className="text-[11px]">
                      {c.city}
                    </Text>
                  ) : null}
                </View>
                <StatusChip label={c.status === 'suspended' ? t('app.sa_status_suspended') : t('app.sa_status_active')} tone={c.status === 'suspended' ? 'destructive' : 'success'} />
              </Pressable>
            ))}
          </Panel>
        ) : null}

        <Panel>
          <PanelTitle title={t('app.sa_invoices_section')} />
          {(invoices.data ?? []).length === 0 ? (
            <Text variant="muted" className="px-4 pb-4 pt-1 text-sm">
              {invoices.isLoading ? '…' : t('app.sa_no_invoices')}
            </Text>
          ) : (
            (invoices.data ?? []).map((r, i, arr) => {
              const st = r.effective_status ?? r.payment_status;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/superadmin/billing/record/[id]', params: { id: r.id } })}
                  className={i < arr.length - 1 ? 'border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-2.5 active:opacity-70' : 'flex-row items-center gap-3 px-4 py-2.5 active:opacity-70'}>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {r.invoice_number}
                    </Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                      {[r.subscription_plan, t('app.sa_due', { date: formatDate(r.due_date) })].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View className="items-end gap-1">
                    <Text className="text-sm font-bold">{formatMoney(r.amount, r.currency)}</Text>
                    <StatusChip label={t(`app.sa_pay_status_${st}`)} tone={PAY_TONE[st]} className="px-2 py-0.5" />
                  </View>
                </Pressable>
              );
            })
          )}
        </Panel>
      </ScrollView>
    </>
  );
}
