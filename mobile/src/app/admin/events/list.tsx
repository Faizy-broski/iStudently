import type { EventCategory, SchoolEvent } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CategoryBadge, EVENT_CATEGORIES } from '@/features/admin/events';
import { useCampus } from '@/features/campus/campus';
import { events } from '@/lib/api';
import { useApi } from '@/lib/data';

const PAGE_SIZE = 20;

/** Every event of the campus: search, category, month, sort, pages; view / edit / delete; import (web: /admin/events/list). */
export default function AllEvents() {
  const { t, i18n } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`app.ev_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [month, setMonth] = useState('all');
  const [sort, setSort] = useState<'date_asc' | 'date_desc'>('date_asc');
  const [page, setPage] = useState(1);
  const res = useApi(['admin', 'events-all', campusId ?? 'school', category], ([, , , c]) => events.getEvents({ campus_id: campusId, category: c === 'all' ? undefined : (c as EventCategory), limit: 500 }));
  const data = res.data;

  const months = useMemo(() => [...new Set((data ?? []).map((e) => e.start_at.substring(0, 7)))].sort(), [data]);
  const filtered = useMemo(() => {
    let list = data ?? [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    if (month !== 'all') list = list.filter((e) => e.start_at.substring(0, 7) === month);
    return [...list].sort((a, b) => (sort === 'date_asc' ? 1 : -1) * (new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
  }, [data, search, month, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  async function remove(ev: SchoolEvent) {
    if (!(await confirm({ title: l('delete_title'), body: l('delete_body', { title: ev.title }), confirmLabel: t('common.delete'), destructive: true }))) return;
    const r = await events.deleteEvent(ev.id);
    if (!r.success) return toast.error(r.error || l('delete_failed'));
    toast.success(l('deleted'));
    await mutate((k) => Array.isArray(k) && k[0] === 'admin' && ['events-month', 'events-all', 'event-counts', 'acal-events'].includes(k[1]));
  }

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('all_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" onPress={() => router.push('/admin/events/import')}>
            <Icon as={Upload} className="text-foreground size-4" />
            <Text>{l('import_btn')}</Text>
          </Button>
          <Button size="sm" onPress={() => router.push('/admin/events/form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{t('school.events.btn_add_event')}</Text>
          </Button>
        </View>
        <SearchBar value={search} onChangeText={(v) => reset(() => setSearch(v))} placeholder={l('search_ph')} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Picker
              value={category}
              onChange={(v) => reset(() => setCategory(v as EventCategory | 'all'))}
              options={[{ value: 'all', label: l('all_categories') }, ...EVENT_CATEGORIES.map((c) => ({ value: c, label: t(`school.events.categories.${c}`) }))]}
            />
          </View>
          <View className="flex-1">
            <Picker
              value={month}
              onChange={(v) => reset(() => setMonth(v))}
              options={[{ value: 'all', label: l('all_months') }, ...months.map((ym) => ({ value: ym, label: new Date(`${ym}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' }) }))]}
            />
          </View>
        </View>
        <Picker
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { value: 'date_asc', label: l('sort_asc') },
            { value: 'date_desc', label: l('sort_desc') },
          ]}
        />
        <Text className="text-muted-foreground text-sm">{res.isLoading ? t('common.loading') : l('count', { count: filtered.length })}</Text>

        {res.isLoading && !data ? (
          <LoadingList />
        ) : rows.length === 0 ? (
          <EmptyState title={l('none_found')} />
        ) : (
          <Card>
            {rows.map((ev, i) => (
              <View key={ev.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable className="gap-1.5 px-4 py-3" onPress={() => router.push({ pathname: '/admin/events/[id]', params: { id: ev.id } })}>
                  <View className="flex-row items-center gap-2">
                    <View className="size-2.5 rounded-full" style={{ backgroundColor: ev.color_code || '#6b7280' }} />
                    <Text className="flex-1 font-medium" numberOfLines={1}>
                      {ev.title}
                    </Text>
                    {ev.is_all_day ? (
                      <View className="border-border rounded-full border px-2 py-0.5">
                        <Text className="text-[10px]">{l('all_day')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {ev.description ? (
                    <Text className="text-muted-foreground ps-4 text-xs" numberOfLines={1}>
                      {ev.description}
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap items-center gap-2 ps-4">
                    <CategoryBadge category={ev.category} />
                    <Text className="text-muted-foreground text-xs">
                      {day(ev.start_at)}
                      {!ev.is_all_day ? ` ${time(ev.start_at)}` : ''} → {day(ev.end_at)}
                      {!ev.is_all_day ? ` ${time(ev.end_at)}` : ''}
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-1.5 ps-4">
                    {ev.visible_to_roles.map((r) => (
                      <View key={r} className="border-border rounded-full border px-2 py-0.5">
                        <Text className="text-[10px] capitalize">{r}</Text>
                      </View>
                    ))}
                    <View className="flex-1" />
                    <Button size="icon" variant="ghost" onPress={() => router.push({ pathname: '/admin/events/form', params: { id: ev.id } })} accessibilityLabel={t('common.edit')}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(ev)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                </Pressable>
              </View>
            ))}
          </Card>
        )}

        {totalPages > 1 ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-xs">
              {l('showing', { from: (current - 1) * PAGE_SIZE + 1, to: Math.min(current * PAGE_SIZE, filtered.length), total: filtered.length })}
            </Text>
            <View className="flex-row items-center gap-1">
              <Button size="icon" variant="outline" disabled={current === 1} onPress={() => setPage(current - 1)}>
                <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
              </Button>
              <Text className="px-2 text-xs">{l('page_of', { page: current, total: totalPages })}</Text>
              <Button size="icon" variant="outline" disabled={current === totalPages} onPress={() => setPage(current + 1)}>
                <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
