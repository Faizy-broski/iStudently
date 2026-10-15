import { Stack } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Report card comment categories and their comments, read-only (web: /teacher/grades/report-card-comments, ReportCardCommentsManager readOnly). */
export default function TeacherReportCardComments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.reportCardComments.${key}`, o);
  const { campusId } = useCampus();
  const cats = useApi(['teacher', 'rc-categories', campusId ?? 'school'], () => adminGrades.rcCategories(campusId));
  const comments = useApi(['teacher', 'rc-comments', campusId ?? 'school'], () => adminGrades.rcComments(campusId));
  const [catId, setCatId] = useState<string>('general');
  const categories = [...(cats.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const countFor = (id: string | null) => (comments.data ?? []).filter((c) => (c.category_id ?? null) === id).length;
  const shown = (comments.data ?? []).filter((c) => (catId === 'general' ? !c.category_id : c.category_id === catId)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([cats.mutate(), comments.mutate()])} />}>
        <Text variant="muted">{k('readOnlySubtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle>{k('categories')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            {cats.isLoading ? (
              <LoadingList rows={3} />
            ) : (
              [{ id: 'general', title: k('general') }, ...categories].map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCatId(c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: catId === c.id }}
                  className={cn('flex-row items-center justify-between rounded-md px-3 py-2', catId === c.id && 'bg-primary/10')}>
                  <Text className={cn('text-sm', catId === c.id && 'font-semibold')}>{c.title}</Text>
                  <Text className="text-muted-foreground text-xs">{k('commentCount', { count: countFor(c.id === 'general' ? null : c.id) })}</Text>
                </Pressable>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-2 pt-4">
            {comments.isLoading ? (
              <LoadingList rows={3} />
            ) : !shown.length ? (
              <View className="items-center py-6">
                <Icon as={MessageSquare} className="text-muted-foreground/40 size-8" />
              </View>
            ) : (
              shown.map((c) => (
                <View key={c.id} className="border-border flex-row items-center gap-3 border-b py-2 last:border-b-0">
                  <Text className="text-muted-foreground w-8 text-xs">{String(c.sort_order ?? '')}</Text>
                  <Text className="flex-1 text-sm">{c.title}</Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
