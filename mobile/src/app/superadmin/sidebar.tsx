import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SidebarEditor } from '@/features/sidebar/sidebar-editor';
import { platform } from '@/lib/api';

/** The super admin's own web sidebar, or a school's (`?schoolId=`; no impersonation). */
export default function SidebarSettings() {
  const { t } = useTranslation();
  const { schoolId, name } = useLocalSearchParams<{ schoolId?: string; name?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: schoolId ? t('app.sb_school_title', { name: name ?? '' }) : t('app.sb_title') }} />
      <SidebarEditor
        cacheKey={['platform', 'sidebar', schoolId ?? 'superadmin']}
        load={() => platform.getSidebarConfig(schoolId)}
        save={(input) => platform.updateSidebarConfig(input, schoolId)}
        reset={() => platform.resetSidebarConfig(schoolId)}
      />
    </>
  );
}
