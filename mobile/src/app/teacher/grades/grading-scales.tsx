import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

/** School-wide grading scales, read-only; tap one for its grades (web: /teacher/grades/grading-scales). */
export default function TeacherGradingScales() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.gradingScales.${key}`);
  const { campusId } = useCampus();
  const scales = useApi(['teacher', 'grading-scales', campusId ?? 'school'], () => adminGrades.scales(campusId));
  const [open, setOpen] = useState<string | null>(null);
  const list = (scales.data ?? []).filter((s) => s.is_active !== false);
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => scales.mutate()} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={Scale} className="size-5 text-[#022172] dark:text-blue-400" />
          <Text variant="muted" className="flex-1">
            {k('pageSubtitle')}
          </Text>
        </View>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k('activeScales')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {scales.isLoading ? (
              <LoadingList rows={3} />
            ) : scales.error ? (
              <Text className="py-4 text-center text-sm text-red-500">{scales.error.message}</Text>
            ) : !list.length ? (
              <Text className="text-muted-foreground py-6 text-center text-sm">{k('noScalesConfigured')}</Text>
            ) : (
              list.map((s) => <ScaleRow key={s.id} id={s.id} title={s.title} isDefault={s.is_default} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />)
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function ScaleRow({ id, title, isDefault, open, onToggle }: { id: string; title: string; isDefault: boolean; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.gradingScales.${key}`);
  const grades = useApi(open ? ['teacher', 'scale-grades', id] : null, ([, , s]) => adminGrades.scaleGrades(s as string));
  const rows = [...(grades.data ?? [])].sort((a, b) => (b.break_off ?? 0) - (a.break_off ?? 0));
  return (
    <View className="border-border overflow-hidden rounded-lg border">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 px-4 py-3">
        <Icon as={open ? ChevronDown : ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
        <Text className="flex-1 font-medium">{title}</Text>
        {isDefault ? (
          <Badge className="bg-blue-100">
            <Text className="text-xs text-blue-700">{k('default')}</Text>
          </Badge>
        ) : null}
        <Text className="text-muted-foreground text-xs">{k('viewGrades')}</Text>
      </Pressable>
      {open ? (
        <View className="border-border bg-muted/40 gap-1 border-t px-4 py-3">
          {grades.isLoading ? (
            <LoadingList rows={2} />
          ) : !rows.length ? (
            <Text className="text-muted-foreground py-2 text-center text-sm">{k('noGradeEntriesDefined')}</Text>
          ) : (
            <>
              <View className="border-border flex-row border-b pb-1">
                <Text className="text-muted-foreground flex-1 text-xs uppercase">{k('letter')}</Text>
                <Text className="text-muted-foreground w-16 text-end text-xs uppercase">{k('minPercent')}</Text>
                <Text className="text-muted-foreground w-14 text-end text-xs uppercase">{k('gpa')}</Text>
              </View>
              {rows.map((g) => (
                <View key={g.id} className="flex-row items-center py-1.5">
                  <View className="flex-1">
                    <Text className="font-semibold text-blue-700 dark:text-blue-400">{g.title}</Text>
                    {g.comment ? <Text className="text-muted-foreground text-xs">{g.comment}</Text> : null}
                  </View>
                  <Text className="w-16 text-end text-sm">{`${g.break_off}%`}</Text>
                  <Text className="w-14 text-end text-sm">{g.gpa_value != null ? Number(g.gpa_value).toFixed(2) : '—'}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
