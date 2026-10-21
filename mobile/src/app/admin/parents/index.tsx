import type { Parent } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { DataList } from '@/components/app/data-list';
import { FilterTag, RoundIcon, SortChips } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SearchBar } from '@/components/app/search-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { adminParents } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

type SortKey = 'name' | 'contact' | 'occupation' | 'children' | 'status';

/** Parents of the school with their children (web: /admin/parents/parent-info). */
export default function ParentsList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const list = usePagedApi<Parent>(`admin-parents:${q}`, (page) => adminParents.listWithChildren({ page, limit: 30, search: q || undefined }));
  // Web parent-info: inactive parents hidden unless shown, and sorting by column (on the loaded rows, like the web page).
  const [showInactive, setShowInactive] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const value = (p: Parent, key: SortKey): string | number =>
    key === 'name'
      ? `${p.profile?.first_name || ''} ${p.profile?.last_name || ''}`.trim()
      : key === 'contact'
        ? p.profile?.email || ''
        : key === 'occupation'
          ? p.occupation || ''
          : key === 'children'
            ? p.children?.length || 0
            : p.profile?.is_active
              ? 'active'
              : 'inactive';
  const items = list.items
    .filter((p) => showInactive || p.profile?.is_active !== false)
    .sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  const sortChips: [SortKey, string][] = [
    ['name', t('parents.table.parentName')],
    ['contact', t('parents.table.contact')],
    ['occupation', t('parents.table.occupation')],
    ['children', t('parents.table.children')],
    ['status', t('parents.table.status')],
  ];

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
        <View className="gap-3 px-4 pt-3 pb-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('parents.searchPlaceholder')} />
            </View>
            <RoundIcon icon={SlidersHorizontal} label={t('app.st_filters')} count={showInactive ? 1 : 0} onPress={() => setSheet(true)} />
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {list.total !== undefined ? <StatusChip label={t('app.ppl_count', { count: list.total })} tone="info" className="px-2.5 py-1" /> : null}
            {showInactive ? <FilterTag label={t('common.showInactive')} onClear={() => setShowInactive(false)} /> : null}
          </View>
        </View>
        <DataList
          items={list.data ? items : undefined}
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
                trailing={p.profile && p.profile.is_active === false ? <StatusChip label={t('parents.inactive')} tone="muted" className="px-2 py-0.5" /> : undefined}
                onPress={() => router.push({ pathname: '/admin/parents/[id]', params: { id: p.id } })}
              />
            );
          }}
        />
      </View>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t('app.st_filters')}>
        <View className="gap-4 pb-2">
          <View className="flex-row items-center gap-3">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} accessibilityLabel={t('common.showInactive')} />
            <Text className="flex-1 text-sm">{t('common.showInactive')}</Text>
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-semibold">{t('app.st_sort_by')}</Text>
            <SortChips options={sortChips} value={sort.key} dir={sort.dir === 1 ? 'asc' : 'desc'} onChange={(key, dir) => setSort({ key, dir: dir === 'asc' ? 1 : -1 })} />
          </View>
          <Button onPress={() => setSheet(false)}>
            <Text>{t('app.st_show_results')}</Text>
          </Button>
        </View>
      </BottomSheet>
    </>
  );
}
