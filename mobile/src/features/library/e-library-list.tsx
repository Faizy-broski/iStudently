import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { BookOpen, BookText } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLibraryCategories } from '@/features/admin/library';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const MAX_FEATURED = 10;

/** Digital books by category and subcategory (web: ELibraryContent). Tapping a book opens `readerPath`. */
export function ELibraryList({ readerPath }: { readerPath: '/admin/library/e-library/[bookId]' | '/student/e-library/[bookId]' | '/librarian/e-library/[bookId]' }) {
  const { t } = useTranslation();
  const books = useApi(['admin', 'library-elibrary'], () => adminLibrary.eLibrary());
  const cats = useLibraryCategories();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);

  const all = useMemo(() => [...(cats.data ?? [])].sort((a, b) => a.sort_order - b.sort_order), [cats.data]);
  // The school's own top-level categories plus at most 10 featured global ones.
  const chips = useMemo(() => {
    const local = all.filter((c) => !c.parent_category_id && !c.is_global);
    const featured = all
      .filter((c) => !c.parent_category_id && c.is_global && c.is_featured)
      .sort((a, b) => (a.featured_order ?? 0) - (b.featured_order ?? 0))
      .slice(0, MAX_FEATURED);
    return [...local, ...featured].sort((a, b) => a.sort_order - b.sort_order);
  }, [all]);
  const subs = active ? all.filter((c) => c.parent_category_id === active) : [];

  const q = query.trim().toLowerCase();
  let list = books.data ?? [];
  if (sub) list = list.filter((b) => b.category_id === sub);
  else if (active) {
    const ids = new Set([active, ...subs.map((c) => c.id)]);
    list = list.filter((b) => !!b.category_id && ids.has(b.category_id));
  }
  if (q) list = list.filter((b) => b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));

  const pick = (id: string | null) => {
    setActive(id);
    setSub(null);
  };
  const pill = (label: string, on: boolean, onPress: () => void, small = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className={cn('rounded-full border active:opacity-70', small ? 'px-3 py-1' : 'px-3.5 py-1.5', on ? 'bg-brand border-brand dark:bg-brand-secondary dark:border-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
      <Text className={cn('font-semibold', small ? 'text-xs' : 'text-[13px]', on ? 'text-white' : 'text-muted-foreground')}>{label}</Text>
    </Pressable>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.lb_elibrary') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => books.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{t('app.lb_elibrary_subtitle')}</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('app.lb_search_title_author')} />
        {chips.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {chips.map((c) => pill(c.name, active === c.id, () => pick(active === c.id ? null : c.id)))}
          </ScrollView>
        ) : null}
        {active && subs.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {pill(t('app.lb_all_in_category'), !sub, () => setSub(null), true)}
            {subs.map((c) => pill(c.name, sub === c.id, () => setSub(sub === c.id ? null : c.id), true))}
          </ScrollView>
        ) : null}
        {active ? (
          <Text className="text-muted-foreground text-sm">
            {t('app.lb_showing_in', { name: (sub ? subs.find((c) => c.id === sub) : chips.find((c) => c.id === active))?.name ?? '', count: list.length })}
          </Text>
        ) : null}
        {books.isLoading ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState
            icon={BookText}
            title={q || active ? t('app.lb_no_match') : t('app.lb_no_digital')}
            actionLabel={q || active ? t('app.lb_clear_filters') : undefined}
            onAction={
              q || active
                ? () => {
                    setQuery('');
                    pick(null);
                  }
                : undefined
            }
          />
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {list.map((b) => {
              const initials = (b.title ?? '?')
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('');
              return (
                <Pressable key={b.id} onPress={() => router.push({ pathname: readerPath, params: { bookId: b.id as string } })} className="w-[47%] gap-1.5 active:opacity-80">
                  <View className="bg-info-soft border-info-soft dark:border-border aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border">
                    {b.cover_image_url ? (
                      <Image source={{ uri: b.cover_image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <>
                        <Text className="text-brand dark:text-brand-secondary text-2xl font-bold">{initials}</Text>
                        <Icon as={BookOpen} className="text-brand dark:text-brand-secondary mt-1 size-5" />
                      </>
                    )}
                    {b.document_type && b.document_type !== 'book' ? (
                      <View className="absolute end-2 top-2">
                        <StatusChip label={b.document_type} tone="info" />
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-sm font-semibold" numberOfLines={2}>
                    {b.title}
                  </Text>
                  <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {b.author}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
