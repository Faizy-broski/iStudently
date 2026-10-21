import { router } from 'expo-router';
import { Banknote, FileText, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tile } from '@/components/app/tile-grid';
import { TAB_GROUPS } from '@/features/admin/menu';
import { ModuleList } from '@/features/admin/module-list';
import { useSession } from '@/features/auth/session';
import { CampusSwitcher } from '@/features/campus/campus-switcher';
import { MoreFrame, MoreHeader, OpenWebsiteCard, useAccountTiles } from '@/features/menu/more-layout';

const ON_TABS = new Set(Object.values(TAB_GROUPS).flat());

/** Every other admin module (tile grid), search across all of them, campus, settings. (Figma "More Menu") */
export default function AdminMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const accountTiles = useAccountTiles();
  const { me } = useSession();
  // Staff also have their own payroll pages (web sidebar "My payroll").
  const payroll =
    me.status === 'ready' && me.me.profile.role === 'staff'
      ? [
          <Tile key="pay-salaries" icon={Wallet} label={t('sidebar.salaries')} onPress={() => router.push('/admin/my-payroll/salaries')} />,
          <Tile key="pay-payments" icon={Banknote} label={t('sidebar.staff_payments')} onPress={() => router.push('/admin/my-payroll/staff-payments')} />,
          <Tile key="pay-statements" icon={FileText} label={t('sidebar.print_statements')} onPress={() => router.push('/admin/my-payroll/print-statements')} />,
        ]
      : [];
  return (
    <MoreFrame>
      <ModuleList
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title) && title !== 'dashboard'}
        header={<MoreHeader top={<CampusSwitcher variant="card" />} search={{ value: query, onChange: setQuery, placeholder: t('app.ad_search_modules') }} />}
        groupTiles
        extraTiles={[...payroll, ...accountTiles]}
        footer={query ? undefined : <OpenWebsiteCard />}
      />
    </MoreFrame>
  );
}
