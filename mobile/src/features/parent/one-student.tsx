import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { useChild } from '@/features/parent/child';

type Child = NonNullable<ReturnType<typeof useChild>['child']>;

/** Web parent report pages: "1 student selected." with the child's name, number and grade level. */
export function OneStudentCard({ child }: { child: Child }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-brand-secondary">{t('app.pa_one_student')}</Text>
      <Card>
        <CardContent className="gap-1 p-4">
          <Text className="text-sm font-semibold">{`${child.first_name} ${child.last_name}`}</Text>
          <Text className="text-muted-foreground text-xs">{`${t('app.pa_si_id')}: ${child.student_number || '—'} · ${t('app.pa_si_grade')}: ${child.grade_level || '—'}`}</Text>
        </CardContent>
      </Card>
    </View>
  );
}
