import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TAB_GROUPS } from '@/features/admin/menu';
import { ModuleList } from '@/features/admin/module-list';
import { CampusSwitcher } from '@/features/campus/campus-switcher';
import { MoreFrame, MoreHeader } from '@/features/menu/more-layout';

/** Academics tab: its module groups as tiles, with campus and search (same frame as More). */
export default function AdminAcademics() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  return (
    <MoreFrame>
      <ModuleList
        only={TAB_GROUPS.academics}
        query={query}
        header={
          <MoreHeader title={t('app.ad_tab_academics')} top={<CampusSwitcher variant="pill" />} search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }} />
        }
      />
    </MoreFrame>
  );
}
