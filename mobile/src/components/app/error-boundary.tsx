import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { type ErrorBoundaryProps, usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { RotateCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppConfig } from '@/features/app-config/app-config';
import { reportError } from '@/lib/monitoring';

/** Short code shown to the user and sent with the crash report, so support can find it. */
const newRef = () => `STU-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * Shown instead of a blank screen when a screen crashes (Figma "Error screen"): illustration,
 * message, error reference, Restart App and Report this issue. Exported as `ErrorBoundary` from layouts.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const route = usePathname();
  const config = useAppConfig();
  const [ref] = useState(newRef);
  const supportEmail = config?.links?.support_email ?? null;

  useEffect(() => {
    reportError(error, { context: 'error-boundary', route, ref });
  }, [error, route, ref]);

  async function restart() {
    // A full reload in release builds; development builds just re-render the screen.
    try {
      if (__DEV__) throw new Error('dev');
      await Updates.reloadAsync();
    } catch {
      retry();
    }
  }

  function report() {
    if (!supportEmail) return;
    const subject = encodeURIComponent(t('app.crash_mail_subject', { ref }));
    const body = encodeURIComponent(`${t('app.crash_mail_body')}\n\n${t('app.crash_ref', { ref })}\nApp ${Constants.expoConfig?.version ?? ''}\n${route}`);
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}&body=${body}`).catch(() => {});
  }

  return (
    <AuthBackground>
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Image source={require('@/assets/images/error.png')} style={{ width: 150, height: 150 }} contentFit="contain" accessibilityIgnoresInvertColors />
          <Text className="text-brand dark:text-foreground text-center text-2xl font-bold">{t('app.crash_title')}</Text>
          <Text variant="muted" className="text-center">
            {t('app.crash_body')}
          </Text>
          {__DEV__ ? <Text className="text-muted-foreground text-center text-xs">{error.message}</Text> : null}
          <View className="border-border bg-card rounded-full border px-3 py-1">
            <Text className="text-muted-foreground text-xs" selectable>
              {t('app.crash_ref', { ref })}
            </Text>
          </View>
          <Button size="lg" className="mt-2 self-stretch" onPress={restart}>
            <Icon as={RotateCw} className="size-4 text-white" />
            <Text>{t('app.crash_restart')}</Text>
          </Button>
          {supportEmail ? (
            <Pressable onPress={report} hitSlop={8} accessibilityRole="link">
              <Text className="text-brand-secondary text-sm font-medium">{t('app.crash_report')}</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </AuthBackground>
  );
}
