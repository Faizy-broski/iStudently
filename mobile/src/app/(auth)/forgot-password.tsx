import { isPlaceholderEmail } from '@studently/shared-utils';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Mail, MailCheck, ShieldQuestion } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormError } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { auth } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type Outcome = 'sent' | 'ask_admin';

/**
 * Sends a Supabase reset link that opens the app (studently://reset-password?code=...).
 * The same "sent" message shows whether or not the account exists. Accounts without a real
 * email (placeholder addresses) can only be reset by the school admin.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function onSubmit() {
    const value = identifier.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      let email: string | null = value;
      if (!value.includes('@')) {
        const res = await auth.resolveUsername(value);
        if (!res.ok && res.reason !== 'not_found') return setError(t(res.reason === 'rate_limited' ? 'app.si_rate_limited' : 'app.si_network'));
        email = res.ok ? res.email : null;
      }
      if (isPlaceholderEmail(email)) return setOutcome('ask_admin');
      if (email) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('reset-password') });
        if (err?.status === 429) return setError(t('app.si_rate_limited'));
        if (err && !err.status) return setError(t('app.si_network'));
        if (__DEV__ && err) console.warn('[auth] reset email failed', err.status, err.code, err.message);
      }
      setOutcome('sent');
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    return (
      <Screen auth contentContainerClassName="flex-1 items-center justify-center gap-4 p-6">
        <Icon as={outcome === 'sent' ? MailCheck : ShieldQuestion} className="text-primary size-12" />
        <Text variant="h3" className="text-center">
          {t(outcome === 'sent' ? 'app.fp_sent_title' : 'app.fp_admin_title')}
        </Text>
        <Text variant="muted" className="text-center">
          {t(outcome === 'sent' ? 'app.fp_sent_body' : 'app.fp_admin_body')}
        </Text>
        <Button onPress={() => router.back()} className="self-stretch">
          <Text>{t('app.fp_back')}</Text>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen auth scroll contentContainerClassName="gap-6 p-6">
      <Button variant="ghost" size="sm" className="self-start" onPress={() => router.back()} accessibilityLabel={t('app.fp_back')}>
        <Icon flipRtl as={ArrowLeft} className="size-4" />
        <Text>{t('app.fp_back')}</Text>
      </Button>
      <View className="items-center gap-2">
        <Image source={require('@/assets/images/forgot-password.png')} style={{ width: 160, height: 160 }} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text className="text-center text-2xl font-bold">{t('app.fp_title')}</Text>
        <Text variant="muted" className="text-center">
          {t('app.fp_body')}
        </Text>
      </View>
      <View className="gap-1.5">
        <Label nativeID="fp-identifier">{t('login.label_email_or_username')}</Label>
        <Input
          icon={Mail}
          aria-labelledby="fp-identifier"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder={t('login.placeholder_email_or_username')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={onSubmit}
        />
      </View>
      <FormError message={error} />
      <Button onPress={onSubmit} disabled={!identifier.trim() || busy}>
        <Text>{busy ? t('app.fp_sending') : t('app.fp_send')}</Text>
      </Button>
    </Screen>
  );
}
