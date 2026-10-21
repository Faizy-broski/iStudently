import type { FeeStructure } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { PERIOD_KEY } from '@/features/admin/fees-shared';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** Fee amounts per grade and category for an academic year (web: /admin/fees/structures). */
export default function FeeStructures() {
  const { t } = useTranslation();
  const s = (k: string) => t(`fees.structures.${k}`);
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const [picked, setPicked] = useState<string | null>(null);
  const year = picked ?? years.data?.find((y) => y.is_current)?.name ?? years.data?.[0]?.name ?? null;
  const list = useApi(scopeId && year ? ['admin', 'fee-structures', scopeId, year] : null, ([, , sid, y]) => adminFees.structures(sid as string, y as string));

  const sections = useMemo(() => {
    const groups = new Map<string, FeeStructure[]>();
    for (const x of list.data ?? []) {
      const g = x.grade_level?.name ?? '—';
      groups.set(g, [...(groups.get(g) ?? []), x]);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [list.data]);

  if (years.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: s('title'),
          headerRight: () =>
            year ? (
              <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/billing/structures/form', params: { year } })} accessibilityLabel={s('addNew')}>
                <Icon as={Plus} className="size-5" />
              </Button>
            ) : null,
        }}
      />
      <View className="bg-background flex-1">
        <View className="px-4 pt-3 pb-2">
          <Picker value={year} onChange={setPicked} placeholder={s('academicYear')} options={(years.data ?? []).map((y) => ({ value: y.name, label: y.name }))} />
          {list.data ? <Text className="text-muted-foreground pt-2 text-xs">{t('fees.structures.structuresCount', { count: list.data.length, year })}</Text> : null}
        </View>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={() => list.mutate()} />
        ) : list.isLoading ? (
          <LoadingList rows={6} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(x) => x.id}
            stickySectionHeadersEnabled={false}
            contentContainerClassName="pb-10"
            ListEmptyComponent={<EmptyState title={s('addNew')} body={s('subtitle')} />}
            renderSectionHeader={({ section }) => <Text className="text-muted-foreground px-4 pt-5 pb-1 text-sm font-semibold">{section.title}</Text>}
            ItemSeparatorComponent={() => <Separator className="ms-4" />}
            renderItem={({ item: x }) => (
              <ListRow
                title={`${x.fee_category?.name ?? '—'} · ${money(x.amount)}`}
                subtitle={[s(PERIOD_KEY[x.period_type] ?? x.period_type), x.period_name, x.due_date ? formatDate(x.due_date) : null].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/admin/billing/structures/form', params: { year: x.academic_year, id: x.id } })}
              />
            )}
          />
        )}
      </View>
    </>
  );
}
