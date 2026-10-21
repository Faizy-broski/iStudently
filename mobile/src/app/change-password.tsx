import { zodResolver } from '@hookform/resolvers/zod';
import { passwordPair } from '@studently/shared-utils';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { verifyCurrentPassword } from '@/features/auth/reauth';
import { useSession } from '@/features/auth/session';
import { auth } from '@/lib/api';
import { useAction } from '@/lib/use-action';

// `current` is checked by signing in again (verifyCurrentPassword), not by the schema.
const schema = passwordPair().and(z.object({ current: z.string() }));
type FormValues = { password: string; confirm: string; current: string };

/** Change own password (any role), via POST /auth/change-password. */
export default function ChangePassword() {
  const { t } = useTranslation();
  // forced=1: the account must change its password before anything else (sign-in gate).
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const { refreshMe, signOut } = useSession();
  const { control, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '', current: '' } });
  const toast = useToast();
  const save = useAction((f: FormValues) => auth.changePassword(f.password), { success: t('app.st_password_changed') });

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('app.set_change_password'), presentation: forced ? 'card' : 'modal', headerBackVisible: !forced, gestureEnabled: !forced }} />
      <Screen auth scroll edges={['bottom']}>
        <View className="items-center pt-2">
          <Image source={require('@/assets/images/reset-password.png')} style={{ width: 140, height: 140 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>
        <Text variant="muted">{forced ? t('app.cpw_forced') : t('app.rp_body')}</Text>
        {/* The forced change comes right after signing in with the temporary password, so it isn't asked again. */}
        {forced ? null : <TextField control={control} name="current" label={t('app.st_current_password')} secureTextEntry autoComplete="current-password" textContentType="password" />}
        <TextField control={control} name="password" label={t('app.st_new_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <TextField control={control} name="confirm" label={t('app.st_confirm_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Button
          onPress={handleSubmit(async (f) => {
            if (!forced && !(await verifyCurrentPassword(f.current))) return toast.error(t('app.st_current_password_wrong'));
            if (!(await save.run(f)).ok) return;
            if (forced) {
              await refreshMe();
              router.replace('/');
            } else router.back();
          })}
          disabled={save.running}>
          <Text>{t('app.rp_save')}</Text>
        </Button>
        {forced ? (
          <Button variant="ghost" onPress={signOut}>
            <Text>{t('app.sign_out')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
