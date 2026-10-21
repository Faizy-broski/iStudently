import type { CustomFieldDefinition } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, ListOrdered, Plus, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { isPersonEntity, tabsFor, type PersonEntity } from '@/features/admin/field-tabs';
import { STANDARD_FIELDS } from '@/features/admin/standard-fields';
import { useCampus } from '@/features/campus/campus';
import { locale } from '@/i18n';
import { adminCustomFields, adminFieldOrders } from '@/lib/api';
import { useApi } from '@/lib/data';

type Item = { key: string; kind: 'default'; id: string; label: string; sort: number; required: boolean } | { key: string; kind: 'custom'; field: CustomFieldDefinition; label: string; sort: number };

/** Custom fields per tab, merged with the built-in fields (order + required), and tab order (web: /admin/<people>/custom-fields). */
export default function PeopleFields() {
  const { t } = useTranslation();
  const toast = useToast();
  const params = useLocalSearchParams<{ entity?: string }>();
  const entity: PersonEntity = isPersonEntity(params.entity) ? params.entity : 'student';
  const std = entity === 'student' || entity === 'teacher' || entity === 'staff' || entity === 'parent' ? STANDARD_FIELDS[entity] : null;
  const orderEntity = entity as 'student' | 'teacher' | 'staff' | 'parent';
  const { campusId } = useCampus();
  const fields = useApi(['admin', 'custom-fields', entity, campusId ?? 'school'], () => adminCustomFields.list(entity, campusId));
  const orders = useApi(std ? ['admin', 'field-orders', entity, campusId ?? 'school'] : null, () => adminFieldOrders.list(orderEntity, campusId));
  const catOrders = useApi(std ? ['admin', 'category-orders', entity, campusId ?? 'school'] : null, () => adminFieldOrders.categoryOrders(orderEntity, campusId));
  const [tab, setTab] = useState('personal');
  const [draft, setDraft] = useState<{ tab: string; keys: string[] } | null>(null);
  const [tabDraft, setTabDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const savedTabOrder = new Map((catOrders.data ?? []).map((c) => [c.category_id, c.category_order]));
  const baseTabs = tabsFor(entity, fields.data ?? []);
  const tabs = [...baseTabs].sort((a, b) => (savedTabOrder.get(a.id) ?? baseTabs.indexOf(a) + 100) - (savedTabOrder.get(b.id) ?? baseTabs.indexOf(b) + 100));
  const orderedTabs = tabDraft ? tabDraft.map((id) => tabs.find((x) => x.id === id)!).filter(Boolean) : tabs;
  const activeTab = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const tabName = (x: { id: string; name: string; builtIn: boolean }) => (x.builtIn ? t(`app.cf_tab_${x.id}`) : x.name);

  const saved = new Map((orders.data ?? []).filter((o) => o.category_id === activeTab).map((o) => [o.field_label, o]));
  const items: Item[] = [
    ...(std?.[activeTab] ?? []).map((f) => {
      const s = saved.get(f.id);
      return { key: `default:${f.id}`, kind: 'default' as const, id: f.id, label: t(`app.${f.key}`), sort: s?.sort_order ?? f.sort, required: typeof s?.required === 'boolean' ? s.required : f.required };
    }),
    ...(fields.data ?? [])
      .filter((f) => f.category_id === activeTab && f.is_active !== false)
      .map((f) => ({ key: `custom:${f.id}`, kind: 'custom' as const, field: f, label: (locale === 'ar' && f.label_ar) || f.label, sort: f.sort_order ?? 1000 })),
  ].sort((a, b) => a.sort - b.sort);
  const ordered = draft && draft.tab === activeTab ? draft.keys.map((k) => items.find((i) => i.key === k)).filter((x): x is Item => !!x) : items;

  const move = (i: number, dir: -1 | 1) => {
    const keys = ordered.map((x) => x.key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setDraft({ tab: activeTab, keys });
  };
  async function saveOrder() {
    setBusy(true);
    try {
      const defaults = ordered.flatMap((x, i) => (x.kind === 'default' ? [{ field_label: x.id, sort_order: i + 1 }] : []));
      const customs = ordered.flatMap((x, i) => (x.kind === 'custom' ? [{ id: x.field.id, sort_order: i + 1 }] : []));
      const [a, b] = await Promise.all([
        defaults.length && std ? adminFieldOrders.save(orderEntity, activeTab, defaults, campusId) : Promise.resolve({ success: true as const, error: undefined }),
        customs.length ? adminCustomFields.reorder(campusId, activeTab, customs) : Promise.resolve({ success: true as const, error: undefined }),
      ]);
      if (!a.success || !b.success) return toast.error(a.error || b.error || t('common.error'));
      toast.success(t('app.saved'));
      setDraft(null);
      orders.mutate();
      fields.mutate();
    } finally {
      setBusy(false);
    }
  }
  async function toggleRequired(item: Extract<Item, { kind: 'default' }>, value: boolean, index: number) {
    const r = await adminFieldOrders.setRequired(orderEntity, activeTab, item.id, value, index + 1, campusId);
    if (!r.success) return toast.error(r.error || t('common.error'));
    orders.mutate();
  }
  async function saveTabs() {
    if (!tabDraft) return;
    setBusy(true);
    try {
      const r = await adminFieldOrders.saveCategoryOrders(orderEntity, tabDraft.map((id, i) => ({ category_id: id, category_order: i + 1 })), campusId);
      if (!r.success) return toast.error(r.error || t('common.error'));
      toast.success(t('app.saved'));
      setTabDraft(null);
      catOrders.mutate();
    } finally {
      setBusy(false);
    }
  }
  const moveTab = (i: number, dir: -1 | 1) => {
    const ids = orderedTabs.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setTabDraft(ids);
  };
  const openForm = (fieldId?: string) => router.push({ pathname: '/admin/fields/form', params: { entity, tab: activeTab, ...(fieldId ? { fieldId } : {}) } });
  const arrows = (i: number, len: number, onMove: (i: number, d: -1 | 1) => void) => (
    <>
      <Pressable onPress={() => onMove(i, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel={t('app.ib_move_up')}>
        <Icon as={ArrowUp} className={i === 0 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
      </Pressable>
      <Pressable onPress={() => onMove(i, 1)} disabled={i === len - 1} hitSlop={8} accessibilityLabel={t('app.ib_move_down')}>
        <Icon as={ArrowDown} className={i === len - 1 ? 'text-muted size-5' : 'text-muted-foreground size-5'} />
      </Pressable>
    </>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: t(`app.cf_title_${entity}`),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => openForm()} accessibilityLabel={t('app.cf_new')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <FilterChips value={activeTab} onChange={(v) => (setTab(v), setDraft(null))} options={tabs.map((x) => ({ value: x.id, label: tabName(x) }))} />
          </View>
          {std ? (
            <Pressable onPress={() => setTabDraft(tabDraft ? null : tabs.map((x) => x.id))} hitSlop={8} className="p-1" accessibilityLabel={t('app.cf_reorder_tabs')}>
              <Icon as={ListOrdered} className="text-foreground size-5" />
            </Pressable>
          ) : null}
        </View>
        {tabDraft ? (
          <Card>
            <CardContent className="gap-1 pt-4">
              <Text className="font-semibold">{t('app.cf_reorder_tabs')}</Text>
              {orderedTabs.map((x, i) => (
                <View key={x.id} className="flex-row items-center gap-3 py-1.5">
                  <Text className="flex-1 text-sm">{tabName(x)}</Text>
                  {arrows(i, orderedTabs.length, moveTab)}
                </View>
              ))}
              <View className="flex-row gap-2 pt-1">
                <Button variant="outline" className="flex-1" onPress={() => setTabDraft(null)} disabled={busy}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button className="flex-1" onPress={saveTabs} disabled={busy}>
                  <Text>{t('common.save')}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : null}
        {std ? <Text className="text-muted-foreground text-xs">{t('app.cf_merged_hint')}</Text> : null}
        {fields.isLoading || orders.isLoading ? (
          <LoadingList rows={5} />
        ) : fields.error ? (
          <ErrorState message={fields.error.message} onRetry={() => fields.mutate()} />
        ) : (
          <Card>
            <CardContent className="py-1">
              {!ordered.length ? <EmptyState title={t('app.cf_none')} /> : null}
              {ordered.map((x, i) => (
                <View key={x.key}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable disabled={x.kind === 'default'} onPress={() => x.kind === 'custom' && openForm(x.field.id)} className="flex-row items-center gap-3 py-3">
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-medium">{x.label}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {x.kind === 'default' ? t('app.cf_builtin') : [t(`app.cf_type_${x.field.type}`), x.field.campus_scope ? t(`app.cf_scope_${x.field.campus_scope}`) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {x.kind === 'default' ? (
                      <View className="items-center">
                        <Switch checked={x.required} onCheckedChange={(v) => toggleRequired(x, v, i)} />
                        <Text className="text-muted-foreground text-[10px]">{t('app.cf_required')}</Text>
                      </View>
                    ) : x.field.required ? (
                      <Badge variant="outline">
                        <Text>{t('app.cf_required')}</Text>
                      </Badge>
                    ) : null}
                    {arrows(i, ordered.length, move)}
                  </Pressable>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
        {draft && draft.tab === activeTab ? (
          <Button onPress={saveOrder} disabled={busy}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{t('app.cf_save_order')}</Text>
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
