import type { FinaPost } from '@studently/api-client';
import { router, Stack, type Href } from 'expo-router';
import { Newspaper, PenSquare } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ClassGoals, isFinaKey, NotificationBell, PostCard, StoriesBar, useFinaViewer, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { useRoleBase } from '@/features/portal/role-base';

/** The wall: pinned first, then newest; search, stories, class goals, load more (web: /admin/fina/wall). */
export function FinaWallScreen({ canCompose, notificationsHref }: { canCompose: boolean; notificationsHref: Href }) {
  const roleBase = useRoleBase();
  const { f, a } = useFn('wall');
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { role } = useFinaViewer();
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 400);
  const first = useApi(['admin', 'fina-wall', term, campusId ?? 'school'], ([, , s]) => fina.wall(campusId, { q: (s as string) || undefined }));
  // Later pages, appended below the first; dropped when the search or campus changes.
  const [more, setMore] = useState<{
    key: string;
    posts: FinaPost[];
    cursor: string | null;
  }>({ key: '', posts: [], cursor: null });
  const [removed, setRemoved] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageKey = `${term}|${campusId ?? ''}|${first.data?.nextCursor ?? ''}`;
  const extra = more.key === pageKey ? more : { key: pageKey, posts: [], cursor: first.data?.nextCursor ?? null };
  const posts = [...(first.data?.posts ?? []), ...extra.posts].filter((p) => !removed.includes(p.id));

  async function loadMore() {
    if (!extra.cursor) return;
    setLoadingMore(true);
    try {
      const r = await fina.wall(campusId, {
        cursor: extra.cursor,
        q: term || undefined,
      });
      if (!r.success || !r.data) return toast.error(r.error || '');
      setMore({
        key: pageKey,
        posts: [...extra.posts, ...r.data.posts],
        cursor: r.data.nextCursor,
      });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: a('fn_wall'),
          headerRight: () => (
            <View className="flex-row items-center gap-3">
              {canCompose ? (
                <Pressable onPress={() => router.push(roleBase.href('/fina/compose'))} hitSlop={8} className="p-1" accessibilityLabel={a('fn_compose')}>
                  <Icon as={PenSquare} className="text-foreground size-5" />
                </Pressable>
              ) : null}
              <NotificationBell href={notificationsHref} />
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              setMore({ key: '', posts: [], cursor: null });
              setRemoved([]);
              mutate(isFinaKey);
            }}
          />
        }>
        <SearchBar value={q} onChangeText={setQ} placeholder={f('search_placeholder')} />
        <StoriesBar />
        {role === 'teacher' || role === 'admin' ? <ClassGoals /> : null}
        {first.isLoading ? (
          <LoadingList rows={3} />
        ) : first.error ? (
          <ErrorState message={first.error.message} onRetry={() => first.mutate()} />
        ) : !posts.length ? (
          <EmptyState icon={Newspaper} title={term ? f('no_search_results') : f('empty_wall')} />
        ) : (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDeleted={(id) => setRemoved((r) => [...r, id])} />
            ))}
            {extra.cursor ? (
              <Button variant="outline" onPress={loadMore} disabled={loadingMore}>
                <Text>{f('load_more')}</Text>
              </Button>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
