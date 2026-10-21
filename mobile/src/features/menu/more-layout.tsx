import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Globe, LogOut, Search, Settings, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { raised, Tile, TileGrid } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { colors } from '@/lib/colors';
import { env } from '@/lib/env';

// "More Menu" screen pieces (Figma), shared by every role.

/** Page frame: light background with the logo shape, safe area top. */
export function MoreFrame({ children }: { children: ReactNode }) {
  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        {children}
      </SafeAreaView>
    </AuthBackground>
  );
}

/** Title, the role's top card (campus or profile) and an optional search. */
export function MoreHeader({ top, search, title }: { top?: ReactNode; search?: { value: string; onChange: (v: string) => void; placeholder: string }; title?: string }) {
  const { t } = useTranslation();
  // Search stays out of the way (Figma has none) until the 🔍 button is tapped.
  const [searching, setSearching] = useState(false);
  const showSearch = !!search && (searching || !!search.value);
  return (
    <View className="gap-4 pb-4 pt-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-brand dark:text-foreground text-2xl font-bold">{title ?? t('app.more_title')}</Text>
        {search ? (
          <Pressable
            onPress={() => {
              if (showSearch) search.onChange('');
              setSearching(!showSearch);
            }}
            style={raised(colors.brand)}
            className="border-info-soft dark:border-border bg-card size-10 items-center justify-center rounded-full border"
            accessibilityRole="button"
            accessibilityLabel={search.placeholder}>
            <Icon as={showSearch ? X : Search} className="text-brand dark:text-brand-secondary size-4" />
          </Pressable>
        ) : null}
      </View>
      {top ?? <ProfileCard />}
      {showSearch ? <SearchBar value={search.value} onChangeText={search.onChange} placeholder={search.placeholder} autoFocus /> : null}
    </View>
  );
}

/** Settings and Sign out as tiles for the end of the More grid (an array, so the grid lays them out). */
export function useAccountTiles() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return [
    <Tile key="settings" icon={Settings} label={t('app.set_title')} onPress={() => router.push('/settings')} />,
    <Tile key="signout" icon={LogOut} label={t('app.sign_out')} tone="destructive" onPress={signOut} />,
  ];
}

/** Signed-in person: photo, name, email; opens the app settings. */
export function ProfileCard() {
  const { t } = useTranslation();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  if (!profile) return null;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  return (
    <Pressable onPress={() => router.push('/settings')} style={raised(colors.brand)}
      className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-80" accessibilityRole="button">
      <PersonAvatar url={profile.profile_photo_url || profile.avatar_url} name={name} size={44} />
      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {profile.email ?? t(`app.role_${profile.role}`)}
        </Text>
      </View>
      <Icon as={Settings} className="text-brand-secondary size-5" />
    </Pressable>
  );
}

/** "Open on website · Full admin tools on desktop". */
export function OpenWebsiteCard() {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(env.webUrl)} style={raised(colors.brand)}
      className="border-info-soft dark:border-border bg-card mt-2.5 flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-80" accessibilityRole="link">
      <Icon as={Globe} className="text-brand dark:text-brand-secondary size-5" />
      <View className="flex-1">
        <Text className="font-semibold">{t('app.more_web')}</Text>
        <Text variant="muted" className="text-xs">
          {t('app.more_web_body')}
        </Text>
      </View>
      <Icon as={ExternalLink} className="text-muted-foreground size-4" />
    </Pressable>
  );
}

/** Account section: app settings and sign out. */
export function AccountTiles({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <View className="mt-5 gap-2.5">
      <Text className="text-muted-foreground text-sm font-semibold">{t('app.more_account')}</Text>
      <TileGrid>
        {extra}
        <Tile icon={Settings} label={t('app.set_title')} onPress={() => router.push('/settings')} />
        <Tile icon={LogOut} label={t('app.sign_out')} tone="destructive" onPress={signOut} />
      </TileGrid>
    </View>
  );
}
