import { p256 } from '@noble/curves/nist.js';
import { base64ToBytes, generateDeviceKeyPair, signDeviceRequest } from '@studently/miqat-core';
import { getRandomBytes } from 'expo-crypto';
import { Link } from 'expo-router';
import ICU from 'i18next-icu';
import { IntlMessageFormat } from 'intl-messageformat';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import i18n, { locale, setLocale } from '@/i18n';

// Sprint 1 spikes, run on a real device (Hermes). Dev builds only.
// Results go in docs/mobile/PROGRESS.md.

function icuDiagnostics(): string {
  const parts = [
    `PluralRules=${typeof Intl?.PluralRules}`,
    `NumberFormat=${typeof Intl?.NumberFormat}`,
    `i18nFormat=${String(!!(i18n as any).modules?.i18nFormat)}`,
    `ICU=${typeof ICU}`,
  ];
  try {
    parts.push(`direct=${new IntlMessageFormat('{n, plural, one {# part} other {# parts}}', 'en').format({ n: 2 })}`);
  } catch (e) {
    parts.push(`direct ERROR ${(e as Error).message}`);
  }
  return parts.join(' ');
}

function runSigningSpike(): string {
  const started = Date.now();
  const kp = generateDeviceKeyPair(getRandomBytes);
  const { timestamp, signature } = signDeviceRequest('bootstrap', 'spike-device', kp.secretKeyB64);
  const pem = kp.publicKeyPem.replace(/-----[A-Z ]+-----|\n/g, '');
  const point = base64ToBytes(pem).slice(26);
  const ok = p256.verify(base64ToBytes(signature), new TextEncoder().encode(`bootstrap:spike-device:${timestamp}`), point, {
    prehash: true,
    format: 'compact',
    lowS: false,
  });
  return `${ok ? 'PASS' : 'FAIL'} in ${Date.now() - started} ms (sig ${base64ToBytes(signature).length} bytes)`;
}

export default function Dev() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [signing, setSigning] = useState<string>('not run');

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <ThemedText type="smallBold">a) Device signing (Hermes, @noble/curves)</ThemedText>
      <Pressable onPress={() => setSigning(runSigningSpike())} accessibilityRole="button">
        <ThemedText type="link">Run</ThemedText>
      </Pressable>
      <ThemedText>{signing}</ThemedText>

      <ThemedText type="smallBold">b) i18n + RTL</ThemedText>
      <ThemedText>
        locale={locale} isRTL={String(I18nManager.isRTL)}
      </ThemedText>
      <ThemedText type="small">{icuDiagnostics()}</ThemedText>
      <ThemedText>{t('login.heading')}</ThemedText>
      {[0, 1, 2, 3, 11, 100].map((n) => (
        <ThemedText key={n}>{t('common.count_parts', { count: n })}</ThemedText>
      ))}
      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText>start</ThemedText>
        <ThemedText>end</ThemedText>
      </View>
      <Pressable onPress={() => setLocale(locale === 'ar' ? 'en' : 'ar')} accessibilityRole="button">
        <ThemedText type="link">Switch to {locale === 'ar' ? 'English' : 'العربية'} (reloads)</ThemedText>
      </Pressable>

      <Link href="/gallery">
        <ThemedText type="link">Component gallery</ThemedText>
      </Link>

      <ThemedText type="smallBold">Role groups</ThemedText>
      {(['student', 'parent', 'teacher', 'librarian', 'inspector', 'scanner', 'superadmin'] as const).map((g) => (
        <Link key={g} href={`/${g}`}>
          <ThemedText type="link">/{g}</ThemedText>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.two, borderRadius: 8 },
});
