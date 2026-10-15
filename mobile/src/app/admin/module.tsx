import { ADMIN_GROUP_WAVE, ADMIN_MENU } from '@studently/shared-types';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Smartphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { env } from '@/lib/env';

/** A web admin page that has no native screen yet: say when it comes, and open it on the website. */
export default function AdminModule() {
  const { t } = useTranslation();
  const toast = useToast();
  const { href, title } = useLocalSearchParams<{ href: string; title?: string }>();
  const group = ADMIN_MENU.find((g) => g.href === href || g.items.some((i) => i.href === href));
  const wave = group ? ADMIN_GROUP_WAVE[group.title] : undefined;
  const name = t(`sidebar.${title ?? ''}`, { defaultValue: (title ?? '').replace(/_/g, ' ') });
  // Only our own website's admin paths are opened.
  const url = href?.startsWith('/admin') ? `${env.webUrl}${href}` : null;

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <Screen contentContainerClassName="flex-1 items-center justify-center gap-4 p-6">
        <Icon as={Smartphone} className="text-muted-foreground size-12" />
        <Text variant="h4" className="text-center">
          {t('app.ad_soon_title', { name })}
        </Text>
        <Text variant="muted" className="text-center">
          {wave ? t('app.ad_soon_wave', { wave }) : t('app.ad_soon_body')}
        </Text>
        {url ? (
          <Button className="self-stretch" onPress={() => WebBrowser.openBrowserAsync(url).catch(() => toast.error(t('app.error_title')))}>
            <Icon as={ExternalLink} className="text-primary-foreground size-4" />
            <Text>{t('app.ad_open_web')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
