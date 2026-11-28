import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ExternalLink, Maximize2, Minimize2, RotateCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, View } from 'react-native';

import { HeaderButton } from '@/components/app/layout';
import { EmptyState } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';

import { LAB_BASE, useLabCatalog } from './catalog';
import type { LabRole } from './catalog-screen';
import { LabWebView } from './lab-webview';
import { experimentUrl, LAB_CODE_RE, labName } from './model';
import { useLabLang, useLabLists } from './store';

/**
 * One Jahbadh Lab experiment (web: /<role>/resources/jahbadh-lab/<code>), full screen in a WebView.
 * The orientation of the app is portrait-only, so "full screen" hides the header instead of rotating.
 */
export function JahbadhLabPlayer({ role }: { role: LabRole }) {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' && LAB_CODE_RE.test(params.code) ? params.code : null;
  const catalog = useLabCatalog();
  const [lang] = useLabLang(i18n.language);
  const { markOpened } = useLabLists();
  const [nonce, setNonce] = useState(0);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    if (code) markOpened(code);
  }, [code, markOpened]);

  // Android back leaves full screen first, then the experiment.
  useEffect(() => {
    if (!immersive) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setImmersive(false);
      return true;
    });
    return () => sub.remove();
  }, [immersive]);

  if (!code) return <EmptyState title={t('app.jl_unknown')} />;

  const list = catalog.data ? catalog.data.experiments : null;
  const exp = list ? list.find((e) => e.code === code) : undefined;
  const title = exp ? labName(exp, lang, code) : code;
  const url = experimentUrl(LAB_BASE, code, lang);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title,
          headerShown: !immersive,
          headerRight: () => (
            <View className="flex-row items-center">
              <HeaderButton icon={Maximize2} label={t('app.jl_fullscreen')} onPress={() => setImmersive(true)} />
              <HeaderButton icon={RotateCw} label={t('app.jl_reload')} onPress={() => setNonce((n) => n + 1)} />
              <HeaderButton icon={ExternalLink} label={t('app.jl_open_browser')} onPress={() => openBrowserAsync(url)} />
            </View>
          ),
        }}
      />
      <LabWebView url={url} lang={lang} nonce={nonce} onHome={() => (router.canGoBack() ? router.back() : router.replace(`/${role}/jahbadh-lab` as Href))} />
      {immersive ? (
        <Pressable
          onPress={() => setImmersive(false)}
          accessibilityRole="button"
          accessibilityLabel={t('app.jl_exit_fullscreen')}
          hitSlop={8}
          className="bg-foreground/60 absolute end-3 top-3 rounded-full p-2.5 active:opacity-70">
          <Icon as={Minimize2} className="text-background size-5" />
        </Pressable>
      ) : null}
    </View>
  );
}
