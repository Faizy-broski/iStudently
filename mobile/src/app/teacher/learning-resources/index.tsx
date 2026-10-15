import type { LearningResource, LearningResourceType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, ChevronsLeft, ChevronsRight, Dna, Edit, ExternalLink, Eye, EyeOff, FileText, Link2, Paperclip, Pin, PinOff, Plus, Trash2, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
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
import { learningResources, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const PER_PAGE = 10;
const LR_TYPES: Record<LearningResourceType, { icon: LucideIcon; tone: string; key: string }> = {
  link: { icon: Link2, tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', key: 'typeLink' },
  book: { icon: BookOpen, tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', key: 'typeBook' },
  post: { icon: FileText, tone: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', key: 'typePost' },
  file: { icon: Paperclip, tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', key: 'typeFile' },
  video: { icon: Video, tone: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', key: 'typeVideo' },
  anatomy: { icon: Dna, tone: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200', key: 'typeAnatomy' },
};

/** Resources the teacher shares with their sections: search, section / type filters, pages, share, edit, pin, publish, delete (web: /teacher/learning-resources). */
export default function TeacherLearningResources() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.learningResources.${key}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 300);
  const [section, setSection] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const subjects = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  const sections = [...new Map((subjects.data ?? []).filter((a) => a.section).map((a) => [a.section!.id, `${a.section!.grade_level?.name ? `${a.section!.grade_level.name} - ` : ''}${a.section!.name}`])).entries()];
  const res = useApi(staffId ? ['teacher', 'lr', staffId, section, type, search, page] : null, ([, , s, sec, ty, term, p]) =>
    learningResources.teacher(s as string, { section_id: sec === 'all' ? undefined : (sec as string), resource_type: ty === 'all' ? undefined : (ty as string), search: (term as string) || undefined }, p as number, PER_PAGE),
  );
  const list = res.data?.data ?? [];
  const total = res.data?.total ?? 0;
  const pages = res.data?.totalPages ?? 1;
  const reset = () => setPage(1);

  async function toggle(r: LearningResource, field: 'is_pinned' | 'is_published') {
    const out = await learningResources.update(r.id, { [field]: !r[field] });
    if (!out.success) return toast.error(out.error || k('updateResourceError'));
    toast.success(field === 'is_pinned' ? (r.is_pinned ? k('unpinned') : k('pinned')) : r.is_published ? k('unpublished') : k('published'));
    res.mutate();
  }

  async function remove(r: LearningResource) {
    if (!(await confirm({ title: k('deleteResourceTitle'), body: k('deleteResourceDescription'), confirmLabel: k('delete'), destructive: true }))) return;
    const out = await learningResources.remove(r.id);
    if (!out.success) return toast.error(out.error || k('deleteResourceError'));
    toast.success(k('resourceDeleted'));
    res.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Button className="self-start" onPress={() => router.push('/teacher/learning-resources/edit')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{k('shareResource')}</Text>
        </Button>
        <SearchBar
          value={q}
          onChangeText={(v) => {
            setQ(v);
            reset();
          }}
          placeholder={k('searchResourcesPlaceholder')}
        />
        <View className="flex-row gap-2">
          <Picker
            className="flex-1"
            value={section}
            onChange={(v) => {
              setSection(v);
              reset();
            }}
            options={[{ value: 'all', label: k('allSections') }, ...sections.map(([id, name]) => ({ value: id, label: name }))]}
          />
          <Picker
            className="flex-1"
            value={type}
            onChange={(v) => {
              setType(v);
              reset();
            }}
            options={[{ value: 'all', label: k('allTypes') }, ...(Object.keys(LR_TYPES) as LearningResourceType[]).map((x) => ({ value: x, label: k(LR_TYPES[x].key) }))]}
          />
        </View>
        {total > 0 ? <Text className="text-muted-foreground text-sm">{k('showingRange', { start: (page - 1) * PER_PAGE + 1, end: Math.min(page * PER_PAGE, total), total })}</Text> : null}
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={BookOpen} className="text-muted-foreground/40 mb-3 size-12" />
              <Text className="text-muted-foreground text-lg font-medium">{k('noResourcesFound')}</Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">{!search && section === 'all' && type === 'all' ? k('shareFirstResourceHint') : k('adjustFiltersHint')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((r) => {
            const c = LR_TYPES[r.resource_type] ?? LR_TYPES.link;
            return (
              <Card key={r.id} className={cn(r.is_pinned && 'border-2 border-[#022172] dark:border-blue-400')}>
                <CardContent className="gap-3 p-4">
                  <View className="flex-row items-start gap-3">
                    <View className={cn('rounded-lg p-2', c.tone)}>
                      <Icon as={c.icon} className={cn('size-5', c.tone)} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="font-semibold" numberOfLines={2}>
                        {r.title}
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        <Badge variant="secondary">
                          <Text className="text-xs">{[r.section?.grade_level?.name, r.section?.name].filter(Boolean).join(' - ')}</Text>
                        </Badge>
                        {!r.is_published ? (
                          <Badge variant="outline">
                            <Text className="text-xs">{k('draft')}</Text>
                          </Badge>
                        ) : null}
                      </View>
                    </View>
                    {r.is_pinned ? <Icon as={Pin} className="size-4 text-[#022172] dark:text-blue-400" /> : null}
                  </View>
                  {r.description ? (
                    <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                      {r.description}
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap gap-1">
                    {r.subject ? (
                      <Badge variant="outline">
                        <Text className="text-xs">{r.subject.name}</Text>
                      </Badge>
                    ) : null}
                    {(r.tags ?? []).slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary">
                        <Text className="text-xs">{tag}</Text>
                      </Badge>
                    ))}
                    {(r.tags?.length ?? 0) > 3 ? (
                      <Badge variant="secondary">
                        <Text className="text-xs">{`+${(r.tags?.length ?? 0) - 3}`}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1">
                      <Icon as={Eye} className="text-muted-foreground size-3" />
                      <Text className="text-muted-foreground text-xs">{k('viewsCount', { count: r.view_count })}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">{formatDate(r.created_at)}</Text>
                  </View>
                  <View className="border-border flex-row flex-wrap gap-2 border-t pt-2">
                    {r.url ? (
                      <Button size="sm" variant="outline" onPress={() => WebBrowser.openBrowserAsync(r.url as string)}>
                        <Icon as={ExternalLink} className="size-4" />
                        <Text>{k('open')}</Text>
                      </Button>
                    ) : null}
                    {r.resource_type === 'anatomy' && r.content ? (
                      <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/teacher/web', params: { path: '/teacher/learning-resources', title: 'learning_resources' } })}>
                        <Icon as={Dna} className="size-4" />
                        <Text>{k('explore')}</Text>
                      </Button>
                    ) : null}
                    {(r.file_urls ?? []).map((u, i) => (
                      <Button key={u} size="sm" variant="outline" onPress={() => WebBrowser.openBrowserAsync(u)}>
                        <Icon as={Paperclip} className="size-4" />
                        <Text numberOfLines={1}>{decodeURIComponent(u.split('/').pop() || `${k('fileFallbackName')} ${i + 1}`)}</Text>
                      </Button>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <Button size="icon" variant="ghost" onPress={() => router.push({ pathname: '/teacher/learning-resources/edit', params: { id: r.id } })} accessibilityLabel={k('edit')}>
                      <Icon as={Edit} className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => toggle(r, 'is_pinned')} accessibilityLabel={r.is_pinned ? k('unpin') : k('pin')}>
                      <Icon as={r.is_pinned ? PinOff : Pin} className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => toggle(r, 'is_published')} accessibilityLabel={r.is_published ? k('unpublish') : k('publish')}>
                      <Icon as={r.is_published ? EyeOff : Eye} className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(r)} accessibilityLabel={k('delete')}>
                      <Icon as={Trash2} className="size-4 text-red-500" />
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
        {pages > 1 ? (
          <View className="flex-row items-center justify-center gap-2">
            <Button size="icon" variant="outline" disabled={page <= 1} onPress={() => setPage(1)} accessibilityLabel={k('firstPage')}>
              <Icon as={ChevronsLeft} className="size-4 rtl:rotate-180" />
            </Button>
            <Button size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} accessibilityLabel={k('previousPage')}>
              <Text>{t('common.previous')}</Text>
            </Button>
            <Text className="text-sm">{`${page} / ${pages}`}</Text>
            <Button size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage(page + 1)} accessibilityLabel={k('nextPage')}>
              <Text>{t('common.next')}</Text>
            </Button>
            <Button size="icon" variant="outline" disabled={page >= pages} onPress={() => setPage(pages)} accessibilityLabel={k('lastPage')}>
              <Icon as={ChevronsRight} className="size-4 rtl:rotate-180" />
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
