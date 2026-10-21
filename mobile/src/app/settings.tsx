import { isPlaceholderEmail } from '@studently/shared-utils';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bell, FileText, KeyRound, QrCode, LifeBuoy, LogOut, ShieldCheck, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { IconTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAppConfig } from '@/features/app-config/app-config';
import { useAppLock } from '@/features/auth/app-lock';
import { pushEnabled, setPushEnabled } from '@/features/push/push';
import { DeleteAccountSheet } from '@/features/auth/delete-account';
import { auth } from '@/lib/api';
import { env } from '@/lib/env';
import { useSession } from '@/features/auth/session';
import { locale, setLocale } from '@/i18n';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme-preference';

/** App settings for every role: language, theme, app lock, password, legal links, sign out. */
export default function Settings() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const config = useAppConfig();
  const lock = useAppLock();
  const [push, setPush] = useState(pushEnabled);
  const { me, signOut } = useSession();
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const profile = me.status === 'ready' ? me.me.profile : null;
  const school = me.status === 'ready' ? me.me.school : null;
  const links = config?.links;
  const email = profile?.email && !isPlaceholderEmail(profile.email) ? profile.email : null;

  async function changeLanguage(next: 'en' | 'ar') {
    if (next === locale) return;
    const ok = await confirm({ title: t('app.set_language_title'), body: t('app.set_language_body'), confirmLabel: t('app.set_language_restart') });
    if (!ok) return;
    await auth.updateLanguage(next); // best effort; the device choice applies either way
    setLocale(next);
  }

  const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => toast.error(t('app.error_title')));

  // Everyone deletes in the app; the platform super admin account goes through support instead.
  const [deleting, setDeleting] = useState(false);
  async function requestDeletion() {
    if (profile?.role !== 'super_admin') return setDeleting(true);
    if (links?.account_deletion_url) return open(links.account_deletion_url);
    if (links?.support_email) {
      const subject = encodeURIComponent('Account deletion request');
      const body = encodeURIComponent(`Please delete my account.\nUsername: ${profile?.username ?? ''}\nSchool: ${school?.name ?? ''}`);
      return Linking.openURL(`mailto:${links.support_email}?subject=${subject}&body=${body}`).catch(() => toast.error(t('app.set_no_mail_app')));
    }
    toast.info(t('app.set_deletion_school'));
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('app.set_title') }} />
      <Screen scroll edges={['bottom']}>
        {profile ? (
          <View className="gap-0.5 px-1">
            <Text variant="large">{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username}</Text>
            <Text variant="muted">{[email ?? profile.username, school?.name].filter(Boolean).join(' · ')}</Text>
          </View>
        ) : null}

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.set_language')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <FilterChips<'en' | 'ar'> value={locale} onChange={changeLanguage} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{t('app.set_theme')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <FilterChips<ThemePreference>
              value={theme}
              onChange={(v) => {
                setTheme(v);
                setThemePreference(v);
              }}
              options={[
                { value: 'system', label: t('app.set_theme_system') },
                { value: 'light', label: t('app.set_theme_light') },
                { value: 'dark', label: t('app.set_theme_dark') },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <View className="flex-row items-center gap-3 px-4 py-3">
            <IconTile icon={Bell} size={40} />
            <View className="flex-1 gap-0.5">
              <Text>{t('app.set_push')}</Text>
              <Text className="text-muted-foreground text-sm">{t('app.set_push_hint')}</Text>
            </View>
            <Switch
              checked={push}
              onCheckedChange={async (on) => {
                setPush(on);
                if (!(await setPushEnabled(on)) && on) toast.error(t('app.set_push_denied'));
              }}
              accessibilityLabel={t('app.set_push')}
            />
          </View>
          <Separator />
          {lock.available ? (
            <>
              <View className="flex-row items-center gap-3 px-4 py-3">
                <IconTile icon={ShieldCheck} size={40} />
                <View className="flex-1 gap-0.5">
                  <Text>{t('app.set_app_lock')}</Text>
                  <Text className="text-muted-foreground text-sm">{t('app.set_app_lock_hint')}</Text>
                </View>
                <Switch
                  checked={lock.enabled}
                  onCheckedChange={async (on) => {
                    if (!(await lock.setEnabled(on)) && on) toast.error(t('app.set_app_lock_failed'));
                  }}
                  accessibilityLabel={t('app.set_app_lock')}
                />
              </View>
              <Separator />
            </>
          ) : null}
          <ListRow title={t('app.qr_title')} leading={<Icon as={QrCode} className="text-muted-foreground size-5" />} onPress={() => router.push('/my-qr')} />
          <Separator />
          <ListRow
            title={t('app.set_change_password')}
            leading={<Icon as={KeyRound} className="text-muted-foreground size-5" />}
            onPress={() => router.push('/change-password')}
          />
        </Card>

        <Card className="gap-0 py-0">
          {/* Always shown: the website's pages are the fallback when app-config is unavailable. */}
          <ListRow title={t('app.set_privacy')} leading={<Icon as={FileText} className="text-muted-foreground size-5" />} onPress={() => open(links?.privacy_url ?? `${env.webUrl}/privacy`)} />
          <Separator />
          <ListRow title={t('app.set_terms')} leading={<Icon as={FileText} className="text-muted-foreground size-5" />} onPress={() => open(links?.terms_url ?? `${env.webUrl}/terms`)} />
          <Separator />
          {links?.support_email ? (
            <>
              <ListRow
                title={t('app.set_support')}
                subtitle={links.support_email}
                leading={<Icon as={LifeBuoy} className="text-muted-foreground size-5" />}
                onPress={() => Linking.openURL(`mailto:${links.support_email}`).catch(() => toast.error(t('app.set_no_mail_app')))}
              />
              <Separator />
            </>
          ) : null}
          <ListRow
            title={t('app.set_delete_account')}
            subtitle={t('app.set_delete_account_hint')}
            leading={<Icon as={UserX} className="text-muted-foreground size-5" />}
            onPress={requestDeletion}
          />
        </Card>

        <Card className="gap-0 py-0">
          <ListRow
            title={t('app.sign_out')}
            leading={<Icon as={LogOut} className="text-destructive size-5" />}
            chevron={false}
            onPress={async () => {
              if (await confirm({ title: t('app.set_sign_out_title'), confirmLabel: t('app.sign_out'), destructive: true })) signOut();
            }}
          />
        </Card>

        <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} />

        <Text variant="muted" className="text-center text-xs">
          {t('app.set_version', { version: Constants.expoConfig?.version ?? '?' })}
        </Text>
      </Screen>
    </>
  );
}
