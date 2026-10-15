import { htmlToText } from '@studently/shared-utils';
import { router } from 'expo-router';
import { FileSignature } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FormError } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { locale } from '@/i18n';
import { agreement } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The school's sign-in agreement (same rules as the web's AgreementModal): read, confirm, accept or reject. */
export default function Agreement() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { refreshMe, signOut } = useSession();
  const check = useApi(['agreement-check'], () => agreement.check());
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function done() {
    await refreshMe();
    router.replace('/');
  }

  if (check.isLoading) return <LoadingList rows={4} />;
  if (check.error) return <ErrorState message={check.error.message} onRetry={() => check.mutate()} />;
  const items = check.data?.agreement?.agreements?.filter((a) => a.enabled) ?? [];
  if (!check.data?.must_accept || items.length === 0) {
    done();
    return <LoadingList rows={2} />;
  }
  const en = locale === 'en';
  const children = check.data.students_needing_acceptance ?? [];

  async function accept() {
    if (!read) return setError(t('app.ag_confirm_required'));
    setBusy(true);
    const res = await agreement.accept();
    setBusy(false);
    if (!res.success) return setError(res.error || t('app.error_title'));
    await done();
  }

  async function reject() {
    const ok = await confirm({
      title: t('app.ag_reject_title'),
      body: t(children.length ? 'app.ag_reject_body_parent' : 'app.ag_reject_body'),
      destructive: true,
      confirmLabel: t('app.ag_reject'),
    });
    if (!ok) return;
    setBusy(true);
    const res = await agreement.reject();
    setBusy(false);
    if (!res.success) return setError(res.error || t('app.error_title'));
    await signOut();
  }

  return (
    <Screen scroll contentContainerClassName="gap-4 p-4">
      <View className="items-center gap-2 pt-4">
        <Icon as={FileSignature} className="text-primary size-10" />
        <Text variant="h3" className="text-center">
          {t('app.ag_title')}
        </Text>
        <Text variant="muted" className="text-center">
          {t('app.ag_body')}
        </Text>
      </View>
      {children.length > 0 ? (
        <Text className="text-sm">
          {t('app.ag_covers', { names: children.map((c) => c.name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')).join(', ') })}
        </Text>
      ) : null}
      {items.map((a) => (
        <Card key={a.id} className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle>{en ? a.title_en || a.title : a.title || a.title_en}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <Text selectable className="leading-6">
              {htmlToText(en ? a.content_en || a.content : a.content || a.content_en || '')}
            </Text>
          </CardContent>
        </Card>
      ))}
      <Pressable onPress={() => setRead((r) => !r)} className="flex-row items-center gap-3" accessibilityRole="checkbox" accessibilityState={{ checked: read }}>
        <Checkbox checked={read} onCheckedChange={setRead} />
        <Text className="flex-1">{t('app.ag_read_confirm')}</Text>
      </Pressable>
      <FormError message={error} />
      <Button onPress={accept} disabled={busy}>
        <Text>{t('app.ag_accept')}</Text>
      </Button>
      <Button variant="ghost" onPress={reject} disabled={busy}>
        <Text className="text-destructive">{t('app.ag_reject')}</Text>
      </Button>
      <Button variant="ghost" onPress={signOut} disabled={busy}>
        <Text>{t('app.sign_out')}</Text>
      </Button>
    </Screen>
  );
}
