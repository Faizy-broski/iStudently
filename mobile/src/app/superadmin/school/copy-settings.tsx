import { useLocalSearchParams } from 'expo-router';

import { CopySettingsScreen } from '@/features/school/copy-settings-screen';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Copy setup from another school into this one (super admin: any school as the source). */
export default function CopySettings() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  return <CopySettingsScreen id={id} name={name} schools={schools} />;
}
