import { router } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

import { MenuList } from '@/features/menu/menu-list';

import { openPortalPage, portalRouteFor, usePortalMenu, type PortalRole } from './menu';

/** This role's web pages grouped like its sidebar (see MenuList). */
export function PortalModuleList({
  role,
  groupTiles,
  ...props
}: {
  role: PortalRole;
  only?: string[];
  filter?: (groupTitle: string) => boolean;
  query?: string;
  header?: ReactElement;
  footer?: ReactElement;
  groupTiles?: boolean;
  extraTiles?: ReactNode;
}) {
  const menu = usePortalMenu(role);
  return (
    <MenuList
      {...props}
      menu={menu}
      isNative={(href) => !!portalRouteFor(role, href)}
      onOpen={(item) => openPortalPage(role, item)}
      onOpenGroup={groupTiles ? (g) => router.push({ pathname: `/${role}/menu-group` as '/student/menu-group', params: { group: g.title } }) : undefined}
    />
  );
}
