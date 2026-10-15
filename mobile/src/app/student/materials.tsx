import type { LearningResource, LearningResourceType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle, AlignLeft, BookOpen, Dna, ExternalLink, FileText, FolderOpen, Link2, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TYPES: Record<LearningResourceType, { icon: LucideIcon; tone: string }> = {
  link: { icon: Link2, tone: 'bg-blue-100 text-blue-700' },
  book: { icon: BookOpen, tone: 'bg-amber-100 text-amber-700' },
  post: { icon: AlignLeft, tone: 'bg-purple-100 text-purple-700' },
  file: { icon: FileText, tone: 'bg-green-100 text-green-700' },
  video: { icon: Video, tone: 'bg-red-100 text-red-700' },
  anatomy: { icon: Dna, tone: 'bg-teal-100 text-teal-700' },
};

/** The section's materials with search and type filter (web: /student/materials). */
export default function StudentMaterials() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_mt_${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const sectionId = me.status === 'ready' ? me.me.profile.section_id : null;
  const studentId = me.status === 'ready' ? me.me.profile.student_id : null;
  const data = useApi(sectionId ? ['student', 'materials', sectionId] : null, ([, , s]) => learningResources.section(s as string, {}, 1, 100));
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');

  const all = data.data?.data ?? [];
  const q = search.toLowerCase();
  const shown = all.filter((r) => (!q || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.subject?.name.toLowerCase().includes(q)) && (type === 'all' || r.resource_type === type));

  function open(r: LearningResource) {
    if (studentId) learningResources.recordView(r.id, studentId);
    if (r.resource_type === 'anatomy' && r.content) return router.push({ pathname: '/student/web', params: { path: '/student/materials', title: 'learning_materials' } });
    const url = r.url || r.file_urls?.[0];
    if (url) WebBrowser.openBrowserAsync(url);
    else if (r.content) toast.info(r.content.slice(0, 200));
    else toast.info(k('no_link'));
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('search')} />
        <Picker value={type} onChange={setType} options={[{ value: 'all', label: t('app.lr_all_types') }, ...(Object.keys(TYPES) as LearningResourceType[]).map((x) => ({ value: x, label: t(`app.lr_type_${x}`) }))]} />
        {data.isLoading ? (
          <LoadingList rows={5} />
        ) : data.error ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={AlertCircle} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{k('failed')}</Text>
            </CardContent>
          </Card>
        ) : !sectionId ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={FolderOpen} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{t('app.st_sy_no_section')}</Text>
            </CardContent>
          </Card>
        ) : shown.length === 0 ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={FolderOpen} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground font-medium">{all.length === 0 ? k('none') : k('no_results')}</Text>
              <Text className="text-muted-foreground mt-1 text-sm">{all.length === 0 ? k('none_body') : k('no_results_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          shown.map((r) => {
            const c = TYPES[r.resource_type] ?? { icon: FileText, tone: 'bg-gray-100 text-gray-700' };
            const hasLink = !!(r.url || r.file_urls?.[0]);
            return (
              <Card key={r.id} className={cn('py-3', r.is_pinned && 'border-primary/40')}>
                <CardContent className="gap-2 px-3">
                  <View className="flex-row items-start gap-3">
                    <View className={cn('rounded-lg p-2', c.tone)}>
                      <Icon as={c.icon} className={cn('size-4', c.tone)} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{r.title}</Text>
                      {r.subject ? <Text className="text-muted-foreground mt-0.5 text-xs">{r.subject.name}</Text> : null}
                    </View>
                    {r.is_pinned ? (
                      <Badge variant="outline">
                        <Text className="text-xs">{k('pinned')}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  {r.description ? (
                    <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                      {r.description}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted-foreground text-xs">{formatDate(r.created_at)}</Text>
                    <Button size="sm" variant={hasLink ? 'default' : 'outline'} onPress={() => open(r)}>
                      <Icon as={ExternalLink} className={cn('size-3', hasLink ? 'text-primary-foreground' : '')} />
                      <Text className="text-xs">{r.resource_type === 'video' ? k('watch') : r.resource_type === 'anatomy' ? k('explore') : hasLink ? k('open') : k('view')}</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
        {!data.isLoading && all.length ? <Text className="text-muted-foreground text-center text-xs">{k('showing', { shown: shown.length, total: all.length })}</Text> : null}
      </ScrollView>
    </>
  );
}
