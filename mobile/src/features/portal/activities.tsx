import { Stack } from 'expo-router';
import { Calendar, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { StudentActivityEnrollment } from '@studently/api-client';
import { formatDate } from '@/lib/format';

type Res = { data?: StudentActivityEnrollment[]; isLoading: boolean; mutate: () => unknown };

/** Activities a student is enrolled in (web: /student and /parent activities); `text` overrides the copy for parents. */
export function ActivitiesView({ data, text }: { data: Res; text?: { title: string; subtitle: string; emptyBody: string } }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ac_${key}`, o);

  if (data.isLoading) return <LoadingList rows={4} />;
  const list = (data.data ?? []).filter((e) => e.activity);
  return (
    <>
      <Stack.Screen options={{ title: text?.title ?? k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {text?.subtitle ?? k('subtitle')}
        </Text>
        {list.length === 0 ? (
          <EmptyState icon={Star} title={k('empty')} body={text?.emptyBody ?? k('empty_body')} />
        ) : (
          list.map((e) => {
            const a = e.activity!;
            return (
              <Panel key={e.id} className="gap-2 p-4">
                <View className="flex-row items-center gap-3">
                  <IconTile icon={Star} tone="warning" size={40} />
                  <Text className="flex-1 text-sm font-semibold">{a.title}</Text>
                  <StatusChip label={a.is_active ? k('active') : k('inactive')} tone={a.is_active ? 'success' : 'muted'} />
                </View>
                  {a.start_date || a.end_date ? (
                    <View className="flex-row items-center gap-2">
                      <Icon as={Calendar} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-xs">{[a.start_date && formatDate(a.start_date), a.end_date && formatDate(a.end_date)].filter(Boolean).join(' – ')}</Text>
                    </View>
                  ) : null}
                  {a.comment ? <Text className="text-muted-foreground text-sm">{a.comment}</Text> : null}
                  <Text className="text-muted-foreground text-xs">{k('enrolled', { date: formatDate(e.created_at) })}</Text>
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
