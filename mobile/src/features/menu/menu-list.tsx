import type { AdminMenuGroup, AdminMenuItem } from '@studently/shared-types';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Tile, TileGrid } from '@/components/app/tile-grid';
import { Text } from '@/components/ui/text';
import { menuIcon } from '@/features/menu/menu-icon';

/** Splits a group's pages at its sub-labels: [{ label?, items }]. */
function chunks(items: AdminMenuItem[]) {
  const out: { label?: string; items: AdminMenuItem[] }[] = [{ items: [] }];
  for (const it of items) {
    if (it.label) out.push({ label: it.title, items: [] });
    else out[out.length - 1].items.push(it);
  }
  return out.filter((c) => c.items.length);
}

export interface MenuState {
  groups: AdminMenuGroup[];
  isLoading: boolean;
  error?: unknown;
  refresh: () => void;
}

/**
 * Web sidebar pages grouped like the sidebar, for any role. `only` limits it to some groups
 * (tab pages); `query` filters by translated title. Shown as tile grids (Figma "More Menu"); pages without
 * a native screen (they open on the website) get a small dot.
 */
export function MenuList({
  menu,
  isNative,
  onOpen,
  only,
  filter,
  query = '',
  header,
  footer,
  onOpenGroup,
  extraTiles,
}: {
  menu: MenuState;
  isNative: (href: string) => boolean;
  onOpen: (item: Pick<AdminMenuItem, 'href' | 'title'>) => void;
  only?: string[];
  /** Extra group filter by group title. */
  filter?: (groupTitle: string) => boolean;
  query?: string;
  header?: ReactElement;
  footer?: ReactElement;
  /** More screen (Figma): one tile per group in a single grid; tapping opens the group's pages. */
  onOpenGroup?: (group: AdminMenuGroup) => void;
  /** Extra tiles at the end of the group grid (Settings, Sign out). */
  extraTiles?: ReactNode;
}) {
  const { t } = useTranslation();
  const { groups, isLoading, error, refresh } = menu;
  const label = (title: string) => t(`sidebar.${title}`, { defaultValue: title.replace(/_/g, ' ') });

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => (!only || only.includes(g.title)) && (!filter || filter(g.title)))
      .map((g: AdminMenuGroup) => {
        const pages = g.items.length > 0 ? g.items : [{ title: g.title, href: g.href }];
        const data = q ? pages.filter((i) => !i.label && (label(i.title).toLowerCase().includes(q) || label(g.title).toLowerCase().includes(q))) : pages;
        return { key: g.title, title: label(g.title), data };
      })
      .filter((s) => s.data.some((i) => !i.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, only, filter, query, t]);

  if (isLoading && groups.length === 0) return <LoadingList rows={8} />;
  if (error && groups.length === 0) return <ErrorState onRetry={refresh} />;

  // Group tiles (More screen, not searching): every sidebar group is one tile, nothing dropped.
  if (onOpenGroup && !query.trim()) {
    const shown = groups.filter((g) => (!only || only.includes(g.title)) && (!filter || filter(g.title)) && (g.items.length === 0 || g.items.some((i) => !i.label)));
    return (
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {header}
        <TileGrid>
          {shown.map((g) => {
            const pages = g.items.length ? g.items.filter((i) => !i.label) : [g];
            return (
              <Tile
                key={g.title}
                icon={menuIcon(g.title)}
                label={label(g.title)}
                dot={pages.every((i) => !isNative(i.href))}
                onPress={() => (g.items.length ? onOpenGroup(g) : onOpen(g))}
              />
            );
          })}
          {extraTiles}
        </TileGrid>
        {footer}
      </ScrollView>
    );
  }

  return (
    <FlatList
      className="flex-1"
      data={sections}
      keyExtractor={(sec) => sec.key}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={<EmptyState title={t('app.ad_no_modules')} body={query ? undefined : t('app.ad_no_modules_body')} />}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
      contentContainerClassName="gap-5 px-4 pb-8"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: section }) => (
        <View className="gap-2.5">
          {sections.length > 1 ? <Text className="text-muted-foreground text-sm font-semibold">{section.title}</Text> : null}
          {/* Sub-labels inside a group start a new grid below them. */}
          {chunks(section.data).map((chunk, ci) => (
            <View key={ci} className="gap-2.5">
              {chunk.label ? <Text className="text-muted-foreground text-xs">{label(chunk.label)}</Text> : null}
              <TileGrid>
                {chunk.items.map((item, i) => (
                  <Tile key={`${item.href}:${i}`} icon={menuIcon(item.title, section.key)} label={label(item.title)} dot={!isNative(item.href)} onPress={() => onOpen(item)} />
                ))}
              </TileGrid>
            </View>
          ))}
        </View>
      )}
    />
  );
}
