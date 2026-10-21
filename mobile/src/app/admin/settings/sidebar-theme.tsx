import { Stack, useLocalSearchParams } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { SidebarEditor } from '@/features/sidebar/sidebar-editor';
import { adminSchool } from '@/lib/api';

/**
 * Web sidebar theme for the school, or one campus (`?campusId=`, or the selected campus when the
 * school has branches) (web: /admin/settings/sidebar-theme and the campus sidebar button).
 */
export default function SidebarTheme() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ campusId?: string; name?: string }>();
  const { me } = useSession();
  const { campus, canSwitch } = useCampus();
  const schoolId = me.status === 'ready' ? me.me.profile.school_id ?? '' : '';
  const campusId = params.campusId || (canSwitch && campus && campus.parent_school_id ? campus.id : null);
  const campusName = params.name || (campusId ? campus?.name : null);
  return (
    <>
      <Stack.Screen options={{ title: t('app.cmp_theme_title') }} />
      <SidebarEditor
        cacheKey={['admin', 'sidebar-config', schoolId, campusId ?? 'school']}
        load={() => adminSchool.sidebarConfig(schoolId, campusId)}
        save={(input) => adminSchool.updateSidebarConfig(schoolId, campusId, input)}
        reset={() => adminSchool.resetSidebarConfig(schoolId, campusId)}
        header={
          <View className="flex-row gap-2 rounded-xl border border-info-soft bg-info-soft p-3">
            <Icon as={Info} className="size-4 text-brand dark:text-brand-secondary" />
            <Text className="flex-1 text-sm text-brand dark:text-brand-secondary ">{campusId ? t('app.cmp_theme_campus', { name: campusName ?? '' }) : t('app.cmp_theme_school')}</Text>
          </View>
        }
      />
    </>
  );
}
