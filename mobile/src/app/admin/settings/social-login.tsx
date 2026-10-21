import type { SocialLoginSettings } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Copy, Eye, EyeOff, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { InfoBanner, SettingsCard, SwitchRow } from '@/features/admin/settings-ui';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';

type Provider = 'google' | 'microsoft';
type Form = { enabled: boolean; clientId: string; secret: string; restrict: string };

/**
 * Sign in with Google or Microsoft for the school or the selected campus: client id, secret (kept
 * masked once saved), domain or tenant restriction (web: /admin/settings/google-social-login and microsoft-social-login).
 */
export default function SocialLogin() {
  const { t } = useTranslation();
  const toast = useToast();
  const params = useLocalSearchParams<{ provider?: string }>();
  const p: Provider = params.provider === 'microsoft' ? 'microsoft' : 'google';
  const s = (k: string, o?: Record<string, unknown>) => t(`app.ps_sso_${p}_${k}`, o);
  const c = (k: string, o?: Record<string, unknown>) => t(`app.ps_sso_${k}`, o);
  const { campusId } = useCampus();
  const data = useApi(['admin', 'social-login', campusId ?? 'school'], () => adminSchool.socialLogin(campusId));
  const [form, setForm] = useState<Form | null>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  if (data.isLoading) return <LoadingList rows={4} />;
  if (data.error) return <ErrorState message={data.error.message} onRetry={() => data.mutate()} />;
  const d = data.data;
  const hasSecret = p === 'google' ? !!d?.has_google_secret : !!d?.has_microsoft_secret;
  const v: Form = form ?? {
    enabled: p === 'google' ? !!d?.google_enabled : !!d?.microsoft_enabled,
    clientId: (p === 'google' ? d?.google_client_id : d?.microsoft_client_id) ?? '',
    secret: '',
    restrict: (p === 'google' ? d?.google_hosted_domain : d?.microsoft_tenant) ?? '',
  };
  const set = (patch: Partial<Form>) => setForm({ ...v, ...patch });
  const redirect = `${env.apiUrl.replace(/\/api\/?$/, '')}/api/auth/social/${p}/callback`;

  async function save() {
    if (v.enabled && !v.clientId.trim()) return toast.error(s('id_required'));
    if (v.enabled && !hasSecret && !v.secret.trim()) return toast.error(s('secret_required'));
    setSaving(true);
    const body: Partial<SocialLoginSettings> =
      p === 'google'
        ? { google_enabled: v.enabled, google_client_id: v.clientId.trim(), google_client_secret: v.secret, google_hosted_domain: v.restrict.trim() }
        : { microsoft_enabled: v.enabled, microsoft_client_id: v.clientId.trim(), microsoft_client_secret: v.secret, microsoft_tenant: v.restrict.trim() };
    const r = await adminSchool.saveSocialLogin(body, campusId);
    setSaving(false);
    if (!r.success) return toast.error(r.error || t('app.ps_save_failed'));
    toast.success(s('saved'));
    setForm(null);
    data.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text variant="muted">{s('subtitle')}</Text>
        <InfoBanner title={c('setup')}>
          <View className="gap-1">
            <Text className="text-sm text-brand dark:text-brand-secondary ">{`1. ${s('step1')}`}</Text>
            <Text className="text-sm text-brand dark:text-brand-secondary ">{`2. ${s('step2')}`}</Text>
            <Text className="text-sm text-brand dark:text-brand-secondary ">{`3. ${s('step3')}`}</Text>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(redirect);
                toast.success(c('copied'));
              }}
              accessibilityRole="button"
              className="flex-row items-center gap-2 rounded bg-white/70 p-2 dark:bg-black/30">
              <Text className="flex-1 font-mono text-xs" selectable>
                {redirect}
              </Text>
              <Icon as={Copy} className="size-4 text-brand dark:text-brand-secondary" />
            </Pressable>
            <Text className="text-sm text-brand dark:text-brand-secondary ">{`4. ${s('step4')}`}</Text>
          </View>
        </InfoBanner>
        <SwitchRow label={s('enable')} hint={c('enable_hint', { provider: s('name') })} value={v.enabled} onChange={(enabled) => set({ enabled })} />
        {v.enabled ? (
          <>
            <SettingsCard title={c('credentials')} description={s('credentials_desc')}>
              <Label>{s('id_label')}</Label>
              <Input value={v.clientId} onChangeText={(clientId) => set({ clientId })} placeholder={s('id_ph')} autoCapitalize="none" autoCorrect={false} />
              <Label>{c('secret')}</Label>
              <View className="flex-row items-center gap-2">
                <Input
                  className="flex-1"
                  value={v.secret}
                  onChangeText={(secret) => set({ secret })}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={hasSecret ? c('secret_saved_ph') : c('secret_ph')}
                />
                <Pressable onPress={() => setShow((x) => !x)} accessibilityRole="button" accessibilityLabel={c('show_secret')} hitSlop={8}>
                  <Icon as={show ? EyeOff : Eye} className="text-muted-foreground size-5" />
                </Pressable>
              </View>
              {hasSecret ? <Text className="text-muted-foreground text-xs">{c('secret_saved_hint')}</Text> : null}
            </SettingsCard>
            <SettingsCard title={s('restrict_title')} description={s('restrict_desc')}>
              <Label>{s('restrict_label')}</Label>
              <Input value={v.restrict} onChangeText={(restrict) => set({ restrict })} placeholder={s('restrict_ph')} autoCapitalize="none" autoCorrect={false} />
              <Text className="text-muted-foreground text-xs">{s('restrict_hint')}</Text>
              <Text className="text-xs text-warning ">{c('important')}</Text>
            </SettingsCard>
            <SettingsCard title={c('how_title')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Text key={n} className="text-muted-foreground text-sm">{`${n}. ${c(`how${n}`, { provider: s('name') })}`}</Text>
              ))}
            </SettingsCard>
          </>
        ) : null}
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? t('common.saving') : t('app.ps_save_settings')}</Text>
        </Button>
      </ScrollView>
    </>
  );
}
