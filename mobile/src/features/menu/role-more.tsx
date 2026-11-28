import { router } from 'expo-router';
import { LogOut, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/app/keyboard';
import { Tile, TileGrid } from '@/components/app/tile-grid';
import { useSession } from '@/features/auth/session';
import { MoreFrame, MoreHeader, OpenWebsiteCard } from '@/features/menu/more-layout';

/** "More" for roles whose sidebar is fully covered by the tabs: settings, sign out, website. */
export function RoleMore() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <MoreFrame>
      <ScrollView contentContainerClassName="px-4 pb-8">
        <MoreHeader />
        <TileGrid>
          <Tile icon={Settings} label={t('app.set_title')} onPress={() => router.push('/settings')} />
          <Tile icon={LogOut} label={t('app.sign_out')} tone="destructive" onPress={signOut} />
        </TileGrid>
        <OpenWebsiteCard />
      </ScrollView>
    </MoreFrame>
  );
}
