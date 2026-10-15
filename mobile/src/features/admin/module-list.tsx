import type { AdminMenuItem } from '@studently/shared-types';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { NATIVE_ROUTES, useAdminMenu } from '@/features/admin/menu';
import { MenuList } from '@/features/menu/menu-list';

export function openAdminPage(item: Pick<AdminMenuItem, 'href' | 'title'>) {
  const route = NATIVE_ROUTES[item.href];
  if (route) router.push(route);
  else router.push({ pathname: '/admin/module', params: { href: item.href, title: item.title } });
}

/** Admin pages grouped like the web sidebar (see MenuList). */
export function ModuleList(props: { only?: string[]; filter?: (groupTitle: string) => boolean; query?: string; header?: ReactElement }) {
  const menu = useAdminMenu();
  return <MenuList {...props} menu={menu} isNative={(href) => !!NATIVE_ROUTES[href]} onOpen={openAdminPage} />;
}
