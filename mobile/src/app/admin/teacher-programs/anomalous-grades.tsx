import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { TeacherCoursePeriodPicker, useTeacherSelection } from '@/features/admin/teacher-programs';
import { adminTeacherPrograms } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const TYPE_CLASS: Record<string, string> = {
  Missing: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  Excused: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  Negative: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  'Exceeds Max': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  'Extra Credit': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
};

/** Missing, excused/negative and over-max grades of one teacher's courses (web: /admin/teacher-programs/anomalous-grades). */
export default function AdminAnomalousGrades() {
  const { t } = useTranslation();
  const a = (k: string) => t(`teacherPrograms.anomalousGrades.${k}`);
  const [sel, setSel] = useTeacherSelection();
  const [allCourses, setAllCourses] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [missing, setMissing] = useState(true);
  const [negative, setNegative] = useState(true);
  const [exceed, setExceed] = useState(true);
  const res = useApi(sel.teacherId ? ['admin', 'tp-anomalous', sel.teacherId, allCourses, inactive, missing, negative, exceed] : null, ([, , staff]) =>
    adminTeacherPrograms.anomalous({ staff_id: staff as string, include_all_courses: allCourses, include_inactive: inactive, missing, negative, exceed_max: exceed, extra_credit: exceed }),
  );
  const rows = res.data ?? [];

  const sw = (label: string, v: boolean, set: (x: boolean) => void) => (
    <View className="flex-row items-center gap-3">
      <Switch checked={v} onCheckedChange={set} />
      <Text className="flex-1 text-sm">{label}</Text>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Card>
          <CardContent className="gap-3 pt-4">
            <TeacherCoursePeriodPicker value={sel} onChange={setSel} />
            {sw(a('includeAllCourses'), allCourses, setAllCourses)}
            {sw(a('includeInactive'), inactive, setInactive)}
            <Text className="text-muted-foreground text-xs">{a('includeLabel')}</Text>
            {sw(a('missingGrades'), missing, setMissing)}
            {sw(a('excusedNegativeGrades'), negative, setNegative)}
            {sw(a('exceedExtraGrades'), exceed, setExceed)}
          </CardContent>
        </Card>
        {!sel.teacherId ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{a('selectPrompt')}</Text>
        ) : res.isLoading ? (
          <LoadingList rows={4} />
        ) : !rows.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{a('noResults')}</Text>
        ) : (
          <Card>
            <CardContent className="py-1">
              {rows.map((r, i) => (
                <View key={`${r.student_id}-${i}`}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-1 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <Text className="flex-1 font-medium">{r.student_name}</Text>
                      <Text className={cn('rounded px-2 py-0.5 text-xs font-medium', TYPE_CLASS[r.anomaly_type])}>{r.anomaly_type}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {r.course_title} · {r.assignment_title} · {r.points_received} / {r.points_possible}
                    </Text>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
