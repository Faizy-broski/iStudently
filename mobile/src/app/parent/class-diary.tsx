import { Stack } from 'expo-router';
import { BookOpen, MessageSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

const fullDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** Daily notes from the selected child's teachers (web: /parent/class-diary). */
export default function ParentClassDiary() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_cd_${key}`, o);
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'class-diary', childId] : null, ([, , id]) => parent.getStudentClassDiary(id as string));

  if (!childId) return <NoChild />;
  const list = Array.isArray(data.data) ? data.data : [];
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {data.isLoading ? (
          <LoadingList rows={4} />
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="items-center py-14">
              <Icon as={BookOpen} className="text-muted-foreground/40 mb-3 size-12" />
              <Text className="text-muted-foreground font-medium">{k('empty')}</Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">{k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            {list.map((e) => {
              const tp = e.teacher?.profile;
              return (
                <Card key={e.id}>
                  <CardContent className="gap-3 p-4">
                    <View className="flex-row items-start gap-2">
                      <Icon as={BookOpen} className="text-primary mt-0.5 size-5" />
                      <View className="flex-1">
                        <Text className="font-semibold">{fullDate(e.diary_date)}</Text>
                        <Text className="text-muted-foreground text-xs">{k('by', { name: tp ? `${tp.first_name} ${tp.last_name}` : k('teacher') })}</Text>
                      </View>
                    </View>
                    {e.is_published || e.enable_comments ? (
                      <View className="flex-row flex-wrap gap-2">
                        {e.is_published ? (
                          <Badge variant="outline">
                            <Text className="text-xs">{k('published')}</Text>
                          </Badge>
                        ) : null}
                        {e.enable_comments ? (
                          <Badge variant="secondary" className="flex-row items-center gap-1">
                            <Icon as={MessageSquare} className="text-foreground size-3" />
                            <Text className="text-xs">{k('comments_on')}</Text>
                          </Badge>
                        ) : null}
                      </View>
                    ) : null}
                    <Text className="text-muted-foreground text-sm leading-relaxed">{e.content}</Text>
                  </CardContent>
                </Card>
              );
            })}
            <Text className="text-muted-foreground text-center text-xs">{k('showing', { count: list.length })}</Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
