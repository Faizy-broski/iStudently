import type { SchoolFieldDefinition } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, ListPlus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { HeaderButton, IconTile } from '@/components/app/layout';
import { ListRow } from '@/components/app/list-row';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { DEFAULT_TAB, fieldTabs } from '@/features/superadmin/fields';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

/** School custom fields (super admin), grouped into tabs; move up/down instead of drag. */
export default function SchoolFields() {
  const { t } = useTranslation();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const fields = useApi(['platform', 'school-fields', id], () => platform.listSchoolFields(id));
  const tabs = useMemo(() => fieldTabs(fields.data ?? []), [fields.data]);
  const [tab, setTab] = useState(DEFAULT_TAB.id);
  const activeTab = tabs.some((x) => x.id === tab) ? tab : DEFAULT_TAB.id;
  const inTab = (fields.data ?? []).filter((f) => f.category_id === activeTab).sort((a, b) => a.sort_order - b.sort_order);
  const reorder = useAction((items: { id: string; sort_order: number }[]) => platform.reorderSchoolFields(id, activeTab, items));

  async function move(f: SchoolFieldDefinition, dir: -1 | 1) {
    const i = inTab.findIndex((x) => x.id === f.id);
    const j = i + dir;
    if (j < 0 || j >= inTab.length) return;
    const next = [...inTab];
    [next[i], next[j]] = [next[j], next[i]];
    const items = next.map((x, k) => ({ id: x.id, sort_order: k }));
    const order = new Map(items.map((x) => [x.id, x.sort_order]));
    fields.mutate(
      (fields.data ?? []).map((x) => (order.has(x.id) ? { ...x, sort_order: order.get(x.id)! } : x)),
      { revalidate: false },
    );
    if (!(await reorder.run(items)).ok) fields.mutate();
  }

  const openForm = (fieldId?: string) =>
    router.push({ pathname: '/superadmin/school/field-form', params: { schoolId: id, tab: activeTab, ...(fieldId ? { fieldId } : {}) } });

  return (
    <>
      <Stack.Screen
        options={{
          title: name ? t('app.cf_title_for', { name }) : t('app.cf_title'),
          headerRight: () => <HeaderButton icon={Plus} label={t('app.cf_new')} onPress={() => openForm()} />,
        }}
      />
      <View className="bg-background flex-1">
        {tabs.length > 1 ? (
          <View className="px-4 pt-3">
            <FilterChips value={activeTab} onChange={setTab} options={tabs.map((x) => ({ value: x.id, label: x.name }))} />
          </View>
        ) : null}
        <DataList
          items={fields.data ? inTab : undefined}
          error={fields.error}
          isLoading={fields.isLoading}
          isRefreshing={fields.isValidating && !fields.isLoading}
          onRefresh={() => fields.mutate()}
          emptyTitle={t('app.cf_none')}
          emptyBody={t('app.cf_none_body')}
          keyExtractor={(f) => f.id}
          renderItem={(f, i) => (
            <ListRow
              title={f.label}
              subtitle={[t(`app.cf_type_${f.type}`), t(`app.cf_scope_${f.campus_scope}`)].join(' · ')}
              leading={<IconTile icon={ListPlus} size={40} />}
              trailing={
                <View className="flex-row items-center gap-2">
                  {f.required ? <StatusChip label={t('app.cf_required')} tone="warning" /> : null}
                  <Pressable
                    onPress={() => move(f, -1)}
                    disabled={i === 0}
                    hitSlop={8}
                    accessibilityLabel={t('app.ib_move_up')}
                    className={i === 0 ? 'bg-muted size-8 items-center justify-center rounded-full opacity-50' : 'bg-info-soft size-8 items-center justify-center rounded-full active:opacity-70'}>
                    <Icon as={ArrowUp} className={i === 0 ? 'text-muted-foreground size-4' : 'text-brand dark:text-brand-secondary size-4'} />
                  </Pressable>
                  <Pressable
                    onPress={() => move(f, 1)}
                    disabled={i === inTab.length - 1}
                    hitSlop={8}
                    accessibilityLabel={t('app.ib_move_down')}
                    className={i === inTab.length - 1 ? 'bg-muted size-8 items-center justify-center rounded-full opacity-50' : 'bg-info-soft size-8 items-center justify-center rounded-full active:opacity-70'}>
                    <Icon as={ArrowDown} className={i === inTab.length - 1 ? 'text-muted-foreground size-4' : 'text-brand dark:text-brand-secondary size-4'} />
                  </Pressable>
                </View>
              }
              chevron={false}
              onPress={() => openForm(f.id)}
            />
          )}
        />
      </View>
    </>
  );
}
