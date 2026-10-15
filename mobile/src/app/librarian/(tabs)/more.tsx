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

const ON_TABS = new Set(['dashboard', 'books', 'loan_directory']);

/** Every other librarian page, search, and the app settings. */
export default function LibrarianMore() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  return (
    <View className="bg-background flex-1">
      <View className="gap-2 px-4 pt-3 pb-1">
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('app.ad_search_modules')} />
      </View>
      <PortalModuleList
        role="librarian"
        query={query}
        filter={query ? undefined : (title) => !ON_TABS.has(title)}
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
