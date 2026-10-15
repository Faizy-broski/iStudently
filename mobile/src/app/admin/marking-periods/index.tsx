import type { MarkingPeriod, MarkingPeriodType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, Printer, Save, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { usePluginActive } from '@/features/admin/plugins';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const MP_TYPES: MarkingPeriodType[] = ['FY', 'SEM', 'QTR', 'PRO'];
const PARENT_TYPE: Record<MarkingPeriodType, MarkingPeriodType | null> = { FY: null, SEM: 'FY', QTR: 'SEM', PRO: 'QTR' };
const CHILD_TYPE: Record<MarkingPeriodType, MarkingPeriodType | null> = { FY: 'SEM', SEM: 'QTR', QTR: 'PRO', PRO: null };
const EMPTY: Record<MarkingPeriodType, MarkingPeriod[]> = { FY: [], SEM: [], QTR: [], PRO: [] };

type Form = { title: string; short_name: string; sort_order: string; does_grades: boolean; does_comments: boolean; start_date: string; end_date: string; post_start_date: string; post_end_date: string };

/** Marking period hierarchy FY → SEM → QTR → PRO: add, select & edit, delete, group filter, calendar export (web: /admin/marking-periods). */
export default function MarkingPeriods() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.marking_periods.${k}`, o);
  const typeLabel = (x: MarkingPeriodType) => t(`school.marking_periods.types.${x}`);
  const pluralLabel = (x: MarkingPeriodType) => t(`school.marking_periods.types_plural.${x}`);
  const toast = useToast();
  const confirm = useConfirm();
  const scroll = useRef<ScrollView>(null);
  const { campusId, campus } = useCampus();
  const groupsActive = usePluginActive('marking_period_groups');
  const [groupId, setGroupId] = useState<string | null>(null);
  const groups = useApi(groupsActive ? ['admin', 'mp-groups', campusId ?? 'school'] : null, () => adminAcademics.markingPeriodGroups(campusId));
  const res = useApi(['admin', 'mp-grouped', campusId ?? 'school', groupId ?? 'all'], ([, , , g]) => adminGrades.markingPeriodsGrouped(campusId, g === 'all' ? null : g));
  const grouped = res.data ?? EMPTY;
  const all = MP_TYPES.flatMap((x) => grouped[x] ?? []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (all.find((x) => x.id === selectedId) ?? null) : null;
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedKey = selected?.id ?? null;
  useEffect(() => {
    if (!selected) return setForm(null);
    setForm({
      title: selected.title,
      short_name: selected.short_name,
      sort_order: String(selected.sort_order ?? 1),
      does_grades: !!selected.does_grades,
      does_comments: !!selected.does_comments,
      start_date: selected.start_date || '',
      end_date: selected.end_date || '',
      post_start_date: selected.post_start_date || '',
      post_end_date: selected.post_end_date || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) scroll.current?.scrollTo({ y: 0, animated: true });
  };

  /** Items of a type under the selected parent chain (web: getFilteredItems). */
  const filtered = (type: MarkingPeriodType): MarkingPeriod[] => {
    const items = grouped[type] ?? [];
    const parentType = PARENT_TYPE[type];
    if (!parentType || !selected) return items;
    if (selected.mp_type === parentType) return items.filter((x) => x.parent_id === selected.id);
    if (selected.mp_type === type) return items.filter((x) => x.parent_id === selected.parent_id);
    const si = MP_TYPES.indexOf(selected.mp_type);
    const ci = MP_TYPES.indexOf(type);
    if (si < ci) {
      let ids = [selected.id];
      for (let i = si + 1; i < ci; i++) ids = (grouped[MP_TYPES[i]] ?? []).filter((x) => ids.includes(x.parent_id || '')).map((x) => x.id);
      return items.filter((x) => ids.includes(x.parent_id || ''));
    }
    return items;
  };

  async function add(type: MarkingPeriodType) {
    const parentType = PARENT_TYPE[type];
    let parentId: string | null = null;
    if (parentType) {
      const parents = grouped[parentType] ?? [];
      if (!parents.length) return toast.error(m('parent_required', { type: typeLabel(parentType) }));
      if (selected?.mp_type === parentType) parentId = selected.id;
      else if (selected?.mp_type === type && selected.parent_id) parentId = selected.parent_id;
      else parentId = parents[0].id;
    }
    // unique_mp_sort is school-wide across all types: use the global max.
    const sortOrder = all.length ? Math.max(...all.map((x) => x.sort_order ?? 0)) + 1 : 1;
    const r = await adminGrades.createMarkingPeriod({
      mp_type: type,
      parent_id: parentId,
      title: m('new_placeholder', { type: typeLabel(type) }),
      short_name: `${type}${sortOrder}`,
      sort_order: sortOrder,
      does_grades: true,
      does_comments: false,
      campus_id: campusId ?? null,
      group_id: groupId,
    });
    if (!r.success || !r.data) return toast.error(r.error || m('create_error'));
    toast.success(m('create_success', { type: typeLabel(type) }));
    await res.mutate();
    select(r.data.id);
  }

  async function save() {
    if (!selected || !form) return;
    if (form.start_date && form.end_date && form.end_date < form.start_date) return toast.error(m('invalid_dates'));
    if (form.post_start_date && form.post_end_date && form.post_end_date < form.post_start_date) return toast.error(m('invalid_post_dates'));
    setSaving(true);
    try {
      const r = await adminGrades.updateMarkingPeriod(selected.id, {
        title: form.title,
        short_name: form.short_name,
        sort_order: parseInt(form.sort_order, 10) || 1,
        does_grades: form.does_grades,
        does_comments: form.does_comments,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        post_start_date: form.post_start_date || null,
        post_end_date: form.post_end_date || null,
      });
      if (!r.success) return toast.error(r.error || m('save_error'));
      toast.success(m('save_success'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected) return;
    const child = CHILD_TYPE[selected.mp_type];
    const hasChildren = child ? (grouped[child] ?? []).some((x) => x.parent_id === selected.id) : false;
    const ok = await confirm({ title: hasChildren ? m('delete_confirm_children') : m('delete_confirm_single'), confirmLabel: m('delete_btn'), destructive: true });
    if (!ok) return;
    const r = await adminGrades.deleteMarkingPeriod(selected.id);
    if (!r.success) return toast.error(r.error || m('delete_error'));
    toast.success(m('delete_success'));
    setSelectedId(null);
    res.mutate();
  }

  const today = todayYmd();
  const fmt = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) : '');
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const groupList = groups.data ?? [];

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView ref={scroll} contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="text-muted-foreground text-sm">{m('subtitle', { campus: campus ? ` — ${campus.name}` : '' })}</Text>
        </View>
        <Button variant="outline" size="sm" className="self-start" onPress={() => router.push({ pathname: '/admin/marking-periods/calendar', params: { group: groupId ?? '' } })}>
          <Icon as={Printer} className="text-foreground size-4" />
          <Text>{t('app.acal_export')}</Text>
        </Button>

        {groupsActive && groupList.length > 0 ? (
          <View className="gap-1.5">
            <Label>{m('group_filter')}</Label>
            <Picker
              value={groupId ?? 'all'}
              onChange={(v) => {
                setGroupId(v === 'all' ? null : v);
                setSelectedId(null);
              }}
              options={[{ value: 'all', label: m('all_groups') }, ...groupList.map((g) => ({ value: g.id, label: `${g.name}${g.is_default ? ' ★' : ''}` }))]}
            />
          </View>
        ) : null}

        {selected && form ? (
          <Card>
            <CardContent className="gap-4 pt-4">
              <Text className="text-primary text-sm font-semibold uppercase">
                {typeLabel(selected.mp_type)} — {selected.title}
              </Text>
              <View className="gap-1.5">
                <Label>{m('field_title')}</Label>
                <Input value={form.title} onChangeText={(v) => set({ title: v })} />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label>{m('field_short')}</Label>
                  <Input value={form.short_name} onChangeText={(v) => set({ short_name: v })} />
                </View>
                <View className="w-28 gap-1.5">
                  <Label>{m('field_order')}</Label>
                  <Input value={form.sort_order} onChangeText={(v) => set({ sort_order: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                </View>
              </View>
              <View className="flex-row flex-wrap gap-6">
                <CheckRow checked={form.does_grades} onPress={() => set({ does_grades: !form.does_grades })} label={m('field_graded')} />
                <CheckRow checked={form.does_comments} onPress={() => set({ does_comments: !form.does_comments })} label={m('field_comments')} />
              </View>
              <View className="flex-row gap-3">
                <DateField className="flex-1" label={m('field_start_date')} value={form.start_date} onChange={(v) => set({ start_date: v })} clearable />
                <DateField className="flex-1" label={m('field_end_date')} value={form.end_date} onChange={(v) => set({ end_date: v })} clearable />
              </View>
              <View className="flex-row gap-3">
                <DateField className="flex-1" label={m('field_post_start')} value={form.post_start_date} onChange={(v) => set({ post_start_date: v })} clearable />
                <DateField className="flex-1" label={m('field_post_end')} value={form.post_end_date} onChange={(v) => set({ post_end_date: v })} clearable />
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="destructive" size="sm" onPress={remove}>
                  <Icon as={Trash2} className="size-4 text-white" />
                  <Text>{m('delete_btn')}</Text>
                </Button>
                <Button size="sm" onPress={save} disabled={saving}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{m('save_btn')}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : null}

        {res.isLoading && !res.data ? (
          <LoadingList />
        ) : res.error && !res.data ? (
          <ErrorState onRetry={() => res.mutate()} message={m('fetch_error')} />
        ) : (
          MP_TYPES.map((type) => {
            const items = filtered(type);
            return (
              <Card key={type}>
                <View className="bg-muted/50 flex-row items-center justify-between rounded-t-xl px-4 py-2">
                  <Text className="text-primary text-xs font-semibold uppercase">{pluralLabel(type)}</Text>
                  <Pressable onPress={() => add(type)} hitSlop={8} accessibilityLabel={m('new_placeholder', { type: typeLabel(type) })}>
                    <Icon as={Plus} className="size-5 text-green-600" />
                  </Pressable>
                </View>
                {items.length === 0 ? (
                  <Text className="text-muted-foreground px-4 py-5 text-center text-xs">{m('no_items', { type: pluralLabel(type).toLowerCase() })}</Text>
                ) : (
                  items.map((mp, i) => {
                    const isSel = selectedId === mp.id;
                    const current = !!mp.start_date && !!mp.end_date && mp.start_date <= today && mp.end_date >= today;
                    return (
                      <View key={mp.id}>
                        {i > 0 ? <Separator /> : null}
                        <Pressable onPress={() => select(isSel ? null : mp.id)} className={cn('px-4 py-2.5', isSel && 'bg-primary/10')}>
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className={cn('flex-1 text-sm', isSel && 'text-primary font-bold')} numberOfLines={1}>
                              {mp.title}
                            </Text>
                            <View className="flex-row items-center gap-1.5">
                              {current ? <View className="size-2 rounded-full bg-green-500" accessibilityLabel={m('active_tooltip')} /> : null}
                              {mp.does_grades ? <Text className="text-[10px] font-medium text-blue-500">G</Text> : null}
                              {mp.does_comments ? <Text className="text-[10px] font-medium text-purple-500">C</Text> : null}
                            </View>
                          </View>
                          {mp.start_date || mp.end_date ? (
                            <Text className="text-muted-foreground mt-0.5 text-[11px]">
                              {fmt(mp.start_date)} — {fmt(mp.end_date)}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </Card>
            );
          })
        )}

        <View className="gap-1">
          <Text className="text-muted-foreground text-xs">{m('help_hierarchy', { icon: '+' })}</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="size-2 rounded-full bg-green-500" />
            <Text className="text-muted-foreground flex-1 text-xs">{m('help_legend')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
