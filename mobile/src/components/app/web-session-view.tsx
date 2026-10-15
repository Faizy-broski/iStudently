import { openBrowserAsync } from 'expo-web-browser';
import { ExternalLink, RotateCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { FILE_BRIDGE_SCRIPT, handleBridgeMessage } from '@/components/app/web-file-bridge';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** UTF-8 → base64url without padding (what @supabase/ssr reads after its "base64-" prefix). */
function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

const MAX_CHUNK = 3180; // @supabase/ssr's cookie chunk size

/** Exact origin match (a prefix check would also accept e.g. https://istudent.ly.evil.com). */
function sameOrigin(url: string, origins: string[]) {
  if (url === 'about:blank') return true;
  try {
    const o = new URL(url).origin;
    return origins.some((x) => new URL(x).origin === o);
  } catch {
    return false;
  }
}


/** Script that appends `css` to the page once it has loaded (dashboard elements' custom CSS). */
function cssScript(css?: string | null) {
  if (!css) return undefined;
  return `(function(){try{var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}catch(e){}})(); true;`;
}

/** Reload every N minutes (dashboard elements' auto-refresh). */
function useAutoReload(minutes: number | null | undefined, reload: () => void) {
  useEffect(() => {
    if (!minutes || minutes < 1) return;
    const h = setInterval(reload, minutes * 60_000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);
}

/**
 * Script run in the web page before it loads: signs the web app in with the app's current access
 * token (cookie in @supabase/ssr's format), and stubs Supabase's logout + token-refresh calls so
 * nothing inside the WebView can end or rotate the app's own session. The refresh token is a
 * placeholder, so the web session simply lapses when the access token expires (reopen to renew).
 */
function sessionScript(cookies: { name: string; value: string }[], cookieBase: string, target: string, lang: string, campusId?: string | null) {
  return `(function(){
  try {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n.indexOf(${JSON.stringify(cookieBase)}) === 0) document.cookie = n + '=; Max-Age=0; Path=/';
    });
    ${JSON.stringify(cookies)}.forEach(function (c) {
      document.cookie = c.name + '=' + c.value + '; Path=/; Max-Age=3600; SameSite=Lax' + secure;
    });
    // Same language as the app (the website reads this cookie), and the app's selected campus
    // (the website's campus switcher keeps it in localStorage).
    document.cookie = 'studently_language=' + ${JSON.stringify(lang === 'ar' ? 'ar' : 'en')} + '; Path=/; Max-Age=31536000; SameSite=Lax' + secure;
    try {
      if (${JSON.stringify(campusId ?? '')}) localStorage.setItem('selectedCampusId', ${JSON.stringify(campusId ?? '')});
      else localStorage.removeItem('selectedCampusId');
    } catch (e) {}
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/auth/v1/logout') !== -1) return Promise.resolve(new Response(null, { status: 204 }));
      if (url.indexOf('/auth/v1/token') !== -1 && url.indexOf('refresh_token') !== -1) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'refresh disabled in app view' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
      }
      return origFetch.apply(this, arguments);
    };
    if (location.pathname.indexOf('/auth/login') === 0) location.replace(${JSON.stringify(target)});
  } catch (e) {}
})(); true;`;
}

/**
 * A page of the Studently website shown inside the app, signed in as the current user
 * (for web-only interactive tools). Navigation is kept on the website's origin.
 */
export function WebSessionView({ path, css, refreshMinutes, campusId }: { path: string; css?: string | null; refreshMinutes?: number | null; campusId?: string | null }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const lang = i18n.language;
  const [script, setScript] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const target = `${env.webUrl}${path}`;
  useAutoReload(refreshMinutes, () => setNonce((n) => n + 1));

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      const ref = new URL(env.supabaseUrl).hostname.split('.')[0];
      const base = `sb-${ref}-auth-token`;
      const value =
        'base64-' +
        base64url(
          JSON.stringify(
            s
              ? { access_token: s.access_token, refresh_token: 'app-webview', expires_at: s.expires_at, expires_in: s.expires_in, token_type: s.token_type, user: s.user }
              : null,
          ),
        );
      const cookies = value.length <= MAX_CHUNK ? [{ name: base, value }] : Array.from({ length: Math.ceil(value.length / MAX_CHUNK) }, (_, i) => ({ name: `${base}.${i}`, value: value.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK) }));
      if (alive) setScript(sessionScript(cookies, base, target, lang, campusId));
    })();
    return () => {
      alive = false;
    };
  }, [target, nonce, lang, campusId]);

  if (failed) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 p-6">
        <Text className="text-muted-foreground text-center">{t('app.wv_failed')}</Text>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            onPress={() => {
              setFailed(false);
              setNonce((n) => n + 1);
            }}>
            <Icon as={RotateCw} className="text-foreground size-4" />
            <Text>{t('app.wv_retry')}</Text>
          </Button>
          <Button variant="outline" onPress={() => openBrowserAsync(target)}>
            <Icon as={ExternalLink} className="text-foreground size-4" />
            <Text>{t('app.open_website')}</Text>
          </Button>
        </View>
      </View>
    );
  }
  if (!script) return <ActivityIndicator className="mt-10" />;

  return (
    <WebView
      key={nonce}
      source={{ uri: `${env.webUrl}/auth/login?redirect=${encodeURIComponent(path)}` }}
      injectedJavaScriptBeforeContentLoaded={`${script}\n${FILE_BRIDGE_SCRIPT}`}
      injectedJavaScript={cssScript(css)}
      onMessage={async (e) => {
        const err = await handleBridgeMessage(e);
        if (err) toast.error(t(err === 'print-failed' ? 'app.wv_print_failed' : 'app.wv_file_failed'));
      }}
      originWhitelist={[env.webUrl]}
      onShouldStartLoadWithRequest={(req) => {
        if (sameOrigin(req.url, [env.webUrl])) return true;
        openBrowserAsync(req.url);
        return false;
      }}
      onError={() => setFailed(true)}
      sharedCookiesEnabled={false}
      incognito
      startInLoadingState
      renderLoading={() => <ActivityIndicator className="absolute inset-0" />}
      allowsInlineMediaPlayback
      nestedScrollEnabled
      mediaPlaybackRequiresUserAction={false}
      style={{ flex: 1 }}
    />
  );
}

