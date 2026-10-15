import type { AdminMenuGroup, AdminMenuItem } from '@studently/shared-types';
import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, SectionList, View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';

export interface MenuState {
  groups: AdminMenuGroup[];
  isLoading: boolean;
  error?: unknown;
  refresh: () => void;
}

/**
 * Web sidebar pages grouped like the sidebar, for any role. `only` limits it to some groups
 * (tab pages); `query` filters by translated title. Pages without a native screen are marked "Web".
 */
export function MenuList({
  menu,
  isNative,
  onOpen,
  only,
  filter,
  query = '',
  header,
}: {
  menu: MenuState;
  isNative: (href: string) => boolean;
  onOpen: (item: Pick<AdminMenuItem, 'href' | 'title'>) => void;
  only?: string[];
  /** Extra group filter by group title. */
  filter?: (groupTitle: string) => boolean;
  query?: string;
  header?: ReactElement;
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

  return (
    <SectionList
      className="bg-background flex-1"
      sections={sections}
      keyExtractor={(i, k) => `${i.href}:${k}`}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState title={t('app.ad_no_modules')} body={query ? undefined : t('app.ad_no_modules_body')} />}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
      stickySectionHeadersEnabled={false}
      contentContainerClassName="pb-8"
      renderSectionHeader={({ section }) => (
        <Text className="text-muted-foreground px-4 pt-5 pb-2 text-xs font-semibold uppercase">{section.title}</Text>
      )}
      ItemSeparatorComponent={() => <Separator className="ms-4" />}
      renderItem={({ item }) =>
        item.label ? (
          <View className="bg-muted/40 px-4 py-1.5">
            <Text className="text-muted-foreground text-xs">{label(item.title)}</Text>
          </View>
        ) : (
          <ListRow
            title={label(item.title)}
            trailing={
              isNative(item.href) ? undefined : (
                <Badge variant="outline">
                  <Text>{t('app.ad_web_badge')}</Text>
                </Badge>
              )
            }
            onPress={() => onOpen(item)}
          />
        )
      }
    />
  );
}
