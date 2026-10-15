import { DEFAULT_LOGIN_PAGE_CONFIG, type GlobalPage } from '@studently/api-client';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronRight, ExternalLink, Eye, EyeOff, Languages } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FormError } from '@/components/app/form';
import { Screen } from '@/components/app/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession, type SignInResult } from '@/features/auth/session';
import { locale, setLocale } from '@/i18n';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const ERROR_TEXT: Record<Exclude<SignInResult, { ok: true }>['error'], string> = {
  invalid: 'auth.invalidCredentials',
  not_found: 'auth.invalidCredentials',
  rate_limited: 'app.si_rate_limited',
  network: 'app.si_network',
  other: 'login.contact_admin',
};

export default function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  // Same public config the web login page uses (logo, title); falls back to the app's own.
  const configRes = useApi(['public', 'login-page'], () => platform.getLoginPageConfig(), { shouldRetryOnError: false });
  const quote = useApi(['public', 'login-quote'], () => platform.getCurrentQuote(), { shouldRetryOnError: false });
  const links = useApi(['public', 'login-links'], () => platform.getLoginLinks(), { shouldRetryOnError: false });
  const [aboutOpen, setAboutOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const ar = locale === 'ar';
  const c = { ...DEFAULT_LOGIN_PAGE_CONFIG, ...(configRes.data ?? {}) };
  const title = (ar ? c.title_ar : c.title_en) || t('login.title');
  const subtitle = (ar ? c.subtitle_ar : c.subtitle_en) || t('login.subtitle');
  const heading = (ar ? c.heading_ar : c.heading_en) || t('login.heading');
  // Branding text color is set for the web's white side; in dark mode keep the theme's text color.
  const brandColor = colorScheme === 'dark' ? undefined : c.text_color_left;
  const formColor = c.text_color_right;
  const quoteText = (ar ? quote.data?.text_ar : quote.data?.text_en)?.trim();
  const pages = links.data ?? [];
  const canSubmit = identifier.trim().length > 0 && password.trim().length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    // Spaces are never part of an email/username; leading/trailing spaces in the password come from autofill or paste.
    const res = await signIn(identifier.trim(), password.trim());
    setBusy(false);
    if (res.ok) return;
    const text = t(ERROR_TEXT[res.error]);
    // Dev builds show Supabase's code so sign-in problems are diagnosable.
    setError(__DEV__ && res.code ? `${text} (${res.code})` : text);
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll padded={false} edges={['top']} contentContainerClassName="min-h-full gap-6 pb-0 pt-6">
        {/* Branding (web: left side): title, subtitle, logo and the login quote. */}
        <View className="items-center gap-3 px-6">
          <Text variant="h3" className="text-center" style={brandColor ? { color: brandColor } : undefined}>
            {title}
          </Text>
          <Text variant="muted" className="text-center" style={brandColor ? { color: brandColor, opacity: 0.7 } : undefined}>
            {subtitle}
          </Text>
          <Image
            source={c.logo_url ? { uri: c.logo_url } : require('@/assets/images/icon.png')}
            style={{ width: 112, height: 112, borderRadius: c.logo_url ? 0 : 24 }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          {quoteText ? (
            <View className="border-border bg-card w-full rounded-2xl border border-s-4 border-s-[#57A3CC] p-4">
              <Text className="text-muted-foreground text-4xl leading-8">{ar ? '”' : '“'}</Text>
              <Text className={ar ? 'text-base' : 'text-base italic'}>{quoteText}</Text>
            </View>
          ) : null}
        </View>

        {/* Form (web: right side) on the configured background. */}
        <View className="flex-1 overflow-hidden rounded-t-3xl px-6 pb-12 pt-8" style={{ backgroundColor: c.background_type === 'color' ? c.background_color : undefined }}>
          <LoginBackground config={c} />
          <Text variant="h3" className="mb-6" style={{ color: formColor }}>
            {heading}
          </Text>
        <View className="gap-4">
          <View className="gap-1.5">
            <Label nativeID="identifier" style={{ color: formColor }}>
              {t('login.label_email_or_username')}
            </Label>
            <Input
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
            <View className="flex-row items-center justify-between">
              <Label nativeID="password" style={{ color: formColor }}>
                {t('login.label_password')}
              </Label>
              <Link href="/forgot-password" asChild>
                <Pressable hitSlop={8} accessibilityRole="link">
                  <Text className="text-sm font-medium underline" style={{ color: formColor }}>
                    {t('auth.forgotPassword')}
                  </Text>
                </Pressable>
              </Link>
            </View>
            <View className="justify-center">
              <Input
                ref={passwordRef}
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
                className="pe-11"
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                className="absolute end-3"
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('app.si_hide_password') : t('app.si_show_password')}>
                <Icon as={showPassword ? EyeOff : Eye} className="text-muted-foreground size-5" />
              </Pressable>
            </View>
          </View>

          <FormError message={error} solid />

          {/* Same as the web: solid white button with brand-blue text, readable on any background. */}
          <Button onPress={onSubmit} disabled={!canSubmit} className={cn('h-12 bg-white shadow-lg active:bg-white/90', busy ? 'opacity-70' : 'opacity-100')}>
            <Text className="text-lg font-bold text-[#022172]">{busy ? t('app.si_signing_in') : t('login.btn_sign_in')}</Text>
          </Button>
        </View>

          <Text className="mt-4 text-center text-sm" style={{ color: formColor, opacity: 0.7 }}>
            {t('login.contact_admin')}
          </Text>

          {/* Web "About": the super admin's public pages (links open in the browser, others in the app). */}
          {pages.length ? (
            <View className="mt-4 gap-2">
              <Pressable onPress={() => setAboutOpen((o) => !o)} className="flex-row items-center gap-1.5 self-start" hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: aboutOpen }}>
                <Icon as={ChevronRight} className={aboutOpen ? 'size-4 rotate-90' : 'size-4 rtl:rotate-180'} color={formColor} />
                <Text className="text-sm font-medium" style={{ color: formColor, opacity: 0.8 }}>
                  {t('app.si_about')}
                </Text>
              </Pressable>
              {aboutOpen ? (
                <View className="gap-2 border-s border-white/30 ps-4">
                  {pages.map((p) => (
                    <AboutLink key={p.id} page={p} color={formColor} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="mt-6 items-center gap-2">
            <Button variant="ghost" size="sm" onPress={() => setLocale(ar ? 'en' : 'ar')}>
              <Icon as={Languages} className="size-4" color={formColor} />
              <Text style={{ color: formColor }}>{ar ? 'English' : 'العربية'}</Text>
            </Button>
            {__DEV__ ? (
              <Button variant="link" size="sm" onPress={() => router.push('/dev')}>
                <Text style={{ color: formColor }}>Dev tools</Text>
              </Button>
            ) : null}
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Web login background: gradient (default), plain color, or an image dimmed by (1 - opacity). */
function LoginBackground({ config: c }: { config: typeof DEFAULT_LOGIN_PAGE_CONFIG }) {
  if (c.background_type === 'color') return null;
  if (c.background_type === 'image' && c.background_image_url) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={{ uri: c.background_image_url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: 1 - (c.background_image_opacity ?? 1) }]} />
      </View>
    );
  }
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="loginBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.gradient_from} />
          <Stop offset="1" stopColor={c.gradient_to} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#loginBg)" />
    </Svg>
  );
}

function AboutLink({ page, color }: { page: GlobalPage; color: string }) {
  const external = page.page_type === 'url' || !page.page_type;
  const url = page.url ?? null;
  return (
    <Pressable
      onPress={() => (external ? url && WebBrowser.openBrowserAsync(url) : router.push({ pathname: '/about-page', params: { id: page.id } }))}
      className="flex-row items-center gap-2"
      hitSlop={6}
      accessibilityRole={external ? 'link' : 'button'}>
      <Icon as={external ? ExternalLink : ChevronRight} className="size-3.5 rtl:rotate-180" color={color} opacity={0.6} />
      <Text className="text-sm" style={{ color, opacity: 0.85 }}>
        {page.title}
      </Text>
    </Pressable>
  );
}
