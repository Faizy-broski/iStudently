import type { GlobalPage } from '@studently/api-client';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronRight, ExternalLink, Eye, EyeOff, Languages, Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { FormError } from '@/components/app/form';
import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { loginPageDefaults } from '@/features/auth/login-page-defaults';
import { getRememberedIdentifier, setRememberedIdentifier } from '@/features/auth/remember-identifier';
import { useSession, type SignInResult } from '@/features/auth/session';
import { locale, setLocale } from '@/i18n';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';

const ERROR_TEXT: Record<Exclude<SignInResult, { ok: true }>['error'], string> = {
  invalid: 'auth.invalidCredentials',
  not_found: 'auth.invalidCredentials',
  rate_limited: 'app.si_rate_limited',
  network: 'app.si_network',
  other: 'login.contact_admin',
};

/**
 * Sign in (Figma "Login"): light background with the logo shape, logo, heading, fields with icons,
 * remember me, gradient Sign In. Content (logo, title, subtitle, heading, quote, About pages) comes
 * from the super admin's Login page settings, like the web.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const configRes = useApi(['public', 'login-page'], () => platform.getLoginPageConfig(), { shouldRetryOnError: false });
  const quote = useApi(['public', 'login-quote'], () => platform.getCurrentQuote(), { shouldRetryOnError: false });
  const links = useApi(['public', 'login-links'], () => platform.getLoginLinks(), { shouldRetryOnError: false });
  const [aboutOpen, setAboutOpen] = useState(false);
  const [identifier, setIdentifier] = useState(getRememberedIdentifier);
  const [remember, setRemember] = useState(() => getRememberedIdentifier() !== '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const ar = locale === 'ar';
  const c = { ...loginPageDefaults(), ...(configRes.data ?? {}) };
  const title = (ar ? c.title_ar : c.title_en) || t('login.title');
  const subtitle = (ar ? c.subtitle_ar : c.subtitle_en) || t('login.subtitle');
  const heading = (ar ? c.heading_ar : c.heading_en) || t('login.heading');
  const quoteText = (ar ? quote.data?.text_ar : quote.data?.text_en)?.trim();
  const pages = links.data ?? [];

  async function onSubmit() {
    if (busy) return;
    // The button stays full strength (Figma); empty fields get a message instead of a disabled look.
    if (!identifier.trim() || !password.trim()) return setError(t('common.fill_required_fields'));
    setBusy(true);
    setError(null);
    // Spaces are never part of an email/username; leading/trailing spaces in the password come from autofill or paste.
    const res = await signIn(identifier.trim(), password.trim());
    setBusy(false);
    if (res.ok) return setRememberedIdentifier(remember ? identifier.trim() : null);
    const text = t(ERROR_TEXT[res.error]);
    // Dev builds show Supabase's code so sign-in problems are diagnosable.
    setError(__DEV__ && res.code ? `${text} (${res.code})` : text);
  }

  return (
    <AuthBackground>
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView className="flex-1">
          <ScrollView contentContainerClassName="grow justify-center gap-6 px-6 py-8">
            {/* Logo, title, heading, subtitle */}
            <View className="items-center gap-2">
              <Image
                source={c.logo_url ? { uri: c.logo_url } : require('@/assets/images/icon.png')}
                style={{ width: 72, height: 72, borderRadius: c.logo_url ? 0 : 18 }}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
              <Text className="text-brand-secondary mt-2 text-xs font-semibold uppercase tracking-widest">{title}</Text>
              <Text className="text-foreground text-center text-3xl font-bold">{heading}</Text>
              <Text variant="muted" className="text-center">
                {subtitle}
              </Text>
            </View>

            {quoteText ? (
              <View className="border-border bg-card/80 border-s-brand-secondary rounded-2xl border border-s-4 px-4 py-3">
                <Text className={ar ? 'text-sm' : 'text-sm italic'}>{quoteText}</Text>
              </View>
            ) : null}

            {/* Form */}
            <View className="gap-4">
              <View className="gap-1.5">
                <Label nativeID="identifier">{t('login.label_email_or_username')}</Label>
                <Input
                  icon={Mail}
                  aria-labelledby="identifier"
                  value={identifier}
                  onChangeText={(v) => setIdentifier(v.replace(/\s/g, ''))}
                  placeholder={t('login.placeholder_email_or_username')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                />
              </View>
              <View className="gap-1.5">
                <Label nativeID="password">{t('login.label_password')}</Label>
                <View className="justify-center">
                  <Input
                    ref={passwordRef}
                    icon={Lock}
                    aria-labelledby="password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                    className="pe-12"
                  />
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    hitSlop={8}
                    className="absolute end-4"
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t('app.si_hide_password') : t('app.si_show_password')}>
                    <Icon as={showPassword ? EyeOff : Eye} className="text-muted-foreground size-5" />
                  </Pressable>
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setRemember((r) => !r)} className="flex-row items-center gap-2" hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
                  <Checkbox checked={remember} onCheckedChange={setRemember} />
                  <Text className="text-sm">{t('login.remember_me')}</Text>
                </Pressable>
                <Link href="/forgot-password" asChild>
                  <Pressable hitSlop={8} accessibilityRole="link">
                    <Text className="text-brand-secondary text-sm font-medium">{t('auth.forgotPassword')}</Text>
                  </Pressable>
                </Link>
              </View>

              <FormError message={error} />

              <Button size="lg" onPress={onSubmit} className={busy ? 'opacity-70' : undefined}>
                <Text>{busy ? t('app.si_signing_in') : t('login.btn_sign_in')}</Text>
              </Button>
            </View>

            <Text variant="muted" className="text-center text-sm">
              {t('login.contact_admin')}
            </Text>

            {/* Web "About": the super admin's public pages (links open in the browser, others in the app). */}
            {pages.length ? (
              <View className="items-center gap-2">
                <Pressable onPress={() => setAboutOpen((o) => !o)} className="flex-row items-center gap-1.5" hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }}>
                  <Icon as={ChevronRight} flipRtl className={aboutOpen ? 'text-brand-secondary size-4 rotate-90' : 'text-brand-secondary size-4'} />
                  <Text className="text-brand-secondary text-sm font-medium">{t('app.si_about')}</Text>
                </Pressable>
                {aboutOpen ? (
                  <View className="gap-2 self-stretch">
                    {pages.map((p) => (
                      <AboutLink key={p.id} page={p} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="items-center gap-1">
              <Button variant="ghost" size="sm" onPress={() => setLocale(ar ? 'en' : 'ar')}>
                <Icon as={Languages} className="size-4" />
                <Text>{ar ? 'English' : 'العربية'}</Text>
              </Button>
              {__DEV__ ? (
                <Button variant="link" size="sm" onPress={() => router.push('/dev')}>
                  <Text>Dev tools</Text>
                </Button>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

function AboutLink({ page }: { page: GlobalPage }) {
  const external = page.page_type === 'url' || !page.page_type;
  const url = page.url ?? null;
  return (
    <Pressable
      onPress={() => (external ? url && WebBrowser.openBrowserAsync(url) : router.push({ pathname: '/about-page', params: { id: page.id } }))}
      className="border-border bg-card/80 flex-row items-center gap-2 rounded-full border px-4 py-3"
      accessibilityRole={external ? 'link' : 'button'}>
      <Icon as={external ? ExternalLink : ChevronRight} flipRtl className="text-muted-foreground size-4" />
      <Text className="flex-1 text-sm">{page.title}</Text>
    </Pressable>
  );
}
