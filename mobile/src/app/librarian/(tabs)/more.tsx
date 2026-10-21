import { router } from 'expo-router';
import { Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tile } from '@/components/app/tile-grid';
import { MoreFrame, MoreHeader, OpenWebsiteCard, useAccountTiles } from '@/features/menu/more-layout';
import { PortalModuleList } from '@/features/portal/portal-module-list';

const ON_TABS = new Set(['dashboard', 'books', 'loan_directory']);

/** Every other librarian page (tile grid), search, and the app settings. (Figma "More Menu") */
export default function LibrarianMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const accountTiles = useAccountTiles();
  const settings = <Tile key="library-settings" icon={Settings2} label={t('library_settings.title')} onPress={() => router.push('/librarian/library-settings')} />;
  return (
    <MoreFrame>
      <PortalModuleList
        role="librarian"
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title)}
        header={<MoreHeader search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }} />}
        groupTiles
        extraTiles={[settings, ...accountTiles]}
        footer={query ? undefined : <OpenWebsiteCard />}
      />
    </MoreFrame>
  );
}
