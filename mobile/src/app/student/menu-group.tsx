import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PortalModuleList } from '@/features/portal/portal-module-list';

/** One sidebar group's pages as tiles (opened from a group tile on the More screen). */
export default function StudentMenuGroup() {
  const { t } = useTranslation();
  const { group } = useLocalSearchParams<{ group: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t(`sidebar.${group}`, { defaultValue: group.replace(/_/g, ' ') }) }} />
      <View className="bg-background flex-1 pt-4">
        <PortalModuleList role="student" only={[group]} />
      </View>
    </>
  );
}
