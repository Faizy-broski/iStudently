import type { TwoFASetup } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyRound, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { FormError } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { twoFa } from '@/lib/api';

type Mode = 'verify' | 'setup' | 'recovery';

/** 6-digit code field; submits on the 6th digit and fills from SMS/keychain one-time codes. */
function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <Label nativeID="totp">{t('twoFa.code_label')}</Label>
      <Input
        aria-labelledby="totp"
        value={value}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          onChange(digits);
          if (digits.length === 6) onComplete(digits);
        }}
        placeholder={t('twoFa.code_placeholder')}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        className="text-center text-2xl tracking-[8px]"
      />
    </View>
  );
}

/**
 * Sign-in 2FA, same flow as the web (/auth/2fa, /auth/2fa/setup, /auth/2fa/recovery):
 * verify a code, or set up an authenticator (open link / secret, confirm a code, save the
 * recovery code), or use the recovery code.
 */
export default function TwoFactor() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refreshMe, signOut } = useSession();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'setup' ? 'setup' : 'verify');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup state
  const [setup, setSetup] = useState<TwoFASetup | null>(null);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [saved, setSaved] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const began = useRef(false);

  useEffect(() => {
    if (mode !== 'setup' || began.current) return;
    began.current = true;
    twoFa.beginSetup().then((res) => (res.success && res.data ? setSetup(res.data) : setError(t('twoFa.setup_load_error'))));
    twoFa.status().then((res) => setSkippable(!!res.data?.setup_skippable && !!res.data?.required));
  }, [mode, t]);

  async function done() {
    await refreshMe();
    router.replace('/');
  }

  async function run(fn: () => Promise<{ success: boolean; error?: string; status?: number }>, onOk: () => void | Promise<void>, invalidKey: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.success) return onOk();
    setCode('');
    setError(res.status === 429 ? t('app.si_rate_limited') : res.status === 400 ? t(invalidKey) : res.error || t('twoFa.error_generic'));
  }

  const verify = (token: string) => run(() => twoFa.verify(token), done, 'twoFa.error_invalid');
  const secret = setup?.secret ?? '';
  const recoveryCode = setup?.recoveryCode ?? '';
  const confirmSetup = (token: string) => run(() => twoFa.completeSetup(secret, token, recoveryCode), () => setSetupStep(3), 'twoFa.error_invalid');
  const recover = () =>
    run(
      () => twoFa.recovery(code.trim()),
      async () => {
        toast.success(t('twoFa.recovery_success'));
        await done();
      },
      'twoFa.recovery_invalid',
    );

  const header = (title: string, subtitle: string) => (
    <View className="items-center gap-2 pt-6">
      <Icon as={mode === 'recovery' ? KeyRound : ShieldCheck} className="text-primary size-12" />
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="text-center">
        {subtitle}
      </Text>
    </View>
  );

  const footer = (
    <Button variant="ghost" onPress={signOut}>
      <Text>{t('app.sign_out')}</Text>
    </Button>
  );

  if (mode === 'recovery') {
    return (
      <Screen auth scroll contentContainerClassName="gap-5 p-6">
        {header(t('twoFa.recovery_title'), t('twoFa.recovery_desc'))}
        <Text className="text-warning text-center text-sm">{t('twoFa.recovery_warning')}</Text>
        <View className="gap-1.5">
          <Label nativeID="recovery">{t('twoFa.recovery_label')}</Label>
          <Input aria-labelledby="recovery" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} autoFocus />
        </View>
        <FormError message={error} />
        <Button onPress={() => (code.trim() ? recover() : setError(t('twoFa.recovery_required')))} disabled={busy}>
          <Text>{t('twoFa.recovery_btn')}</Text>
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            setMode('verify');
            setCode('');
            setError(null);
          }}>
          <Text>{t('twoFa.back')}</Text>
        </Button>
        {footer}
      </Screen>
    );
  }

  if (mode === 'verify') {
    return (
      <Screen auth scroll contentContainerClassName="gap-5 p-6">
        {header(t('twoFa.verify_title'), t('twoFa.verify_desc'))}
        <CodeInput value={code} onChange={setCode} onComplete={verify} />
        <FormError message={error} />
        <Button onPress={() => (code.length === 6 ? verify(code) : setError(t('twoFa.error_6_digits')))} disabled={busy}>
          <Text>{t('twoFa.verify_btn')}</Text>
        </Button>
        <Pressable
          onPress={() => {
            setMode('recovery');
            setCode('');
            setError(null);
          }}
          className="items-center py-2"
          accessibilityRole="button">
          <Text className="text-muted-foreground text-sm">{t('twoFa.lost_device')}</Text>
          <Text className="text-primary font-medium">{t('twoFa.use_recovery')}</Text>
        </Pressable>
        {footer}
      </Screen>
    );
  }

  // Setup
  if (!setup) {
    return (
      <Screen auth contentContainerClassName="gap-4 p-6">
        {error ? <FormError message={error} /> : <LoadingList rows={3} />}
        {footer}
      </Screen>
    );
  }

  return (
    <Screen auth scroll contentContainerClassName="gap-5 p-6">
      {header(t('twoFa.setup_title'), t(`twoFa.setup_step${setupStep}_label`))}

      {setupStep === 1 ? (
        <>
          <Text variant="muted">{t('twoFa.setup_step1_desc')}</Text>
          {/* The authenticator is usually on this same phone: open it directly instead of scanning. */}
          <Button onPress={() => Linking.openURL(setup.otpauthUrl).catch(() => toast.error(t('app.tf_no_authenticator')))}>
            <Text>{t('app.tf_open_authenticator')}</Text>
          </Button>
          <View className="items-center">
            <View className="rounded-xl bg-white p-3">
              <Image source={{ uri: setup.qrCodeDataUrl }} style={{ width: 180, height: 180 }} />
            </View>
          </View>
          <View className="gap-1.5">
            <Text className="text-muted-foreground text-sm">{t('twoFa.setup_manual_entry')}</Text>
            <View className="border-border flex-row items-center gap-2 rounded-md border p-3">
              <Text selectable className="flex-1 font-mono text-sm">
                {setup.secret}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={async () => {
                  await Clipboard.setStringAsync(setup.secret);
                  toast.success(t('app.copied'));
                }}>
                <Text>{t('twoFa.copy')}</Text>
              </Button>
            </View>
          </View>
          <Button variant="secondary" onPress={() => setSetupStep(2)}>
            <Text>{t('twoFa.setup_next')}</Text>
          </Button>
          {skippable ? (
            <Button
              variant="ghost"
              onPress={() =>
                run(
                  () => twoFa.skip(),
                  async () => {
                    toast.info(t('twoFa.skip_success'));
                    await done();
                  },
                  'twoFa.skip_error',
                )
              }>
              <Text>{t('twoFa.setup_skip')}</Text>
            </Button>
          ) : null}
        </>
      ) : null}

      {setupStep === 2 ? (
        <>
          <Text variant="muted">{t('twoFa.setup_step2_desc')}</Text>
          <CodeInput value={code} onChange={setCode} onComplete={confirmSetup} />
          <FormError message={error} />
          <Button onPress={() => (code.length === 6 ? confirmSetup(code) : setError(t('twoFa.error_6_digits')))} disabled={busy}>
            <Text>{t('twoFa.setup_verify_btn')}</Text>
          </Button>
          <Button variant="ghost" onPress={() => setSetupStep(1)}>
            <Text>{t('twoFa.back')}</Text>
          </Button>
        </>
      ) : null}

      {setupStep === 3 ? (
        <>
          <Text variant="muted">{t('twoFa.setup_step3_desc')}</Text>
          <View className="border-border flex-row items-center gap-2 rounded-md border p-3">
            <Text selectable className="flex-1 font-mono text-base">
              {setup.recoveryCode}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                await Clipboard.setStringAsync(setup.recoveryCode);
                toast.success(t('app.copied'));
              }}>
              <Text>{t('twoFa.copy')}</Text>
            </Button>
          </View>
          <Text className="text-warning text-sm">{t('twoFa.setup_step3_warning')}</Text>
          <Pressable onPress={() => setSaved((s) => !s)} className="flex-row items-center gap-3" accessibilityRole="checkbox" accessibilityState={{ checked: saved }}>
            <Checkbox checked={saved} onCheckedChange={setSaved} />
            <Text className="flex-1">{t('twoFa.setup_saved_confirm')}</Text>
          </Pressable>
          <FormError message={error} />
          <Button onPress={() => (saved ? done() : setError(t('twoFa.setup_confirm_required')))}>
            <Text>{t('app.tf_continue')}</Text>
          </Button>
        </>
      ) : null}

      {setupStep !== 3 ? footer : null}
    </Screen>
  );
}
