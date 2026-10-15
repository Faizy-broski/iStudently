import type { Parent } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { adminParents } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Parents of the school with their children (web: /admin/parents/parent-info). */
export default function ParentsList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const list = usePagedApi<Parent>(`admin-parents:${q}`, (page) => adminParents.listWithChildren({ page, limit: 30, search: q || undefined }));

  return (
    <>
      <Stack.Screen
        options={{
          title: t('parents.title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/admin/parents/form')} accessibilityLabel={t('parents.addParent')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <View className="gap-2 px-4 pt-3 pb-2">
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('parents.searchPlaceholder')} />
          {list.total !== undefined ? <Text className="text-muted-foreground text-xs">{t('app.ppl_count', { count: list.total })}</Text> : null}
        </View>
        <DataList
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={t('parents.noParentsFound')}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          renderItem={(p) => {
            const name = shortName(p.profile) || '—';
            const kids = (p.children ?? []).map((c) => shortName(c.profile)).filter(Boolean);
            return (
              <ListRow
                title={name}
                subtitle={[p.occupation, p.profile?.phone, kids.length ? kids.join(', ') : t('parents.noChildren'), p.emergency_contact_phone ? `${t('parents.emergencyContact')}: ${p.emergency_contact_phone}` : null].filter(Boolean).join(' · ')}
                leading={<PersonAvatar url={p.profile?.profile_photo_url ?? p.profile?.avatar_url} name={name} />}
                trailing={
                  p.profile && p.profile.is_active === false ? (
                    <Badge variant="secondary">
                      <Text>{t('parents.inactive')}</Text>
                    </Badge>
                  ) : undefined
                }
                onPress={() => router.push({ pathname: '/admin/parents/[id]', params: { id: p.id } })}
              />
            );
          }}
        />
      </View>
    </>
  );
}
