import { Stack } from 'expo-router';
import { Check, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
        <Text className="text-muted-foreground text-sm">{k('readOnlySubtitle')}</Text>
        <Section title={k('categories')}>
          {cats.isLoading ? (
            <LoadingList rows={3} />
          ) : (
            <Panel>
              {[{ id: 'general', title: k('general') }, ...categories].map((c, i, arr) => {
                const on = catId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCatId(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < arr.length - 1 && 'border-info-soft dark:border-border border-b', on && 'bg-info-soft', i === 0 && 'rounded-t-2xl', i === arr.length - 1 && 'rounded-b-2xl')}>
                    <Text className={cn('flex-1 text-sm', on ? 'text-brand dark:text-brand-secondary font-semibold' : 'font-medium')}>{c.title}</Text>
                    <StatusChip label={k('commentCount', { count: countFor(c.id === 'general' ? null : c.id) })} tone={on ? 'info' : 'muted'} />
                    {on ? <Icon as={Check} className="text-brand dark:text-brand-secondary size-4" /> : null}
                  </Pressable>
                );
              })}
            </Panel>
          )}
        </Section>
        {comments.isLoading ? (
          <LoadingList rows={3} />
        ) : !shown.length ? (
          <EmptyState icon={MessageSquare} title={k('commentCount', { count: 0 })} />
        ) : (
          <Panel>
            {shown.map((c, i) => (
              <View key={c.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < shown.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <View className="bg-info-soft size-8 items-center justify-center rounded-full">
                  <Text className="text-brand dark:text-brand-secondary text-xs font-bold">{String(c.sort_order ?? '')}</Text>
                </View>
                <Text className="flex-1 text-sm">{c.title}</Text>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
