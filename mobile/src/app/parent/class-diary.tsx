import { Stack } from 'expo-router';
import { BookOpen, MessageSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
          <EmptyState icon={BookOpen} title={k('empty')} body={k('empty_body')} />
        ) : (
          <>
            {list.map((e) => {
              const tp = e.teacher?.profile;
              return (
                <Panel key={e.id} className="gap-3 p-4">
                  <View className="flex-row items-center gap-3">
                    <IconTile icon={BookOpen} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{fullDate(e.diary_date)}</Text>
                      <Text className="text-muted-foreground text-xs">{k('by', { name: tp ? `${tp.first_name} ${tp.last_name}` : k('teacher') })}</Text>
                    </View>
                  </View>
                  {e.is_published || e.enable_comments ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {e.is_published ? <StatusChip label={k('published')} tone="success" /> : null}
                      {e.enable_comments ? (
                        <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                          <Icon as={MessageSquare} className="text-brand dark:text-brand-secondary size-3" />
                          <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{k('comments_on')}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <Text className="text-muted-foreground text-sm leading-relaxed">{e.content}</Text>
                </Panel>
              );
            })}
            <Text className="text-muted-foreground text-center text-xs">{k('showing', { count: list.length })}</Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
