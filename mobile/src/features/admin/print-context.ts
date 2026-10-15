import type { PrintSchool } from '@studently/shared-utils';

import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** School details and PDF header/footer settings for printing on the selected campus (same rules as the web). */
export function usePrintContext() {
  const { me } = useSession();
  const { campus, campusId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const withHeader = settings.data?.active_plugins?.pdf_header_footer === true;
  const layout = useApi(withHeader ? ['admin', 'pdf-layout', campusId ?? 'school'] : null, () => adminSchool.getPdfHeaderFooter(campusId));
  const school = me.status === 'ready' ? me.me.school : null;
  const printSchool: PrintSchool = {
    name: campus?.name ?? school?.name ?? '',
    address: campus?.address ?? undefined,
    city: campus?.city ?? undefined,
    state: campus?.state ?? undefined,
    zip_code: campus?.zip_code ?? undefined,
    phone: campus?.phone ?? undefined,
    contact_email: campus?.contact_email ?? undefined,
    logo_url: campus?.logo_url ?? school?.logo_url ?? null,
  };
  return { school: printSchool, withHeader, layout: layout.data ?? null, ready: !settings.isLoading && (!withHeader || !layout.isLoading) };
}
