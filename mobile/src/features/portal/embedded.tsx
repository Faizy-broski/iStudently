import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, ExternalLink, Globe, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { HeaderButton, IconTile, RowItem, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { PublicWebView } from '@/components/app/web-session-view';
import { Text } from '@/components/ui/text';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';

import type { PortalRole } from './menu';

type Sort = 'title_asc' | 'title_desc' | 'newest' | 'oldest';

/** Same SWR key as the menu's "Premium Resources" injection. */
const useEmbedded = (role: PortalRole) => useApi(['portal', 'embedded', role], () => portal.embeddedForUser());

/** Web EmbeddedResourcesList: search, grade / teacher filters, sort; opens the viewer. */
export function EmbeddedListScreen({ role }: { role: PortalRole }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.resourcesEmbedded.${key}`, o);
  const data = useEmbedded(role);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('all');
  const [teacher, setTeacher] = useState('all');
  const [sort, setSort] = useState<Sort>('title_asc');

  if (data.isLoading) return <LoadingList rows={5} />;
  if (data.error) {
    return (
      <View className="bg-background flex-1">
        <ErrorState message={data.error.message || k('failedToLoadResources')} onRetry={() => data.mutate()} />
      </View>
    );
  }
  const all = data.data ?? [];
  const grades = new Map<string, string>();
  for (const r of all) (r.published_grade_ids ?? []).forEach((id, i) => !grades.has(id) && grades.set(id, r.published_grade_names?.[i] || id));
  const gradeOptions = [...grades.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const teachers = [...new Set(all.map((r) => r.creator_name).filter((n): n is string => !!n))].sort();
  const q = search.trim().toLowerCase();
  const time = (s?: string) => new Date(s || 0).getTime();
  const shown = all
    .filter((r) => !q || r.title.toLowerCase().includes(q))
    .filter((r) => grade === 'all' || !r.published_grade_ids?.length || r.published_grade_ids.includes(grade))
    .filter((r) => teacher === 'all' || r.creator_name === teacher)
    .sort((a, b) => (sort === 'title_asc' ? a.title.localeCompare(b.title) : sort === 'title_desc' ? b.title.localeCompare(a.title) : sort === 'newest' ? time(b.created_at) - time(a.created_at) : time(a.created_at) - time(b.created_at)));
  const filtering = !!q || grade !== 'all' || teacher !== 'all';
  const clear = () => {
    setSearch('');
    setGrade('all');
    setTeacher('all');
  };

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('pageSubtitle')}
        </Text>
        <View className="gap-2.5">
          <SearchBar value={search} onChangeText={setSearch} placeholder={k('searchByTitle')} />
          {gradeOptions.length ? <FilterChips value={grade} onChange={setGrade} options={[{ value: 'all', label: k('allGrades') }, ...gradeOptions.map((g) => ({ value: g.id, label: g.name }))]} /> : null}
          {teachers.length ? <FilterChips value={teacher} onChange={setTeacher} options={[{ value: 'all', label: k('allTeachers') }, ...teachers.map((n) => ({ value: n, label: n }))]} /> : null}
          <FilterChips<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'title_asc', label: k('titleAZ') },
              { value: 'title_desc', label: k('titleZA') },
              { value: 'newest', label: k('newestFirst') },
              { value: 'oldest', label: k('oldestFirst') },
            ]}
          />
          {filtering ? (
            <>
              <View className="self-start">
                <RowPill icon={X} label={k('clear')} tone="destructive" onPress={clear} />
              </View>
              <Text className="text-muted-foreground text-xs">
                {k('showingXOfYResources', { filtered: shown.length, total: all.length })}
                {grade !== 'all' ? ` · ${k('gradeLabel')}: ${gradeOptions.find((g) => g.id === grade)?.name ?? ''}` : ''}
                {teacher !== 'all' ? ` · ${k('teacherLabel')}: ${teacher}` : ''}
              </Text>
            </>
          ) : null}
        </View>
        {shown.length === 0 ? (
          <EmptyState icon={Globe} title={filtering ? k('noResourcesMatchFilters') : k('noEmbeddedResourcesAvailable')} actionLabel={filtering ? k('clearFilters') : undefined} onAction={filtering ? clear : undefined} />
        ) : (
          <Panel>
            {shown.map((r, i) => (
              <RowItem
                key={r.id}
                leading={<IconTile icon={Globe} size={40} />}
                title={r.title}
                meta={r.creator_name ? k('byCreator', { name: r.creator_name }) : null}
                onPress={() => router.push({ pathname: `/${role}/resources/embedded/[id]`, params: { id: r.id } } as never)}
                last={i === shown.length - 1}
              />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}

/** Web EmbedResourceViewer: the site in a web view, or "open in browser" when it cannot be shown. */
export function EmbedViewerScreen({ role, id }: { role: PortalRole; id: string }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.resourcesEmbeddedDetail.${key}`);
  const data = useEmbedded(role);
  if (data.isLoading) return <LoadingList rows={3} />;
  const r = (data.data ?? []).find((x) => x.id === id);
  if (!r) {
    return (
      <View className="bg-background flex-1">
        <EmptyState icon={AlertTriangle} title={k('resourceNotFound')} />
      </View>
    );
  }
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: r.title,
          headerRight: () => <HeaderButton icon={ExternalLink} label={k('openInNewTab')} onPress={() => WebBrowser.openBrowserAsync(r.url)} />,
        }}
      />
      <PublicWebView url={r.url} />
    </View>
  );
}
