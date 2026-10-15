import type { ReactElement } from 'react';

import { MenuList } from '@/features/menu/menu-list';

import { openPortalPage, portalRouteFor, usePortalMenu, type PortalRole } from './menu';

/** This role's web pages grouped like its sidebar (see MenuList). */
export function PortalModuleList({ role, ...props }: { role: PortalRole; only?: string[]; filter?: (groupTitle: string) => boolean; query?: string; header?: ReactElement }) {
  const menu = usePortalMenu(role);
  return <MenuList {...props} menu={menu} isNative={(href) => !!portalRouteFor(role, href)} onOpen={(item) => openPortalPage(role, item)} />;
}
