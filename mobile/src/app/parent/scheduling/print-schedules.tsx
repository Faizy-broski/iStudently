import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalAcademic } from '@/features/portal/academic';
import { usePortalPrintContext } from '@/features/portal/print-context';
import { PrintSchedulesView } from '@/features/scheduling/print-schedules';

/** The selected child's weekly schedule as a printable grid or list (web: /parent/scheduling/print-schedules). */
export default function ParentPrintSchedules() {
  const { t } = useTranslation();
  const s = (k: string) => t(`school.scheduling.student_schedule.${k}`);
  const { child } = useChild();
  const academic = usePortalAcademic();
  const ctx = usePortalPrintContext(child?.campus_id);
  if (!child) return <NoChild />;
  const name = `${child.first_name} ${child.last_name}`;
  return (
    <PrintSchedulesView
      ctx={ctx}
      campusId={child.campus_id}
      yearId={academic.year?.id ?? null}
      chosen={() => [{ id: child.id, name, number: child.student_number, grade: child.grade_level || null }]}
      list={
        <View className="gap-2">
          <Text className="text-sm font-semibold">{t('common.found_students', { count: 1 })}</Text>
          <Card>
            <CardContent className="gap-1 p-4">
              <Text className="font-medium">{name}</Text>
              <Text className="text-muted-foreground text-xs">{`${s('th_student_number')}: ${child.student_number}`}</Text>
              <Text className="text-muted-foreground text-xs">{`${s('th_grade_level')}: ${child.grade_level || '—'}`}</Text>
            </CardContent>
          </Card>
        </View>
      }
    />
  );
}
