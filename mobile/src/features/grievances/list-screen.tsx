import type { GrievanceView } from '@studently/api-client';
import { router, type Href } from 'expo-router';
import { MessageSquareWarning, PlusCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile } from '@/components/app/layout';
import { SearchBar } from '@/components/app/search-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isOverdue, OutlinePill, OverduePill, PriorityPill, STATUS_KEYS, StatusPill } from '@/features/grievances/ui';
import { complaints } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Complaints list with view tabs (admins), search and status filter (web: GrievanceList). */
export function GrievanceListScreen({ isAdmin, detailHref, submitHref }: { isAdmin?: boolean; detailHref: (id: string) => Href; submitHref: Href }) {
  const { t, i18n } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`grievances.list.${k}`, o);
  const [view, setView] = useState<GrievanceView>(isAdmin ? 'all' : 'mine');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const list = useApi(['grievances', view, status, q], () => complaints.list(view, { status: status || undefined, search: q || undefined, limit: 50 }));
  const total = list.data?.length ?? 0;

  return (
    <View className="bg-background flex-1">
      <DataList
        header={
          <View className="gap-3 p-4">
            <Text variant="muted" className="text-sm">{l('complaint_count', { count: total })}</Text>
            <Button size="sm" className="self-start" onPress={() => router.push(submitHref)}>
              <Icon as={PlusCircle} className="text-primary-foreground size-4" />
              <Text>{l('submit_complaint')}</Text>
            </Button>
            {isAdmin ? (
              <FilterChips<GrievanceView>
                value={view}
                onChange={setView}
                options={[
                  { value: 'all', label: l('tab_all') },
                  { value: 'assigned', label: l('tab_assigned') },
                  { value: 'mine', label: l('tab_mine') },
                ]}
              />
            ) : null}
            <SearchBar value={search} onChangeText={setSearch} placeholder={l('search_placeholder')} />
            <FilterChips value={status || '__all__'} onChange={(v) => setStatus(v === '__all__' ? '' : v)} options={[{ value: '__all__', label: l('all_statuses') }, ...STATUS_KEYS.map((s) => ({ value: s, label: t(`grievances.status.${s}`) }))]} />
          </View>
        }
        items={list.data}
        error={list.error}
        isLoading={list.isLoading}
        isRefreshing={list.isValidating && !list.isLoading}
        onRefresh={() => list.mutate()}
        emptyTitle={l('no_complaints')}
        keyExtractor={(g) => g.id}
        renderItem={(g) => (
          <Pressable onPress={() => router.push(detailHref(g.id))} className="gap-2 px-4 py-3 active:opacity-70">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-muted-foreground font-mono text-[11px]">{g.complaint_number}</Text>
              <PriorityPill priority={g.priority} />
              {g.is_confidential ? <OutlinePill label={l('confidential')} /> : null}
              {g.is_anonymous ? <OutlinePill label={l('anonymous')} /> : null}
              {isOverdue(g) ? <OverduePill /> : null}
            </View>
            <View className="flex-row items-center gap-3">
              <IconTile icon={MessageSquareWarning} size={40} />
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold" numberOfLines={2}>
                  {g.title}
                </Text>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                  {`${g.category?.name || l('uncategorized')} • ${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(g.submitted_at))}`}
                </Text>
              </View>
              <StatusPill status={g.status} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
