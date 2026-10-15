import { useLocalSearchParams } from 'expo-router';

import { CopySettingsScreen } from '@/features/school/copy-settings-screen';
import { campuses } from '@/lib/api';
import { useApi } from '@/lib/data';

/** After adding a campus: copy setup from the school or another campus (web: CopySchoolSettingsDialog). */
export default function AdminCopySettings() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const schools = useApi(['admin', 'my-schools'], () => campuses.mySchools());
  return <CopySettingsScreen id={id} name={name} schools={schools} />;
}