/** A public page or file (static tool, external lab, PDF) in the app, no sign-in. */
export function PublicWebView({ url, allowOrigins, css, refreshMinutes }: { url: string; allowOrigins?: string[]; css?: string | null; refreshMinutes?: number | null }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const origins = allowOrigins ?? [new URL(url).origin];
  useAutoReload(refreshMinutes, () => setNonce((n) => n + 1));
  if (failed) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 p-6">
        <Text className="text-muted-foreground text-center">{t('app.wv_failed')}</Text>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            onPress={() => {
              setFailed(false);
              setNonce((n) => n + 1);
            }}>
            <Icon as={RotateCw} className="text-foreground size-4" />
            <Text>{t('app.wv_retry')}</Text>
          </Button>
          <Button variant="outline" onPress={() => openBrowserAsync(url)}>
            <Icon as={ExternalLink} className="text-foreground size-4" />
            <Text>{t('app.wv_open_browser')}</Text>
          </Button>
        </View>
      </View>
    );
  }
  return (
    <WebView
      key={nonce}
      source={{ uri: url }}
      injectedJavaScript={cssScript(css)}
      originWhitelist={origins}
      onShouldStartLoadWithRequest={(req) => {
        if (sameOrigin(req.url, origins)) return true;
        openBrowserAsync(req.url);
        return false;
      }}
      onError={() => setFailed(true)}
      startInLoadingState
      renderLoading={() => <ActivityIndicator className="absolute inset-0" />}
      allowsInlineMediaPlayback
      nestedScrollEnabled
      mediaPlaybackRequiresUserAction={false}
      style={{ flex: 1 }}
    />
  );
}
