import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FeesOverview } from '@/features/admin/fees-overview';
import { TAB_GROUPS } from '@/features/admin/menu';
import { ModuleList } from '@/features/admin/module-list';
import { CampusSwitcher } from '@/features/campus/campus-switcher';
import { MoreFrame, MoreHeader } from '@/features/menu/more-layout';

/** Fees tab: its module groups as tiles, with campus and search (same frame as More). */
export default function AdminFees() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  return (
    <MoreFrame>
      <ModuleList
        only={TAB_GROUPS.fees}
        query={query}
        header={
          <View>
            <MoreHeader title={t('app.ad_tab_fees')} top={<CampusSwitcher variant="pill" />} search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }} />
            {query ? null : <FeesOverview />}
          </View>
        }
      />
    </MoreFrame>
  );
}
