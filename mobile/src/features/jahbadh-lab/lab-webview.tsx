import { openBrowserAsync } from 'expo-web-browser';
import { ExternalLink, RotateCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { LAB_BASE } from './catalog';
import { isInsideLab, isLabHome, type LabLang } from './model';

const isHttp = (url: string) => /^https?:\/\//i.test(url);

/**
 * One lab experiment (a self-contained HTML file from /lab/) in a locked-down WebView:
 *  - it can only navigate inside the lab folder; any other http(s) link opens in the system browser,
 *    every other scheme (javascript:, intent:, file:, data: …) is dropped;
 *  - the lab's own "all experiments" link (index.html) is replaced by `onHome` (back to the app's catalog);
 *  - no file access, no mixed content, no session cookies; the page can't reach the app's own session.
 * The page keeps its language in localStorage 'jlab-lang' on the lab's origin: we set it before it loads.
 */
export function LabWebView({ url, lang, nonce, onHome, onFailed }: { url: string; lang: LabLang; nonce: number; onHome: () => void; onFailed?: () => void }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fail = () => {
    setFailed(true);
    onFailed?.();
  };

  if (failed) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 p-6">
        <Text className="text-muted-foreground text-center">{t('app.jl_player_failed')}</Text>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}>
            <Icon as={RotateCw} className="text-foreground size-4" />
            <Text>{t('app.wv_retry')}</Text>
          </Button>
          <Button variant="outline" onPress={() => openBrowserAsync(url)}>
            <Icon as={ExternalLink} className="text-foreground size-4" />
            <Text>{t('app.jl_open_browser')}</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <WebView
      key={`${nonce}-${attempt}`}
      source={{ uri: url }}
      injectedJavaScriptBeforeContentLoaded={`try{localStorage.setItem('jlab-lang',${JSON.stringify(lang)})}catch(e){} true;`}
      originWhitelist={[new URL(LAB_BASE).origin]}
      onShouldStartLoadWithRequest={(req) => {
        if (isLabHome(req.url, LAB_BASE)) {
          onHome();
          return false;
        }
        if (isInsideLab(req.url, LAB_BASE)) return true;
        if (isHttp(req.url)) openBrowserAsync(req.url);
        return false;
      }}
      onOpenWindow={(e) => {
        const target = e.nativeEvent.targetUrl;
        if (isHttp(target) && !isInsideLab(target, LAB_BASE)) openBrowserAsync(target);
      }}
      onError={fail}
      onHttpError={(e) => {
        if (e.nativeEvent.statusCode >= 400) fail();
      }}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      startInLoadingState
      renderLoading={() => <ActivityIndicator className="absolute inset-0" />}
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      style={{ flex: 1 }}
    />
  );
}
