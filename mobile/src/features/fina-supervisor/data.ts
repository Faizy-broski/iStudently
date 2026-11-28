import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The municipality overview: the dashboard, and the school names for the audit filter and reports. */
export function useSupervisorOverview() {
  return useApi(['fina-supervisor', 'overview'], () => fina.supervisorOverview());
}
