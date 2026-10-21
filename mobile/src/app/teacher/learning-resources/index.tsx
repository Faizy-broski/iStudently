import type { LearningResource, LearningResourceType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, ChevronsLeft, ChevronsRight, Dna, Edit, ExternalLink, Eye, EyeOff, FileText, Link2, Paperclip, Pin, PinOff, Plus, Trash2, Video, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, RowPill, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { learningResources, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const PER_PAGE = 10;
const LR_TYPES: Record<LearningResourceType, { icon: LucideIcon; tone: Tone; key: string }> = {
  link: { icon: Link2, tone: 'brand', key: 'typeLink' },
  book: { icon: BookOpen, tone: 'warning', key: 'typeBook' },
  post: { icon: FileText, tone: 'success', key: 'typePost' },
  file: { icon: Paperclip, tone: 'warning', key: 'typeFile' },
  video: { icon: Video, tone: 'destructive', key: 'typeVideo' },
  anatomy: { icon: Dna, tone: 'success', key: 'typeAnatomy' },
};

function RoundAction({ icon, label, onPress, destructive }: { icon: LucideIcon; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} className={cn('size-9 items-center justify-center rounded-full active:opacity-70', destructive ? 'bg-destructive-soft' : 'bg-info-soft')}>
      <Icon as={icon} className={cn('size-4', destructive ? 'text-destructive' : 'text-brand dark:text-brand-secondary')} />
    </Pressable>
  );
}

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
        <View className="flex-row items-start gap-3">
          <Text variant="muted" className="flex-1 text-sm">
            {k('pageSubtitle')}
          </Text>
          <Button size="sm" className="rounded-full" onPress={() => router.push('/teacher/learning-resources/edit')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('shareResource')}</Text>
          </Button>
        </View>
        <SearchBar
          value={q}
          onChangeText={(v) => {
            setQ(v);
            reset();
          }}
          placeholder={k('searchResourcesPlaceholder')}
        />
        <FilterChips
          value={section}
          onChange={(v) => {
            setSection(v);
            reset();
          }}
          options={[{ value: 'all', label: k('allSections') }, ...sections.map(([id, name]) => ({ value: id, label: name }))]}
        />
        <FilterChips
          value={type}
          onChange={(v) => {
            setType(v);
            reset();
          }}
          options={[{ value: 'all', label: k('allTypes') }, ...(Object.keys(LR_TYPES) as LearningResourceType[]).map((x) => ({ value: x, label: k(LR_TYPES[x].key) }))]}
        />
        {total > 0 ? (
          <Text variant="muted" className="text-xs">
            {k('showingRange', { start: (page - 1) * PER_PAGE + 1, end: Math.min(page * PER_PAGE, total), total })}
          </Text>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={BookOpen} title={k('noResourcesFound')} body={!search && section === 'all' && type === 'all' ? k('shareFirstResourceHint') : k('adjustFiltersHint')} />
        ) : (
          list.map((r) => {
            const c = LR_TYPES[r.resource_type] ?? LR_TYPES.link;
            const sectionName = [r.section?.grade_level?.name, r.section?.name].filter(Boolean).join(' - ');
            return (
              <Panel key={r.id} className={cn('gap-3 p-4', r.is_pinned && 'border-brand-secondary')}>
                <View className="flex-row items-start gap-3">
                  <IconTile icon={c.icon} tone={c.tone} size={40} />
                  <View className="flex-1 gap-1">
                    <Text className="text-sm font-semibold" numberOfLines={2}>
                      {r.title}
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {sectionName ? <StatusChip label={sectionName} tone="info" /> : null}
                      {!r.is_published ? <StatusChip label={k('draft')} tone="warning" /> : null}
                    </View>
                  </View>
                  {r.is_pinned ? <Icon as={Pin} className="text-brand-accent size-4" /> : null}
                </View>
                {r.description ? (
                  <Text variant="muted" className="text-xs" numberOfLines={2}>
                    {r.description}
                  </Text>
                ) : null}
                {r.subject || r.tags?.length ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {r.subject ? <StatusChip label={r.subject.name} tone="info" /> : null}
                    {(r.tags ?? []).slice(0, 3).map((tag, i) => (
                      <StatusChip key={i} label={tag} tone="muted" />
                    ))}
                    {(r.tags?.length ?? 0) > 3 ? <StatusChip label={`+${(r.tags?.length ?? 0) - 3}`} tone="muted" /> : null}
                  </View>
                ) : null}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1">
                    <Icon as={Eye} className="text-muted-foreground size-3" />
                    <Text variant="muted" className="text-[11px]">
                      {k('viewsCount', { count: r.view_count })}
                    </Text>
                  </View>
                  <Text variant="muted" className="text-[11px]">
                    {formatDate(r.created_at)}
                  </Text>
                </View>
                {r.url || (r.resource_type === 'anatomy' && r.content) || r.file_urls?.length ? (
                  <View className="flex-row flex-wrap gap-2">
                    {r.url ? <RowPill icon={ExternalLink} label={k('open')} onPress={() => WebBrowser.openBrowserAsync(r.url as string)} /> : null}
                    {r.resource_type === 'anatomy' && r.content ? (
                      <RowPill icon={Dna} tone="success" label={k('explore')} onPress={() => router.push({ pathname: '/teacher/web', params: { path: '/teacher/learning-resources', title: 'learning_resources' } })} />
                    ) : null}
                    {(r.file_urls ?? []).map((u, i) => (
                      <RowPill key={u} icon={Paperclip} tone="muted" label={decodeURIComponent(u.split('/').pop() || `${k('fileFallbackName')} ${i + 1}`)} onPress={() => WebBrowser.openBrowserAsync(u)} />
                    ))}
                  </View>
                ) : null}
                <View className="border-info-soft dark:border-border flex-row justify-end gap-2 border-t pt-3">
                  <RoundAction icon={Edit} label={k('edit')} onPress={() => router.push({ pathname: '/teacher/learning-resources/edit', params: { id: r.id } })} />
                  <RoundAction icon={r.is_pinned ? PinOff : Pin} label={r.is_pinned ? k('unpin') : k('pin')} onPress={() => toggle(r, 'is_pinned')} />
                  <RoundAction icon={r.is_published ? EyeOff : Eye} label={r.is_published ? k('unpublish') : k('publish')} onPress={() => toggle(r, 'is_published')} />
                  <RoundAction icon={Trash2} label={k('delete')} onPress={() => remove(r)} destructive />
                </View>
              </Panel>
            );
          })
        )}
        {pages > 1 ? (
          <View className="flex-row items-center justify-center gap-2">
            <Button size="icon" variant="outline" disabled={page <= 1} onPress={() => setPage(1)} accessibilityLabel={k('firstPage')}>
              <Icon flipRtl as={ChevronsLeft} className="size-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} accessibilityLabel={k('previousPage')}>
              <Text>{t('common.previous')}</Text>
            </Button>
            <Text className="text-sm font-semibold">{`${page} / ${pages}`}</Text>
            <Button size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage(page + 1)} accessibilityLabel={k('nextPage')}>
              <Text>{t('common.next')}</Text>
            </Button>
            <Button size="icon" variant="outline" disabled={page >= pages} onPress={() => setPage(pages)} accessibilityLabel={k('lastPage')}>
              <Icon flipRtl as={ChevronsRight} className="size-4" />
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
