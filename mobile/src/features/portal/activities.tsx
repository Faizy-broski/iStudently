import { Stack } from 'expo-router';
import { Calendar, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Text variant="muted">{text?.subtitle ?? k('subtitle')}</Text>
        {list.length === 0 ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Star} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-lg font-semibold">{k('empty')}</Text>
              <Text className="text-muted-foreground mt-1 text-center">{text?.emptyBody ?? k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((e) => {
            const a = e.activity!;
            return (
              <Card key={e.id}>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Icon as={Star} className="size-4 text-yellow-500" />
                    <CardTitle className="flex-1 text-base">{a.title}</CardTitle>
                  </View>
                  <Badge variant={a.is_active ? 'default' : 'secondary'}>
                    <Text>{a.is_active ? k('active') : k('inactive')}</Text>
                  </Badge>
                </CardHeader>
                <CardContent className="gap-2">
                  {a.start_date || a.end_date ? (
                    <View className="flex-row items-center gap-2">
                      <Icon as={Calendar} className="text-muted-foreground size-4" />
                      <Text className="text-muted-foreground text-sm">{[a.start_date && formatDate(a.start_date), a.end_date && formatDate(a.end_date)].filter(Boolean).join(' – ')}</Text>
                    </View>
                  ) : null}
                  {a.comment ? <Text className="text-muted-foreground text-sm">{a.comment}</Text> : null}
                  <Text className="text-muted-foreground text-xs">{k('enrolled', { date: formatDate(e.created_at) })}</Text>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
