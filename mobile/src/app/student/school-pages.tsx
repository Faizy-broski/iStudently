import { Stack } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { PageCard } from '@/features/pages/page-card';
import { readingLogs } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Custom pages the school targets at students: links, embeds, text and images (web: /student/school-pages). */
export default function StudentSchoolPages() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_sp_${key}`);
  const res = useApi(['student', 'school-pages'], () => readingLogs.myPages());
  const pages = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('subtitle')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error && !pages.length ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !pages.length ? (
          <EmptyState icon={FileText} title={k('empty')} />
        ) : (
          pages.map((p) => <PageCard key={p.id} page={p} />)
        )}
      </ScrollView>
    </>
  );
}
