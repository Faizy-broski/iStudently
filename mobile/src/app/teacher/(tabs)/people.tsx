import { View } from 'react-native';

import { PortalModuleList } from '@/features/portal/portal-module-list';
import { TEACHER_TAB_GROUPS } from '@/features/portal/teacher-tabs';

// Students tab (students, scheduling, discipline, activities). Its own URL so /teacher/students stays the students list (web).
export default function TeacherStudentsTab() {
  return (
    <View className="bg-background flex-1">
      <PortalModuleList role="teacher" only={TEACHER_TAB_GROUPS.students} />
    </View>
  );
}
