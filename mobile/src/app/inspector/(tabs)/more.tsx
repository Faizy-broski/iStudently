import { router } from 'expo-router';
import { BookOpenCheck, FileText, LogOut, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Tile, TileGrid } from '@/components/app/tile-grid';
import { useSession } from '@/features/auth/session';
import { MoreFrame, MoreHeader, OpenWebsiteCard } from '@/features/menu/more-layout';

/** The rest of the inspector sidebar (reports, Hifzi compliance) and the app settings (Figma "More Menu"). */
export default function InspectorMore() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <MoreFrame>
      <ScrollView contentContainerClassName="px-4 pb-8">
        <MoreHeader />
        <TileGrid>
          <Tile icon={FileText} label={t('sidebar.reports')} onPress={() => router.push('/inspector/reports')} />
          <Tile icon={BookOpenCheck} label={t('sidebar.hifzi_compliance')} onPress={() => router.push('/inspector/hifzi-compliance')} />
          <Tile icon={Settings} label={t('app.set_title')} onPress={() => router.push('/settings')} />
          <Tile icon={LogOut} label={t('app.sign_out')} tone="destructive" onPress={signOut} />
        </TileGrid>
        <OpenWebsiteCard />
      </ScrollView>
    </MoreFrame>
  );
}
