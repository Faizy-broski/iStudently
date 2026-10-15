import { Globe, LogOut, Palette, PanelLeft, Settings, Shapes, UserCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';

// "More" tab: onboarding, platform pages, and the shared app settings (language, theme, lock, password).
export default function SuperadminMore() {
  const { t } = useTranslation();
  const { me, signOut } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="pb-8">
      {profile ? (
        <View className="gap-1 p-4">
          <Text variant="large">{[profile.first_name, profile.last_name].filter(Boolean).join(' ')}</Text>
          <Text variant="muted">{profile.email}</Text>
        </View>
      ) : null}
      <Separator />
      <ListRow title={t('app.ob_title')} leading={<Icon as={Shapes} className="text-muted-foreground size-5" />} onPress={() => router.push('/superadmin/onboard')} />
      <Separator />
      <ListRow title={t('app.st_title')} leading={<Icon as={Settings} className="text-muted-foreground size-5" />} onPress={() => router.push('/superadmin/settings')} />
      <Separator />
      <ListRow title={t('app.pp_title')} leading={<Icon as={Globe} className="text-muted-foreground size-5" />} onPress={() => router.push('/superadmin/public-pages')} />
      <Separator />
      <ListRow title={t('app.sb_title')} leading={<Icon as={PanelLeft} className="text-muted-foreground size-5" />} onPress={() => router.push('/superadmin/sidebar')} />
      <Separator />
      <ListRow title={t('app.lp_title')} leading={<Icon as={Palette} className="text-muted-foreground size-5" />} onPress={() => router.push('/superadmin/login-page')} />
      <Separator />
      <ListRow title={t('app.set_title')} leading={<Icon as={UserCircle} className="text-muted-foreground size-5" />} onPress={() => router.push('/settings')} />
      <Separator />
      <ListRow title={t('app.sign_out')} leading={<Icon as={LogOut} className="text-destructive size-5" />} onPress={signOut} chevron={false} />
      <Separator />
    </ScrollView>
  );
}
