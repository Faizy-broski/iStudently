import type { AdminMenuItem } from '@studently/shared-types';
import { router } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

import { adminRouteFor, useAdminMenu } from '@/features/admin/menu';
import { MenuList } from '@/features/menu/menu-list';

export function openAdminPage(item: Pick<AdminMenuItem, 'href' | 'title'>) {
  const route = adminRouteFor(item.href);
  if (route) router.push(route);
  else router.push({ pathname: '/admin/module', params: { href: item.href, title: item.title } });
}

/** Admin pages grouped like the web sidebar (see MenuList). */
export function ModuleList(props: { only?: string[]; filter?: (groupTitle: string) => boolean; query?: string; header?: ReactElement; footer?: ReactElement; groupTiles?: boolean; extraTiles?: ReactNode }) {
  const menu = useAdminMenu();
  const { groupTiles, ...rest } = props;
  return (
    <MenuList
      {...rest}
      menu={menu}
      isNative={(href) => !!adminRouteFor(href)}
      onOpen={openAdminPage}
      onOpenGroup={groupTiles ? (g) => router.push({ pathname: '/admin/menu-group', params: { group: g.title } }) : undefined}
    />
  );
}
