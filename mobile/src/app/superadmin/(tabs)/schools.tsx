import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { CARD_LIST_PROPS, ListCard } from '@/components/app/panel';
import { SchoolLogo } from '@/components/app/school-logo';
import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { onTrial, SchoolStatusChip } from '@/features/superadmin/school-status';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatNumber } from '@/lib/format';

type Filter = 'all' | 'active' | 'suspended' | 'trial';

/** School directory (card style): header with onboard, counts, search, status filters, compact school cards. */
export default function SuperadminSchools() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'schools'], () => platform.listSchools());

  // Top-level schools; campuses are shown on the school's detail page.
  const { schools, campusCount, counts } = useMemo(() => {
    const all = data ?? [];
    const perParent: Record<string, number> = {};
    for (const s of all) if (s.parent_school_id) perParent[s.parent_school_id] = (perParent[s.parent_school_id] ?? 0) + 1;
    const roots = all.filter((s) => !s.parent_school_id);
    const q = search.trim().toLowerCase();
    const list = roots
      .filter((s) => (filter === 'all' ? true : filter === 'trial' ? onTrial(s) : s.status === filter))
      .filter((s) => !q || [s.name, s.short_name, s.slug, s.city, s.contact_email].some((v) => v?.toLowerCase().includes(q)));
    return {
      schools: list,
      campusCount: perParent,
      counts: {
        all: roots.length,
        active: roots.filter((s) => s.status === 'active').length,
        trial: roots.filter(onTrial).length,
        suspended: roots.filter((s) => s.status === 'suspended').length,
      },
    };
  }, [data, search, filter]);

  const header = (
    <View className="gap-3 pb-3 pt-2">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-brand dark:text-foreground text-2xl font-bold">{t('app.sa_tab_schools')}</Text>
          <Text variant="muted" className="text-xs">
            {t('app.sch_subtitle')}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/superadmin/onboard')} accessibilityRole="button" accessibilityLabel={t('app.ob_title')}>
          <BrandGradient variant="primary" angle={135} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon as={Plus} strokeWidth={2.6} className="size-5 text-white" />
          </BrandGradient>
        </Pressable>
      </View>
      <View className="flex-row gap-2.5">
        {(
          [
            [t('app.sch_total'), counts.all],
            [t('app.sa_status_active'), counts.active],
            [t('app.sa_status_trial'), counts.trial],
            [t('app.sa_status_suspended'), counts.suspended],
          ] as const
        ).map(([label, n]) => (
          <View key={label} className="border-info-soft dark:border-border bg-card flex-1 gap-0.5 rounded-2xl border px-3 py-2.5">
            <Text variant="muted" className="text-[11px]" numberOfLines={1}>
              {label}
            </Text>
            <Text className="text-base font-bold">{formatNumber(n)}</Text>
          </View>
        ))}
      </View>
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
  );

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <DataList
          {...CARD_LIST_PROPS}
          header={header}
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
            <ListCard onPress={() => router.push({ pathname: '/superadmin/school/[id]', params: { id: s.id } })}>
              <SchoolLogo url={s.logo_url} shape={s.logo_shape} size={40} />
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                  {[s.city, t('app.sa_campuses', { count: campusCount[s.id] ?? 0 })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <SchoolStatusChip school={s} />
            </ListCard>
          )}
        />
      </SafeAreaView>
    </AuthBackground>
  );
}
