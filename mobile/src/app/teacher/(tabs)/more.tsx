import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MoreFrame, MoreHeader, OpenWebsiteCard, useAccountTiles } from '@/features/menu/more-layout';
import { PortalModuleList } from '@/features/portal/portal-module-list';
import { TEACHER_TAB_GROUPS } from '@/features/portal/teacher-tabs';

const ON_TABS = new Set(Object.values(TEACHER_TAB_GROUPS).flat());

/** Every other teacher page (tile grid), search, and the app settings. (Figma "More Menu") */
export default function TeacherMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const accountTiles = useAccountTiles();
  return (
    <MoreFrame>
      <PortalModuleList
        role="teacher"
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title) && title !== 'dashboard'}
        header={<MoreHeader search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }} />}
        groupTiles
        extraTiles={accountTiles}
        footer={query ? undefined : <OpenWebsiteCard />}
      />
    </MoreFrame>
  );
}
