import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MoreFrame, MoreHeader, OpenWebsiteCard, useAccountTiles, ProfileCard } from '@/features/menu/more-layout';
import { ChildSwitcher } from '@/features/parent/child';
import { PARENT_TAB_GROUPS } from '@/features/portal/parent-tabs';
import { PortalModuleList } from '@/features/portal/portal-module-list';

const ON_TABS = new Set(Object.values(PARENT_TAB_GROUPS).flat());

/** Every other parent page (tile grid), child switcher, search, and the app settings. (Figma "More Menu") */
export default function ParentMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const accountTiles = useAccountTiles();
  return (
    <MoreFrame>
      <PortalModuleList
        role="parent"
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title) && title !== 'dashboard'}
        header={
          <MoreHeader
            top={
              <View className="gap-3">
                <ProfileCard />
                <ChildSwitcher />
              </View>
            }
            search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }}
          />
        }
        groupTiles
        extraTiles={accountTiles}
        footer={query ? undefined : <OpenWebsiteCard />}
      />
    </MoreFrame>
  );
}
