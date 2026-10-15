import { Stack } from 'expo-router';
import { KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard } from '@/features/admin/settings-ui';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Make every user of the campus set a new password at next sign-in, or clear that (web: /admin/settings/force-password-change). */
export default function ForcePasswordChange() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const status = useApi(['admin', 'force-password-status', campusId ?? 'school'], () => adminSchool.forcePasswordStatus(campusId));
  const [busy, setBusy] = useState<'force' | 'reset' | null>(null);
  const count = status.data?.count ?? null;

  async function run(kind: 'force' | 'reset') {
    const ok = await confirm(
      kind === 'force'
        ? { title: t('app.ps_fp_force_title'), body: t('app.ps_fp_force_body'), confirmLabel: t('app.ps_fp_force_btn'), destructive: true }
        : { title: t('app.ps_fp_reset_title'), body: t('app.ps_fp_reset_body'), confirmLabel: t('app.ps_fp_reset_btn') },
    );
    if (!ok) return;
    setBusy(kind);
    const r = kind === 'force' ? await adminSchool.forcePasswordChange(campusId) : await adminSchool.resetForcePasswordChange(campusId);
    setBusy(null);
    if (!r.success || r.data == null) return toast.error(r.error || t('app.ps_fp_failed'));
    const n = r.data.count;
    if (kind === 'force') toast.success(n > 0 ? t('app.ps_fp_forced', { count: n }) : t('app.ps_fp_none_updated'));
    else toast.success(n > 0 ? t('app.ps_fp_cleared', { count: n }) : t('app.ps_fp_none_flagged'));
    status.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.ps_fp_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{t('app.ps_fp_subtitle')}</Text>
        <InfoBanner title={t('app.ps_how_it_works')}>{t('app.ps_fp_how')}</InfoBanner>
        <SettingsCard title={t('app.ps_fp_status')} description={t('app.ps_fp_status_desc')} icon={Users}>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">{t('app.ps_fp_pending')}</Text>
            {status.isLoading ? (
              <ActivityIndicator />
            ) : (
              <Badge variant={count && count > 0 ? 'destructive' : 'secondary'}>
                <Text>{String(count ?? 0)}</Text>
              </Badge>
            )}
          </View>
          {count !== null && count > 0 ? (
            <View className="flex-row items-center gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
              <Icon as={ShieldAlert} className="size-4 text-amber-700" />
              <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">{t('app.ps_fp_will_prompt', { count })}</Text>
            </View>
          ) : null}
          {count === 0 ? (
            <View className="flex-row items-center gap-2 rounded-md bg-green-50 p-2 dark:bg-green-950/30">
              <Icon as={ShieldCheck} className="size-4 text-green-700" />
              <Text className="flex-1 text-sm text-green-800 dark:text-green-300">{t('app.ps_fp_nobody')}</Text>
            </View>
          ) : null}
          <Button variant="outline" size="sm" onPress={() => status.mutate()} disabled={status.isValidating}>
            <Icon as={RefreshCw} className="size-4" />
            <Text>{status.isValidating ? t('app.ps_refreshing') : t('app.ps_fp_refresh')}</Text>
          </Button>
        </SettingsCard>
        <SettingsCard title={t('app.ps_fp_actions')} description={t('app.ps_fp_actions_desc')} icon={KeyRound}>
          <Button onPress={() => run('force')} disabled={!!busy}>
            <Icon as={ShieldAlert} className="text-primary-foreground size-4" />
            <Text>{busy === 'force' ? t('app.ps_applying') : t('app.ps_fp_title')}</Text>
          </Button>
          <Button variant="outline" onPress={() => run('reset')} disabled={!!busy || count === 0}>
            <Icon as={ShieldCheck} className="size-4" />
            <Text>{busy === 'reset' ? t('app.ps_resetting') : t('app.ps_fp_reset')}</Text>
          </Button>
          <Text className="text-muted-foreground text-xs">{t('app.ps_fp_scope')}</Text>
        </SettingsCard>
      </ScrollView>
    </>
  );
}
