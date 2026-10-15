import { View } from 'react-native';

import { PortalModuleList } from '@/features/portal/portal-module-list';
import { TEACHER_TAB_GROUPS } from '@/features/portal/teacher-tabs';

export default function TeacherStudents() {
  return (
    <View className="bg-background flex-1">
      <PortalModuleList role="teacher" only={TEACHER_TAB_GROUPS.students} />
    </View>
  );
}
