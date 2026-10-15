import { View } from 'react-native';

import { ChildSwitcher } from '@/features/parent/child';
import { PARENT_TAB_GROUPS } from '@/features/portal/parent-tabs';
import { PortalModuleList } from '@/features/portal/portal-module-list';

export default function ParentBilling() {
  return (
    <View className="bg-background flex-1">
      <ChildSwitcher className="mx-4 mt-3" />
      <PortalModuleList role="parent" only={PARENT_TAB_GROUPS.billing} />
    </View>
  );
}
