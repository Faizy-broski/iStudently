import type { LearningResource } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlignLeft, BookOpen, ExternalLink, FileText, Link2, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const ICON = { video: Video, link: Link2, book: BookOpen, post: AlignLeft } as const;

/** The section's resources grouped by subject (web: /student/syllabus). */
export default function StudentSyllabus() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_sy_${key}`, o);
  const { me } = useSession();
  const sectionId = me.status === 'ready' ? me.me.profile.section_id : null;
  const data = useApi(sectionId ? ['student', 'syllabus', sectionId] : null, ([, , s]) => learningResources.section(s as string, {}, 1, 200));

  const groups = new Map<string, { name: string; items: LearningResource[] }>();
  for (const r of data.data?.data ?? []) {
    const key = r.subject?.id || 'general';
    const g = groups.get(key) ?? { name: r.subject?.name || k('general'), items: [] };
    g.items.push(r);
    groups.set(key, g);
  }
  const subjects = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {!sectionId ? (
          <EmptyState icon={BookOpen} title={k('no_section')} />
        ) : data.isLoading ? (
          <LoadingList rows={5} />
        ) : subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title={k('empty')} body={k('empty_body')} />
        ) : (
          subjects.map((s) => (
            <Panel key={s.name}>
              <View className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3">
                <IconTile icon={BookOpen} size={40} />
                <Text className="flex-1 text-base font-semibold">{s.name}</Text>
                <StatusChip label={k('items', { count: s.items.length })} tone="info" />
              </View>
              {s.items.map((r, i) => {
                const url = r.url || r.file_urls?.[0];
                return (
                  <View key={r.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < s.items.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <IconTile icon={ICON[r.resource_type as keyof typeof ICON] ?? FileText} tone="muted" size={36} round />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{r.title}</Text>
                      {r.description ? (
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {r.description}
                        </Text>
                      ) : null}
                      <Text className="text-muted-foreground text-[11px]">{formatDate(r.created_at)}</Text>
                    </View>
                    {url ? (
                      <Pressable
                        onPress={() => WebBrowser.openBrowserAsync(url)}
                        hitSlop={4}
                        accessibilityRole="link"
                        accessibilityLabel={k('open', { title: r.title })}
                        className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                        <Icon as={ExternalLink} className="text-brand dark:text-brand-secondary size-4" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Panel>
          ))
        )}
      </ScrollView>
    </>
  );
}
