import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { SchoolLogo } from '@/components/app/school-logo';
import { SearchBar } from '@/components/app/search-bar';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { onTrial, SchoolStatusBadge } from '@/features/superadmin/school-status';

type Filter = 'all' | 'active' | 'suspended' | 'trial';

export default function SuperadminSchools() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'schools'], () => platform.listSchools());

  // Top-level schools; campuses are shown on the school's detail page.
  const { schools, campusCount } = useMemo(() => {
    const all = data ?? [];
    const counts: Record<string, number> = {};
    for (const s of all) if (s.parent_school_id) counts[s.parent_school_id] = (counts[s.parent_school_id] ?? 0) + 1;
    const q = search.trim().toLowerCase();
    const list = all
      .filter((s) => !s.parent_school_id)
      .filter((s) => (filter === 'all' ? true : filter === 'trial' ? onTrial(s) : s.status === filter))
      .filter((s) => !q || [s.name, s.short_name, s.slug, s.city, s.contact_email].some((v) => v?.toLowerCase().includes(q)));
    return { schools: list, campusCount: counts };
  }, [data, search, filter]);

  return (
    <View className="bg-background flex-1">
      <View className="gap-3 px-4 pt-3 pb-2">
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.sa_search_schools')} />
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('app.sa_filter_all') },
            { value: 'active', label: t('app.sa_status_active') },
            { value: 'suspended', label: t('app.sa_status_suspended') },
            { value: 'trial', label: t('app.sa_status_trial') },
          ]}
        />
      </View>
      <DataList
        items={data ? schools : undefined}
        error={error}
        isLoading={isLoading}
        isRefreshing={isValidating && !isLoading}
        onRefresh={() => mutate()}
        emptyTitle={t('app.sa_no_schools')}
        emptyBody={t('app.sa_no_schools_body')}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        renderItem={(s) => (
          <ListRow
            title={s.name}
            subtitle={[s.city, t('app.sa_campuses', { count: campusCount[s.id] ?? 0 })].filter(Boolean).join(' · ')}
            leading={<SchoolLogo url={s.logo_url} shape={s.logo_shape} size={40} />}
            trailing={<SchoolStatusBadge school={s} />}
            onPress={() => router.push({ pathname: '/superadmin/school/[id]', params: { id: s.id } })}
          />
        )}
      />
    </View>
  );
}
