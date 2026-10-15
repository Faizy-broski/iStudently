import type { LearningResource, LearningResourceType } from '@studently/api-client';
import { htmlToText } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Dna, Download, ExternalLink, Eye, FileText, Link2, Paperclip, Pin, User, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const PER_PAGE = 10;
const TYPES: Record<LearningResourceType, { icon: LucideIcon; tone: string }> = {
  link: { icon: Link2, tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  book: { icon: BookOpen, tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  post: { icon: FileText, tone: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  file: { icon: Paperclip, tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  video: { icon: Video, tone: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  anatomy: { icon: Dna, tone: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
};
const fileName = (url: string) => decodeURIComponent(url.split('/').pop() || url);

function TypeIcon({ type }: { type: LearningResourceType }) {
  const c = TYPES[type] ?? TYPES.link;
  return (
    <View className={cn('rounded-lg p-2', c.tone)}>
      <Icon as={c.icon} className={cn('size-5', c.tone)} />
    </View>
  );
}

/** Resources the student's teachers shared with the section: filters, pinned, pages, details (web: /student/learning-resources). */
export default function StudentLearningResources() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.lr_${key}`, o);
  const { me } = useSession();
  const sectionId = me.status === 'ready' ? me.me.profile.section_id : null;
  const studentId = me.status === 'ready' ? me.me.profile.student_id : null;
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<LearningResource | null>(null);

  const data = useApi(sectionId ? ['student', 'learning-resources', sectionId, page, type, subject, q] : null, ([, , sec, p, ty, su, s]) =>
    learningResources.section(sec as string, { resource_type: ty === 'all' ? undefined : (ty as string), subject_id: su === 'all' ? undefined : (su as string), search: (s as string) || undefined }, p as number, PER_PAGE),
  );
  const res = data.data?.data ?? [];
  // The subject filter keeps every subject seen so far (web behaviour).
  const fresh = res.filter((r) => r.subject && !subjects.some((s) => s.id === r.subject!.id)).map((r) => ({ id: r.subject!.id, name: r.subject!.name }));
  if (fresh.length) setSubjects((s) => [...s, ...fresh.filter((f, i) => fresh.findIndex((x) => x.id === f.id) === i)]);

  const total = data.data?.total ?? 0;
  const pages = data.data?.totalPages ?? 1;
  const go = (p: number) => setPage(Math.max(1, Math.min(pages, p)));
  const onFilter = (fn: () => void) => {
    setPage(1);
    fn();
  };

  function openResource(r: LearningResource) {
    if (studentId) learningResources.recordView(r.id, studentId);
    if (r.resource_type === 'post' || r.resource_type === 'anatomy') return setOpen(r);
    if (r.url) return WebBrowser.openBrowserAsync(r.url);
    if (r.file_urls?.length) setOpen(r);
  }

  if (!sectionId) {
    return (
      <>
        <Stack.Screen options={{ title: k('title') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4">
          <Text variant="muted">{k('subtitle')}</Text>
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={BookOpen} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground text-lg font-medium">{k('no_section')}</Text>
              <Text className="text-muted-foreground mt-2 text-center text-sm">{k('no_section_body')}</Text>
            </CardContent>
          </Card>
        </ScrollView>
      </>
    );
  }
  if (data.isLoading && !data.data) return <LoadingList rows={6} />;
  const pinned = res.filter((r) => r.is_pinned);
  const regular = res.filter((r) => !r.is_pinned);
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => (pages <= 5 || page <= 3 ? i + 1 : page >= pages - 2 ? pages - 4 + i : page - 2 + i));

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardContent className="gap-2 p-3">
            <SearchBar value={search} onChangeText={(v) => onFilter(() => setSearch(v))} placeholder={k('search')} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Picker value={subject} onChange={(v) => onFilter(() => setSubject(v))} options={[{ value: 'all', label: k('all_subjects') }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]} />
              </View>
              <View className="flex-1">
                <Picker value={type} onChange={(v) => onFilter(() => setType(v))} options={[{ value: 'all', label: k('all_types') }, ...(Object.keys(TYPES) as LearningResourceType[]).map((x) => ({ value: x, label: k(`type_${x}`) }))]} />
              </View>
            </View>
          </CardContent>
        </Card>
        {data.error ? <Text className="text-sm text-red-600">{k('failed')}</Text> : null}
        {total > 0 ? <Text className="text-muted-foreground text-sm">{k('showing', { from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, total), total })}</Text> : null}
        {pinned.length ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon as={Pin} className="text-primary size-4" />
              <Text className="text-lg font-semibold">{k('pinned')}</Text>
            </View>
            {pinned.map((r) => (
              <ResourceCard key={r.id} r={r} pinned onOpen={openResource} />
            ))}
          </View>
        ) : null}
        {regular.length ? (
          <View className="gap-2">
            {pinned.length ? <Text className="text-lg font-semibold">{k('all')}</Text> : null}
            {regular.map((r) => (
              <ResourceCard key={r.id} r={r} onOpen={openResource} />
            ))}
          </View>
        ) : !pinned.length ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={BookOpen} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground text-lg font-medium">{k('empty')}</Text>
              <Text className="text-muted-foreground mt-2 text-center text-sm">{total === 0 && !q && subject === 'all' && type === 'all' ? k('empty_none') : k('empty_filters')}</Text>
            </CardContent>
          </Card>
        ) : null}
        {pages > 1 ? (
          <View className="flex-row flex-wrap items-center justify-center gap-1.5 py-2">
            <PageBtn icon={ChevronsLeft} label={k('first')} onPress={() => go(1)} disabled={page === 1} />
            <PageBtn icon={ChevronLeft} label={k('prev')} onPress={() => go(page - 1)} disabled={page === 1} />
            {nums.map((n) => (
              <Button key={n} size="sm" variant={n === page ? 'default' : 'outline'} className="w-9 px-0" onPress={() => go(n)}>
                <Text>{String(n)}</Text>
              </Button>
            ))}
            <PageBtn icon={ChevronRight} label={k('next')} onPress={() => go(page + 1)} disabled={page === pages} />
            <PageBtn icon={ChevronsRight} label={k('last')} onPress={() => go(pages)} disabled={page === pages} />
          </View>
        ) : null}
      </ScrollView>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85%] max-w-lg">
          {open ? (
            <ScrollView contentContainerClassName="gap-3">
              <DialogHeader className="flex-row items-start gap-3">
                <TypeIcon type={open.resource_type} />
                <View className="flex-1">
                  <DialogTitle>{open.title}</DialogTitle>
                  <View className="mt-1 flex-row flex-wrap items-center gap-1">
                    <Icon as={User} className="text-muted-foreground size-3" />
                    <Text className="text-muted-foreground text-sm">{`${open.teacher?.profile?.first_name ?? ''} ${open.teacher?.profile?.last_name ?? ''}`}</Text>
                    <Text className="text-muted-foreground text-sm">•</Text>
                    <Icon as={Calendar} className="text-muted-foreground size-3" />
                    <Text className="text-muted-foreground text-sm">{formatDate(open.created_at)}</Text>
                  </View>
                </View>
              </DialogHeader>
              {open.description ? <Text className="text-muted-foreground">{open.description}</Text> : null}
              {open.subject ? (
                <Badge variant="outline" className="self-start">
                  <Text>{open.subject.name}</Text>
                </Badge>
              ) : null}
              {open.resource_type === 'post' && open.content ? <Text className="bg-muted/50 rounded-lg p-3 text-sm">{htmlToText(open.content)}</Text> : null}
              {open.resource_type === 'anatomy' && open.content ? (
                <Button
                  onPress={() => {
                    setOpen(null);
                    router.push({ pathname: '/student/web', params: { path: '/student/learning-resources', title: 'learning_resources' } });
                  }}>
                  <Icon as={Dna} className="text-primary-foreground size-4" />
                  <Text>{k('open_3d')}</Text>
                </Button>
              ) : null}
              {open.resource_type === 'book' ? (
                <View className="bg-muted/50 gap-1 rounded-lg p-3">
                  {open.book_title ? <Text>{`${k('book')} ${open.book_title}`}</Text> : null}
                  {open.book_author ? <Text>{`${k('author')} ${open.book_author}`}</Text> : null}
                  {open.book_isbn ? <Text>{`${k('isbn')} ${open.book_isbn}`}</Text> : null}
                  {open.url ? (
                    <Button className="mt-2 self-start" onPress={() => WebBrowser.openBrowserAsync(open.url as string)}>
                      <Icon as={ExternalLink} className="text-primary-foreground size-4" />
                      <Text>{k('view_book')}</Text>
                    </Button>
                  ) : null}
                </View>
              ) : null}
              {open.file_urls?.length ? (
                <View className="gap-2">
                  <Text className="font-medium">{k('downloads')}</Text>
                  {open.file_urls.map((url) => (
                    <View key={url} className="bg-muted flex-row items-center gap-2 rounded p-2">
                      <Icon as={Paperclip} className="size-4" />
                      <Text className="flex-1 text-sm" numberOfLines={1}>
                        {fileName(url)}
                      </Text>
                      <Button size="sm" variant="outline" onPress={() => WebBrowser.openBrowserAsync(url)}>
                        <Icon as={Download} className="size-4" />
                        <Text>{k('download')}</Text>
                      </Button>
                    </View>
                  ))}
                </View>
              ) : null}
              {open.tags?.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {open.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      <Text>{tag}</Text>
                    </Badge>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResourceCard({ r, pinned, onOpen }: { r: LearningResource; pinned?: boolean; onOpen: (r: LearningResource) => void }) {
  return (
    <Pressable onPress={() => onOpen(r)} accessibilityRole="button">
      <Card className={cn('gap-2 py-4', pinned && 'border-primary border-2')}>
        <CardHeader className="flex-row items-start gap-3 px-4">
          <TypeIcon type={r.resource_type} />
          <View className="flex-1">
            <CardTitle className="text-base" numberOfLines={2}>
              {r.title}
            </CardTitle>
            {r.subject ? (
              <Badge variant="secondary" className="mt-1 self-start">
                <Text className="text-xs">{r.subject.name}</Text>
              </Badge>
            ) : null}
          </View>
          {pinned ? <Icon as={Pin} className="text-primary size-4" /> : null}
        </CardHeader>
        <CardContent className="gap-2 px-4">
          {r.description ? (
            <Text className="text-muted-foreground text-sm" numberOfLines={2}>
              {r.description}
            </Text>
          ) : null}
          {r.tags?.length ? (
            <View className="flex-row flex-wrap gap-1">
              {r.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline">
                  <Text className="text-xs">{tag}</Text>
                </Badge>
              ))}
            </View>
          ) : null}
          <View className="border-border flex-row items-center justify-between border-t pt-2">
            <View className="flex-row items-center gap-1">
              <Icon as={User} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs">{`${r.teacher?.profile?.first_name ?? ''} ${r.teacher?.profile?.last_name ?? ''}`}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Icon as={Eye} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs">{String(r.view_count)}</Text>
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

function PageBtn({ icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Button size="icon" variant="outline" className="size-9" onPress={onPress} disabled={disabled} accessibilityLabel={label}>
      <Icon as={icon} className="size-4 rtl:rotate-180" />
    </Button>
  );
}
