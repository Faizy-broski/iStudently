import type { PlatformSchool, SchoolAdminCredentials } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { ListRow } from '@/components/app/list-row';
import { SchoolLogo } from '@/components/app/school-logo';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { PAY_VARIANT } from '@/features/superadmin/billing';
import { onTrial, SchoolStatusBadge } from '@/features/superadmin/school-status';
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

  return (
    <>
      <Stack.Screen options={{ title: school.short_name || school.name }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
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
        <View className="flex-row items-center gap-3">
          <SchoolLogo url={school.logo_url} shape={school.logo_shape} size={56} borderWidth={school.logo_border_width} borderColor={school.logo_border_color} />
          <View className="flex-1 gap-1">
            <Text variant="large" numberOfLines={2}>
              {school.name}
            </Text>
            <View className="flex-row">
              <SchoolStatusBadge school={school} />
            </View>
          </View>
        </View>

        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.sa_status_section')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            {school.is_trial && school.trial_ends_at ? (
              <Field label={onTrial(school) ? t('app.sa_trial_until') : t('app.sa_trial_ended')} value={formatDate(school.trial_ends_at)} />
            ) : null}
            <Button variant={suspended ? 'default' : 'destructive'} onPress={toggleStatus} disabled={setStatus.running}>
              <Text>{suspended ? t('app.sa_activate') : t('app.sa_suspend')}</Text>
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.sa_details')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <Field label={t('app.sa_email')} value={school.contact_email} />
            <Field label={t('app.sa_phone')} value={school.phone} />
            <Field label={t('app.sa_website')} value={school.website} />
            <Field label={t('app.sa_address')} value={[school.address, school.city, school.state].filter(Boolean).join(', ')} />
            <Field label={t('app.sa_principal')} value={school.principal_name} />
            <Field label={t('app.sa_slug')} value={school.slug} />
            <Field label={t('app.sa_created')} value={formatDate(school.created_at)} />
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.sa_admin_section')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            {admin.data ? (
              <>
                <Field label={t('app.sa_name')} value={admin.data.admin_name} />
                <Field label={t('app.sa_email')} value={admin.data.admin_email} />
                <AdminCredentials schoolId={school.id} />
              </>
            ) : admin.isLoading ? (
              <LoadingList rows={1} />
            ) : (
              <Text variant="muted">{t('app.sa_no_admin')}</Text>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <ListRow
            title={t('app.es_edit')}
            onPress={() => router.push({ pathname: '/superadmin/school/edit', params: { id: school.id } })}
          />
          <Separator />
          <ListRow
            title={t('app.ma_entry')}
            onPress={() => router.push({ pathname: '/superadmin/school/modules', params: { id: school.id, name: school.name } })}
          />
          <Separator />
          <ListRow
            title={t('app.sb_school_sidebar')}
            onPress={() => router.push({ pathname: '/superadmin/sidebar', params: { schoolId: school.id, name: school.name } })}
          />
          <Separator />
          <ListRow
            title={t('app.cf_entry')}
            onPress={() => router.push({ pathname: '/superadmin/school/fields', params: { id: school.id, name: school.name } })}
          />
          <Separator />
          <ListRow
            title={t('app.cs_entry')}
            onPress={() => router.push({ pathname: '/superadmin/school/copy-settings', params: { id: school.id, name: school.name } })}
          />
        </Card>

        {campuses.length > 0 ? (
          <Card className="gap-0 py-0">
            <CardHeader className="px-4 py-4">
              <CardTitle>{t('app.sa_campuses_section')}</CardTitle>
            </CardHeader>
            {campuses.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Separator /> : null}
                <ListRow
                  title={c.name}
                  subtitle={c.city}
                  leading={<SchoolLogo url={c.logo_url} shape={c.logo_shape} size={36} />}
                  trailing={<SchoolStatusBadge school={c} />}
                  onPress={() => router.push({ pathname: '/superadmin/school/[id]', params: { id: c.id } })}
                />
              </View>
            ))}
          </Card>
        ) : null}

        <Card className="gap-0 py-0">
          <CardHeader className="px-4 py-4">
            <CardTitle>{t('app.sa_invoices_section')}</CardTitle>
          </CardHeader>
          {(invoices.data ?? []).length === 0 ? (
            <Text variant="muted" className="px-4 pb-4">
              {invoices.isLoading ? '…' : t('app.sa_no_invoices')}
            </Text>
          ) : (
            (invoices.data ?? []).map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Separator /> : null}
                <ListRow
                  title={`${r.invoice_number} · ${formatMoney(r.amount, r.currency)}`}
                  subtitle={[r.subscription_plan, t('app.sa_due', { date: formatDate(r.due_date) })].filter(Boolean).join(' · ')}
                  trailing={
                    <Badge variant={PAY_VARIANT[r.effective_status ?? r.payment_status]}>
                      <Text>{t(`app.sa_pay_status_${r.effective_status ?? r.payment_status}`)}</Text>
                    </Badge>
                  }
                />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </>
  );
}
