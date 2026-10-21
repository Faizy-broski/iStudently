import { router, Stack } from 'expo-router';
import { BookX, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { IconTile, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminTextbooks } from '@/lib/api';
import { useApi } from '@/lib/data';

/** How many students still wait on each textbook, by book and by section (web: /admin/textbooks/dashboard). */
export default function TextbookMissing() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`textbooks.dashboard.${k}`, o);
  const { campusId } = useCampus();
  const res = useApi(['admin', 'textbook-missing', campusId ?? 'school'], () => adminTextbooks.missingSummary(campusId));
  const data = res.data;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('pageTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{d('pageSubtitle')}</Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => router.push('/admin/textbooks/matrix')}>
          <Text>{d('goToMatrix')}</Text>
        </Button>
        {res.isLoading ? (
          <LoadingList />
        ) : res.error || !data ? (
          <ErrorState message={d('loadError')} onRetry={() => res.mutate()} />
        ) : (
          <>
            {!data.by_book.length ? <EmptyState icon={BookX} title={d('noActiveTextbooks')} /> : null}
            <StatTiles>
              {data.by_book.map((b) => (
                <StatTile
                  key={b.book_id}
                  icon={BookX}
                  tone={b.missing_count > 0 ? 'destructive' : 'success'}
                  label={b.grade_level_name ? `${b.title} · ${b.grade_level_name}` : b.title}
                  value={String(b.missing_count)}
                  note={d('missingOf', { count: b.total_students })}
                />
              ))}
            </StatTiles>
            <Section title={d('bySection')}>
              {!data.by_section.length ? (
                <EmptyState icon={Users} title={d('noSections')} />
              ) : (
                <Panel>
                  {data.by_section.map((s, i) => (
                    <RowItem
                      key={s.section_id}
                      leading={<IconTile icon={Users} tone={s.missing_count > 0 ? 'destructive' : 'success'} size={40} />}
                      title={s.section_name}
                      meta={`${d('thStudents')}: ${s.total_students}`}
                      trailing={<StatusChip label={`${d('thMissing')}: ${s.missing_count}`} tone={s.missing_count > 0 ? 'destructive' : 'success'} />}
                      last={i === data.by_section.length - 1}
                    />
                  ))}
                </Panel>
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}
