import { router } from 'expo-router';
import { Globe, LogOut, Palette, PanelLeft, Settings, Shapes, SlidersHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Tile, TileGrid } from '@/components/app/tile-grid';
import { useSession } from '@/features/auth/session';
import { MoreFrame, MoreHeader, OpenWebsiteCard } from '@/features/menu/more-layout';

/** "More" tab (Figma "More Menu"): onboarding, platform pages, and the shared app settings. */
export default function SuperadminMore() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <MoreFrame>
      <ScrollView contentContainerClassName="px-4 pb-8">
        <MoreHeader />
        <TileGrid>
          <Tile icon={Shapes} label={t('app.ob_title')} onPress={() => router.push('/superadmin/onboard')} />
          <Tile icon={SlidersHorizontal} label={t('app.st_title')} onPress={() => router.push('/superadmin/settings')} />
          <Tile icon={Globe} label={t('app.sa_public_pages')} onPress={() => router.push('/superadmin/public-pages')} />
          <Tile icon={PanelLeft} label={t('app.sb_title')} onPress={() => router.push('/superadmin/sidebar')} />
          <Tile icon={Palette} label={t('app.lp_title')} onPress={() => router.push('/superadmin/login-page')} />
          <Tile icon={Settings} label={t('app.set_title')} onPress={() => router.push('/settings')} />
          <Tile icon={LogOut} label={t('app.sign_out')} tone="destructive" onPress={signOut} />
        </TileGrid>
        <OpenWebsiteCard />
      </ScrollView>
    </MoreFrame>
  );
}
