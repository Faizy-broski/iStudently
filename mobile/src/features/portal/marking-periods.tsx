import type { GroupedMarkingPeriods, MarkingPeriod, MarkingPeriodType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const TYPES: MarkingPeriodType[] = ['FY', 'SEM', 'QTR', 'PRO'];
const PARENT: Record<MarkingPeriodType, MarkingPeriodType | null> = { FY: null, SEM: 'FY', QTR: 'SEM', PRO: 'QTR' };
const EMPTY: GroupedMarkingPeriods = { FY: [], SEM: [], QTR: [], PRO: [] };

const fmt = (d?: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const isCurrent = (mp: MarkingPeriod) => {
  if (!mp.start_date || !mp.end_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return mp.start_date <= today && mp.end_date >= today;
};

/**
 * Read-only marking period hierarchy; tap a period to see its dates and narrow the columns below it
 * (web: /student and /parent marking-periods). The parent page also opens on the current quarter.
 */
export function MarkingPeriodsView({ campusId, campusName, selectCurrentQuarter }: { campusId: string | null; campusName?: string | null; selectCurrentQuarter?: boolean }) {
  const { t } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`school.marking_periods.${k}`, o);
  const s = (k: string) => t(`app.st_mp_${k}`);
  const data = useApi(['portal', 'mp-grouped', campusId ?? 'school'], ([, , c]) => adminGrades.markingPeriodsGrouped(c === 'school' ? undefined : c));
  // undefined until the user taps a period; the parent page then starts on the current quarter.
  const [picked, setSelectedId] = useState<string | null | undefined>(undefined);

  const grouped = data.data ?? EMPTY;
  const currentQuarter = selectCurrentQuarter ? ((data.data?.QTR ?? []).find(isCurrent)?.id ?? null) : null;
  const selectedId = picked === undefined ? currentQuarter : picked;
  const selected = selectedId ? (Object.values(grouped).flat().find((mp) => mp.id === selectedId) ?? null) : null;

  /** Same narrowing as the web: children of the selected period, siblings of it, or descendants further down. */
  function itemsFor(type: MarkingPeriodType): MarkingPeriod[] {
    const items = grouped[type] ?? [];
    const parentType = PARENT[type];
    if (!parentType || !selected) return items;
    const selIdx = TYPES.indexOf(selected.mp_type);
    const curIdx = TYPES.indexOf(type);
    if (selected.mp_type === parentType) return items.filter((mp) => mp.parent_id === selected.id);
    if (selected.mp_type === type) return items.filter((mp) => mp.parent_id === selected.parent_id);
    if (selIdx < curIdx) {
      let parents = [selected.id];
      for (let i = selIdx + 1; i < curIdx; i++) parents = (grouped[TYPES[i]] ?? []).filter((mp) => parents.includes(mp.parent_id || '')).map((mp) => mp.id);
      return items.filter((mp) => parents.includes(mp.parent_id || ''));
    }
    return items;
  }

  if (data.isLoading) return <LoadingList rows={6} />;

  return (
    <>
      <Stack.Screen options={{ title: m('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{campusName ? `${s('subtitle')} — ${campusName}` : s('subtitle')}</Text>

        {selected ? (
          <View className="border-border bg-card gap-3 rounded-lg border p-4">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-xs font-semibold text-[#022172] uppercase dark:text-white">{m(`types.${selected.mp_type}`)}</Text>
              <Text className="text-sm font-medium">{selected.title}</Text>
              <Text className="text-muted-foreground text-xs">{`(${selected.short_name})`}</Text>
              {isCurrent(selected) ? (
                <View className="flex-row items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 dark:bg-green-950/30">
                  <View className="size-1.5 rounded-full bg-green-500" />
                  <Text className="text-xs font-medium text-green-600">{s('current')}</Text>
                </View>
              ) : null}
              {selected.does_grades ? <Pill box="bg-blue-50 dark:bg-blue-950/30" text="text-blue-600" label={s('graded')} /> : null}
              {selected.does_comments ? <Pill box="bg-purple-50 dark:bg-purple-950/30" text="text-purple-600" label={s('comments')} /> : null}
            </View>
            <View className="flex-row flex-wrap gap-y-3">
              <Field label={s('starts')} value={fmt(selected.start_date)} />
              <Field label={s('ends')} value={fmt(selected.end_date)} />
              {selected.does_grades ? (
                <>
                  <Field label={s('post_opens')} value={fmt(selected.post_start_date)} />
                  <Field label={s('post_closes')} value={fmt(selected.post_end_date)} />
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        {TYPES.map((type) => {
          const items = itemsFor(type);
          return (
            <View key={type} className="border-border bg-card overflow-hidden rounded-lg border">
              <View className="border-border border-b bg-[#022172]/10 px-3 py-2">
                <Text className="text-xs font-semibold text-[#022172] uppercase dark:text-white">{m(`types_plural.${type}`)}</Text>
              </View>
              {items.length === 0 ? (
                <Text className="text-muted-foreground px-3 py-6 text-center text-xs">{m('no_items', { type: m(`types_plural.${type}`).toLowerCase() })}</Text>
              ) : (
                items.map((mp) => {
                  const sel = selectedId === mp.id;
                  return (
                    <Pressable
                      key={mp.id}
                      onPress={() => setSelectedId(sel ? null : mp.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                      className={cn('border-border border-t px-3 py-2 first:border-t-0', sel && 'bg-[#022172]/10 dark:bg-[#022172]/30')}>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className={cn('flex-1 text-sm', sel ? 'font-bold text-[#022172] dark:text-white' : '')} numberOfLines={1}>
                          {mp.title}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          {isCurrent(mp) ? <View className="size-2 rounded-full bg-green-500" accessibilityLabel={m('active_tooltip')} /> : null}
                          {mp.does_grades ? <Text className="text-[10px] font-medium text-blue-500">G</Text> : null}
                        </View>
                      </View>
                      {mp.start_date || mp.end_date ? <Text className="text-muted-foreground mt-0.5 text-[10px]">{`${fmt(mp.start_date)} – ${fmt(mp.end_date)}`}</Text> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}
        {selectCurrentQuarter ? (
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
            <View className="flex-row items-center gap-1">
              <View className="size-2 rounded-full bg-green-500" />
              <Text className="text-muted-foreground text-xs">{m('active_tooltip')}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-medium text-blue-500">G</Text>
              <Text className="text-muted-foreground text-xs">{t('app.pa_mp_graded')}</Text>
            </View>
            <Text className="text-muted-foreground text-xs italic">{t('app.pa_mp_tap')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Pill({ label, box, text }: { label: string; box: string; text: string }) {
  return (
    <View className={cn('rounded-full px-2 py-0.5', box)}>
      <Text className={cn('text-xs font-medium', text)}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2">
      <Text className="text-muted-foreground mb-0.5 text-xs uppercase">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}
