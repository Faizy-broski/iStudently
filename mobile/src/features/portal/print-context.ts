import type { PrintSchool } from '@studently/shared-utils';

import { usePortalPlugins } from '@/features/portal/menu';
import { campuses } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Print context for parents and students: the campus details, and the automatic PDF header when the
 * pdf_header_footer plugin is on. The custom layout is admin-only on the backend (the web's call gets 403).
 */
export function usePortalPrintContext(campusId: string | null | undefined) {
  const plugins = usePortalPlugins();
  const campus = useApi(campusId ? ['portal', 'campus', campusId] : null, ([, , c]) => campuses.get(c as string));
  const c = campus.data;
  const school: PrintSchool = {
    name: c?.name ?? '',
    address: c?.address ?? undefined,
    city: c?.city ?? undefined,
    state: c?.state ?? undefined,
    zip_code: c?.zip_code ?? undefined,
    phone: c?.phone ?? undefined,
    contact_email: c?.contact_email ?? undefined,
    logo_url: c?.logo_url ?? null,
  };
  return { school, withHeader: plugins.includes('pdf_header_footer'), layout: null, ready: !campus.isLoading };
}
