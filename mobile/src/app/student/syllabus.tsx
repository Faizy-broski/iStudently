import type { LearningResource } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlignLeft, BookOpen, ExternalLink, FileText, Link2, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {!sectionId ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={BookOpen} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{k('no_section')}</Text>
            </CardContent>
          </Card>
        ) : data.isLoading ? (
          <LoadingList rows={5} />
        ) : subjects.length === 0 ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={BookOpen} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground font-medium">{k('empty')}</Text>
              <Text className="text-muted-foreground mt-1 text-sm">{k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          subjects.map((s) => (
            <Card key={s.name}>
              <CardHeader className="flex-row flex-wrap items-center gap-2">
                <Icon as={BookOpen} className="text-primary size-4" />
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="secondary">
                  <Text className="text-xs">{k('items', { count: s.items.length })}</Text>
                </Badge>
              </CardHeader>
              <CardContent className="gap-2">
                {s.items.map((r) => {
                  const url = r.url || r.file_urls?.[0];
                  return (
                    <View key={r.id} className="border-border flex-row items-start gap-3 rounded-lg border p-3">
                      <Icon as={ICON[r.resource_type as keyof typeof ICON] ?? FileText} className="text-muted-foreground mt-0.5 size-4" />
                      <View className="flex-1">
                        <Text className="text-sm font-medium">{r.title}</Text>
                        {r.description ? (
                          <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={1}>
                            {r.description}
                          </Text>
                        ) : null}
                        <Text className="text-muted-foreground mt-0.5 text-xs">{formatDate(r.created_at)}</Text>
                      </View>
                      {url ? (
                        <Pressable onPress={() => WebBrowser.openBrowserAsync(url)} hitSlop={8} accessibilityRole="link" accessibilityLabel={k('open', { title: r.title })}>
                          <Icon as={ExternalLink} className="size-4" />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
