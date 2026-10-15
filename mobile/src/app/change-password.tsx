import { zodResolver } from '@hookform/resolvers/zod';
import { passwordPair } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { TextField } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { auth } from '@/lib/api';
import { useAction } from '@/lib/use-action';

const schema = passwordPair();
type FormValues = { password: string; confirm: string };

/** Change own password (any role), via POST /auth/change-password. */
export default function ChangePassword() {
  const { t } = useTranslation();
  // forced=1: the account must change its password before anything else (sign-in gate).
  const { forced } = useLocalSearchParams<{ forced?: string }>();
  const { refreshMe, signOut } = useSession();
  const { control, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });
  const save = useAction((f: FormValues) => auth.changePassword(f.password), { success: t('app.st_password_changed') });

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('app.set_change_password'), presentation: forced ? 'card' : 'modal', headerBackVisible: !forced, gestureEnabled: !forced }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{forced ? t('app.cpw_forced') : t('app.rp_body')}</Text>
        <TextField control={control} name="password" label={t('app.st_new_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <TextField control={control} name="confirm" label={t('app.st_confirm_password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Button
          onPress={handleSubmit(async (f) => {
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
