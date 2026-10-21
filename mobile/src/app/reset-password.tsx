import { zodResolver } from '@hookform/resolvers/zod';
import { passwordPair } from '@studently/shared-utils';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { LinkIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { auth } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAction } from '@/lib/use-action';

const schema = passwordPair();
type FormValues = { password: string; confirm: string };

/**
 * Opened from the reset email (studently://reset-password?code=...). Exchanges the one-time code
 * for a session on this device, then sets the new password through the API (same rules as the web,
 * clears "must change password").
 */
export default function ResetPassword() {
  const { t } = useTranslation();
  const toast = useToast();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [state, setState] = useState<'verifying' | 'ready' | 'invalid'>(code ? 'verifying' : 'invalid');
  const exchanged = useRef(false);
  const { control, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });
  const save = useAction((f: FormValues) => auth.changePassword(f.password));

  useEffect(() => {
    if (!code || exchanged.current) return;
    exchanged.current = true;
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (__DEV__ && error) console.warn('[auth] reset code exchange failed', error.status, error.code, error.message);
      setState(error ? 'invalid' : 'ready');
    });
  }, [code]);

  const onSubmit = handleSubmit(async (f) => {
    if ((await save.run(f)).ok) {
      toast.success(t('app.rp_done'));
      router.replace('/');
    }
  });

  if (state === 'verifying') {
    return (
      <Screen auth contentContainerClassName="justify-center p-6">
        <LoadingList rows={2} />
      </Screen>
    );
  }

  if (state === 'invalid') {
    return (
      <Screen auth contentContainerClassName="flex-1 items-center justify-center gap-4 p-6">
        <Icon as={LinkIcon} className="text-destructive size-12" />
        <Text variant="h3" className="text-center">
          {t('app.rp_invalid_title')}
        </Text>
        <Text variant="muted" className="text-center">
          {t('app.rp_invalid_body')}
          {__DEV__ && error_description ? `\n(${error_description})` : ''}
        </Text>
        <Button onPress={() => router.replace('/forgot-password')} className="self-stretch">
          <Text>{t('app.rp_new_link')}</Text>
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/')} className="self-stretch">
          <Text>{t('app.fp_back')}</Text>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen auth scroll contentContainerClassName="gap-6 p-6">
      <View className="items-center gap-3 pt-8">
        <Image source={require('@/assets/images/reset-password.png')} style={{ width: 150, height: 150 }} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text variant="h3" className="text-center">
          {t('app.rp_title')}
        </Text>
        <Text variant="muted" className="text-center">
          {t('app.rp_body')}
        </Text>
      </View>
      <TextField control={control} name="password" label={t('app.st_new_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <TextField control={control} name="confirm" label={t('app.st_confirm_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Button onPress={onSubmit} disabled={save.running}>
        <Text>{t('app.rp_save')}</Text>
      </Button>
    </Screen>
  );
}
