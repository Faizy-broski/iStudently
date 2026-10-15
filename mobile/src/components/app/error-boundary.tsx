import { type ErrorBoundaryProps, router, usePathname } from 'expo-router';
import { AlertTriangle, Home, RotateCw } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { reportError } from '@/lib/monitoring';

/** Shown instead of a blank screen when a screen crashes: report it, offer retry and home. Exported as `ErrorBoundary` from layouts. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const route = usePathname();
  useEffect(() => {
    reportError(error, { context: 'error-boundary', route });
  }, [error, route]);
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <View className="bg-destructive/10 rounded-full p-4">
          <Icon as={AlertTriangle} className="text-destructive size-8" />
        </View>
        <Text className="text-center text-lg font-semibold">{t('app.crash_title')}</Text>
        <Text className="text-muted-foreground text-center">{t('app.crash_body')}</Text>
        {__DEV__ ? <Text className="text-muted-foreground text-center text-xs">{error.message}</Text> : null}
        <View className="flex-row gap-2">
          <Button onPress={retry}>
            <Icon as={RotateCw} className="text-primary-foreground size-4" />
            <Text>{t('app.retry')}</Text>
          </Button>
          <Button variant="outline" onPress={() => router.replace('/')}>
            <Icon as={Home} className="size-4" />
            <Text>{t('app.crash_home')}</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
