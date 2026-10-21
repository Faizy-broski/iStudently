import type { LearningResource, LearningResourceType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle, AlignLeft, BookOpen, Dna, ExternalLink, FileText, FolderOpen, Link2, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const TYPES: Record<LearningResourceType, { icon: LucideIcon; tone: string }> = {
  link: { icon: Link2, tone: 'bg-info-soft text-brand dark:text-brand-secondary' },
  book: { icon: BookOpen, tone: 'bg-warning-soft text-warning' },
  post: { icon: AlignLeft, tone: 'bg-chart-6/15 text-chart-6' },
  file: { icon: FileText, tone: 'bg-success-soft text-success' },
  video: { icon: Video, tone: 'bg-destructive-soft text-destructive' },
  anatomy: { icon: Dna, tone: 'bg-success-soft text-success' },
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('search')} />
        <FilterChips value={type} onChange={setType} options={[{ value: 'all', label: t('app.lr_all_types') }, ...(Object.keys(TYPES) as LearningResourceType[]).map((x) => ({ value: x, label: t(`app.lr_type_${x}`) }))]} />
        {data.isLoading ? (
          <LoadingList rows={5} />
        ) : data.error ? (
          <EmptyState icon={AlertCircle} title={k('failed')} />
        ) : !sectionId ? (
          <EmptyState icon={FolderOpen} title={t('app.st_sy_no_section')} />
        ) : shown.length === 0 ? (
          <EmptyState icon={FolderOpen} title={all.length === 0 ? k('none') : k('no_results')} body={all.length === 0 ? k('none_body') : k('no_results_body')} />
        ) : (
          shown.map((r) => {
            const c = TYPES[r.resource_type] ?? { icon: FileText, tone: 'bg-muted text-foreground' };
            const hasLink = !!(r.url || r.file_urls?.[0]);
            return (
              <Panel key={r.id} className={cn('gap-2 p-4', r.is_pinned && 'border-brand-secondary bg-info-soft')}>
                <View className="flex-row items-start gap-3">
                  <View className={cn('size-10 items-center justify-center rounded-xl', c.tone)}>
                    <Icon as={c.icon} strokeWidth={2.2} className={cn('size-4', c.tone)} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{r.title}</Text>
                    {r.subject ? <Text className="text-muted-foreground text-xs">{r.subject.name}</Text> : null}
                  </View>
                  {r.is_pinned ? <StatusChip label={k('pinned')} tone="info" /> : null}
                </View>
                {r.description ? (
                  <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                    {r.description}
                  </Text>
                ) : null}
                <View className="border-info-soft dark:border-border flex-row items-center justify-between border-t pt-2">
                  <Text className="text-muted-foreground text-xs">{formatDate(r.created_at)}</Text>
                  <Button size="sm" variant={hasLink ? 'default' : 'outline'} onPress={() => open(r)}>
                    <Icon as={ExternalLink} className={cn('size-3', hasLink ? 'text-primary-foreground' : '')} />
                    <Text className="text-xs">{r.resource_type === 'video' ? k('watch') : r.resource_type === 'anatomy' ? k('explore') : hasLink ? k('open') : k('view')}</Text>
                  </Button>
                </View>
              </Panel>
            );
          })
        )}
        {!data.isLoading && all.length ? <Text className="text-muted-foreground text-center text-xs">{k('showing', { shown: shown.length, total: all.length })}</Text> : null}
      </ScrollView>
    </>
  );
}
