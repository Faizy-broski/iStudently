import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { PageCard } from '@/features/pages/page-card';
import { readingLogs } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Custom pages the school targets at teachers: links, embeds, text and images (web: /teacher/school-pages). */
export default function TeacherSchoolPages() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.schoolPages.${key}`);
  const res = useApi(['teacher', 'school-pages'], () => readingLogs.myPages());
  const pages = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('pageDescription')}</Text>
        {res.isLoading ? <LoadingList rows={3} /> : !pages.length ? <Text className="text-muted-foreground py-16 text-center text-sm">{k('noPagesYet')}</Text> : pages.map((p) => <PageCard key={p.id} page={p} />)}
      </ScrollView>
    </>
  );
}
