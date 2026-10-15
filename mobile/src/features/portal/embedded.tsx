import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, ExternalLink, Globe, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { PublicWebView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
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
      <View className="bg-background flex-1 items-center justify-center gap-3 p-6">
        <Icon as={AlertTriangle} className="size-8 text-yellow-500" />
        <Text className="text-muted-foreground">{data.error.message || k('failedToLoadResources')}</Text>
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
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <View className="border-border bg-card gap-2 rounded-xl border p-3">
          <SearchBar value={search} onChangeText={setSearch} placeholder={k('searchByTitle')} />
          {gradeOptions.length ? <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: k('allGrades') }, ...gradeOptions.map((g) => ({ value: g.id, label: g.name }))]} /> : null}
          {teachers.length ? <Picker value={teacher} onChange={setTeacher} options={[{ value: 'all', label: k('allTeachers') }, ...teachers.map((n) => ({ value: n, label: n }))]} /> : null}
          <Picker
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { value: 'title_asc', label: k('titleAZ') },
              { value: 'title_desc', label: k('titleZA') },
              { value: 'newest', label: k('newestFirst') },
              { value: 'oldest', label: k('oldestFirst') },
            ]}
          />
          {filtering ? (
            <>
              <Button variant="outline" size="sm" className="self-start border-red-200" onPress={clear}>
                <Icon as={X} className="size-3.5 text-red-600" />
                <Text className="text-red-600">{k('clear')}</Text>
              </Button>
              <Text className="text-muted-foreground text-xs">
                {k('showingXOfYResources', { filtered: shown.length, total: all.length })}
                {grade !== 'all' ? ` · ${k('gradeLabel')}: ${gradeOptions.find((g) => g.id === grade)?.name ?? ''}` : ''}
                {teacher !== 'all' ? ` · ${k('teacherLabel')}: ${teacher}` : ''}
              </Text>
            </>
          ) : null}
        </View>
        {shown.length === 0 ? (
          <View className="items-center py-12">
            <Icon as={Globe} className="text-muted-foreground mb-3 size-12 opacity-30" />
            <Text className="text-muted-foreground font-medium">{filtering ? k('noResourcesMatchFilters') : k('noEmbeddedResourcesAvailable')}</Text>
            {filtering ? (
              <Pressable onPress={clear} className="mt-3" accessibilityRole="button">
                <Text className="text-sm text-blue-600">{k('clearFilters')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          shown.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: `/${role}/resources/embedded/[id]`, params: { id: r.id } } as never)}
              accessibilityRole="button"
              className="border-border bg-card flex-row items-start gap-3 rounded-xl border p-3">
              <View className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/30">
                <Icon as={Globe} className="size-5 text-blue-600" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold" numberOfLines={1}>
                  {r.title}
                </Text>
                {r.creator_name ? <Text className="text-muted-foreground mt-0.5 text-xs">{k('byCreator', { name: r.creator_name })}</Text> : null}
              </View>
            </Pressable>
          ))
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
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Icon as={AlertTriangle} className="size-10 text-yellow-500" />
        <Text className="text-lg font-medium">{k('resourceNotFound')}</Text>
      </View>
    );
  }
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: r.title,
          headerRight: () => (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(r.url)} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('openInNewTab')}>
              <Icon as={ExternalLink} className="size-5" />
            </Pressable>
          ),
        }}
      />
      <PublicWebView url={r.url} />
    </View>
  );
}
