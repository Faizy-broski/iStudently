import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Whether a plugin is on for the selected campus (same source as the admin menu). */
export function usePluginActive(pluginId: string) {
  const { me } = useSession();
  const { campusId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const fromSettings = settings.data?.active_plugins;
  if (fromSettings) return !!fromSettings[pluginId];
  return me.status === 'ready' ? me.me.plugins.includes(pluginId) : false;
}
