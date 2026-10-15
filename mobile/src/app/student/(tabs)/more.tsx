import { router } from 'expo-router';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { PortalModuleList } from '@/features/portal/portal-module-list';
import { STUDENT_TAB_GROUPS } from '@/features/portal/student-tabs';

const ON_TABS = new Set(Object.values(STUDENT_TAB_GROUPS).flat());

/** Every other student page, search across all of them, and the app settings. */
export default function StudentMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  return (
    <View className="bg-background flex-1">
      <View className="px-4 pt-3 pb-1">
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('app.ad_search_modules')} />
      </View>
      <PortalModuleList
        role="student"
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title) && title !== 'dashboard'}
        header={
          query ? undefined : (
            <>
              <ListRow title={t('app.set_title')} leading={<Icon as={SettingsIcon} className="text-muted-foreground size-5" />} onPress={() => router.push('/settings')} />
              <Separator />
            </>
          )
        }
      />
    </View>
  );
}
