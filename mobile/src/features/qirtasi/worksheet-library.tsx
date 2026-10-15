import type { QirtasiWorksheet } from '@studently/api-client';
import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { router, Stack } from 'expo-router';
import { Download, FileStack, FileText, Key, Pencil, Plus, SlidersHorizontal, Star, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FILTER_FACET_KEYS, tt, TYPE_MAP, WORKSHEET_TYPES } from '@/features/admin/qirtasi';
import { useCampus } from '@/features/campus/campus';
import { adminQirtasi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';
import { useResetOn } from '@/lib/use-reset-on';

const PAGE_SIZE = 24;

function Thumb({ id, campusId, type }: { id: string; campusId?: string; type: string }) {
  const res = useApi(['admin', 'qirtasi-thumb', id, campusId ?? 'school'], ([, , wid]) => adminQirtasi.thumbnailUrl(wid as string, campusId), { revalidateOnFocus: false });
  const url = res.data?.url;
  const info = TYPE_MAP[type];
  return (
    <View className="bg-muted aspect-[210/297] items-center justify-center overflow-hidden rounded-md border border-black/5">
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <>
          <Icon as={FileText} className="text-muted-foreground size-8" />
          <Text className="text-muted-foreground mt-1 text-[10px]">A4 {info ? tt(info.en, info.ar) : ''}</Text>
        </>
      )}
    </View>
  );
}

/**
 * Worksheet library: type cards, search, curriculum and tag filters, download; with `canUpload`
 * (admin/teacher/librarian) also upload, answer key, edit and delete (web: WorksheetLibrary).
 */
export function WorksheetLibrary({ canUpload }: { canUpload: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 300);
  const [grade, setGrade] = useState('all');
  const [subject, setSubject] = useState('all');
  const [type, setType] = useState('all');
  const [facetIds, setFacetIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  useResetOn(JSON.stringify([term, grade, subject, type, facetIds]), () => setPage(0));

  const filters = { grade_id: grade === 'all' ? undefined : grade, subject_id: subject === 'all' ? undefined : subject, worksheet_type: type === 'all' ? undefined : type, facet_value_ids: facetIds, search: term || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  const list = useApi(['admin', 'qirtasi-worksheets', campusId ?? 'school', JSON.stringify(filters)], () => adminQirtasi.worksheets(campusId, filters));
  const stages = useApi(['admin', 'qirtasi-nodes', 'stages', '', campusId ?? 'school'], () => adminQirtasi.nodes('stages', undefined, campusId));
  const stageId = stages.data?.[0]?.id ?? null;
  const grades = useApi(stageId ? ['admin', 'qirtasi-nodes', 'grades', stageId, campusId ?? 'school'] : null, ([, , , , sid]) => adminQirtasi.nodes('grades', sid as string, campusId));
  const subjects = useApi(grade !== 'all' ? ['admin', 'qirtasi-nodes', 'subjects', grade, campusId ?? 'school'] : null, ([, , , g]) => adminQirtasi.nodes('subjects', g as string, campusId));
  const facets = useApi(['admin', 'qirtasi-facets', campusId ?? 'school'], () => adminQirtasi.facets(campusId));

  const gradeName = useMemo(() => Object.fromEntries((grades.data ?? []).map((g) => [g.id, g.name_ar])), [grades.data]);
  const chipFacets = (facets.data ?? []).filter((f) => FILTER_FACET_KEYS.includes(f.key));
  const allValues = chipFacets.flatMap((f) => f.values);
  const toggleFacet = (id: string) => setFacetIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const count = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeCount = [grade !== 'all', subject !== 'all', type !== 'all'].filter(Boolean).length + facetIds.length;

  const clearAll = () => {
    setGrade('all');
    setSubject('all');
    setType('all');
    setFacetIds([]);
    setSearch('');
  };

  async function open(kind: 'download' | 'answer', w: QirtasiWorksheet) {
    const r = kind === 'download' ? await adminQirtasi.downloadUrl(w.id, campusId) : await adminQirtasi.answerKeyUrl(w.id, campusId);
    const url = r.data?.url;
    if (!r.success || !url) return toast.error(r.error || (kind === 'download' ? tt('Failed to get download link', 'تعذر الحصول على رابط التنزيل') : tt('Answer key not available', 'نموذج الإجابة غير متوفر')));
    await openBrowserAsync(url);
  }

  async function remove(w: QirtasiWorksheet) {
    if (!(await confirm({ title: tt('Delete this worksheet?', 'هل تريد حذف ورقة العمل هذه؟'), destructive: true, confirmLabel: tt('Delete', 'حذف') }))) return;
    const r = await adminQirtasi.remove(w.id, campusId);
    if (!r.success) return toast.error(r.error || tt('Delete failed', 'فشل الحذف'));
    toast.success(tt('Worksheet deleted', 'تم حذف ورقة العمل'));
    list.mutate();
  }

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label + on} onPress={onPress} className={cn('rounded-full border px-2.5 py-0.5', on ? 'border-primary bg-primary' : 'border-border')}>
      <Text className={cn('text-[11px] font-medium', on && 'text-primary-foreground')}>{label}</Text>
    </Pressable>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: tt('My Worksheet — Qirtasi', 'قرطاسي — أوراق العمل') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{tt('Browse and manage educational worksheets', 'تصفح وإدارة أوراق العمل التعليمية')}</Text>
          {canUpload ? (
            <Button size="sm" onPress={() => router.push('/admin/qirtasi/worksheet-form')}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{tt('Upload Worksheet', 'رفع ورقة عمل')}</Text>
            </Button>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {[{ value: 'all', en: 'All Types', ar: 'جميع الأنواع' }, ...WORKSHEET_TYPES].map((w) => {
            const on = type === w.value;
            return (
              <Pressable key={w.value} onPress={() => setType(on && w.value !== 'all' ? 'all' : w.value)} className={cn('items-center rounded-xl border px-4 py-3', on ? 'border-primary bg-primary' : 'border-border bg-card')}>
                <Text className={cn('text-xs font-medium', on && 'text-primary-foreground')}>{tt(w.en, w.ar)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchBar value={search} onChangeText={setSearch} placeholder={tt('Search worksheets…', 'ابحث عن أوراق العمل…')} />
          </View>
          <Button variant="outline" onPress={() => setShowFilters((v) => !v)}>
            <Icon as={SlidersHorizontal} className="text-foreground size-4" />
            <Text>
              {tt('Filters', 'الفلاتر')}
              {activeCount ? ` (${activeCount})` : ''}
            </Text>
          </Button>
        </View>

        {showFilters ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="text-xs font-semibold">{tt('Grade', 'الصف')}</Text>
              <Picker
                value={grade}
                onChange={(v) => {
                  setGrade(v);
                  setSubject('all');
                }}
                options={[{ value: 'all', label: tt('All grades', 'جميع الصفوف') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name_ar }))]}
              />
              <Text className="text-xs font-semibold">{tt('Subject', 'المادة')}</Text>
              <View pointerEvents={grade === 'all' ? 'none' : 'auto'} style={{ opacity: grade === 'all' ? 0.5 : 1 }}>
                <Picker value={subject} onChange={setSubject} options={[{ value: 'all', label: tt('All subjects', 'جميع المواد') }, ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name_ar }))]} />
              </View>
              {chipFacets.map((f) => (
                <View key={f.id} className="gap-1.5">
                  <Text className="text-xs font-semibold">{f.name_ar}</Text>
                  <View className="flex-row flex-wrap gap-1.5">{f.values.map((v) => chip(v.label_ar, facetIds.includes(v.id), () => toggleFacet(v.id)))}</View>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeCount ? (
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-muted-foreground text-xs">{tt('Active filters:', 'الفلاتر النشطة:')}</Text>
            {type !== 'all' ? chip(`${tt(TYPE_MAP[type]?.en ?? type, TYPE_MAP[type]?.ar ?? type)} ✕`, true, () => setType('all')) : null}
            {grade !== 'all' ? chip(`${gradeName[grade] ?? ''} ✕`, true, () => { setGrade('all'); setSubject('all'); }) : null}
            {subject !== 'all' ? chip(`${(subjects.data ?? []).find((s) => s.id === subject)?.name_ar ?? ''} ✕`, true, () => setSubject('all')) : null}
            {facetIds.map((id) => {
              const v = allValues.find((x) => x.id === id);
              return v ? chip(`${v.label_ar} ✕`, true, () => toggleFacet(id)) : null;
            })}
            <Pressable onPress={clearAll} className="flex-row items-center gap-1 px-1">
              <Icon as={X} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs underline">{tt('Clear all', 'مسح الكل')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!list.isLoading ? <Text className="text-muted-foreground text-xs">{tt(`${count} worksheets found`, `${count} ورقة عمل`)}</Text> : null}
        {list.isLoading ? (
          <LoadingList />
        ) : !(list.data?.items ?? []).length ? (
          <View className="items-center gap-3 py-12">
            <Icon as={FileStack} className="text-muted-foreground size-10" />
            <Text className="text-muted-foreground">{tt('No worksheets found.', 'لم يتم العثور على أوراق عمل.')}</Text>
            {canUpload ? (
              <Button size="sm" onPress={() => router.push('/admin/qirtasi/worksheet-form')}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{tt('Upload your first worksheet', 'ارفع ورقة عملك الأولى')}</Text>
              </Button>
            ) : null}
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {(list.data?.items ?? []).map((w) => {
              const info = TYPE_MAP[w.worksheet_type];
              return (
                <Card key={w.id} className="w-[47%]">
                  <CardContent className="gap-2 px-2 pt-2">
                    <Thumb id={w.id} campusId={campusId} type={w.worksheet_type} />
                    {info ? <Text className="text-primary text-[10px] font-semibold">{tt(info.en, info.ar)}</Text> : null}
                    <Text className="text-sm font-medium" numberOfLines={2} style={{ writingDirection: 'rtl' }}>
                      {w.title_ar}
                    </Text>
                    {gradeName[w.grade_id] ? (
                      <View className="border-border self-start rounded border px-1">
                        <Text className="text-[10px]">{gradeName[w.grade_id]}</Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center gap-2">
                      <Icon as={Download} className="text-muted-foreground size-3" />
                      <Text className="text-muted-foreground text-[11px]">{w.download_count}</Text>
                      {w.rating_avg > 0 ? (
                        <>
                          <Icon as={Star} className="size-3 text-amber-500" />
                          <Text className="text-muted-foreground text-[11px]">{w.rating_avg.toFixed(1)}</Text>
                        </>
                      ) : null}
                    </View>
                    <View className="flex-row flex-wrap gap-1">
                      {canUpload ? (
                        <>
                          <Button size="icon" variant="outline" onPress={() => open('answer', w)} accessibilityLabel={tt('Answer key', 'نموذج الإجابة')}>
                            <Icon as={Key} className="text-foreground size-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" onPress={() => router.push({ pathname: '/admin/qirtasi/worksheet-form', params: { id: w.id } })} accessibilityLabel={tt('Edit', 'تعديل')}>
                            <Icon as={Pencil} className="text-foreground size-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" onPress={() => remove(w)} accessibilityLabel={tt('Delete', 'حذف')}>
                            <Icon as={Trash2} className="text-destructive size-3.5" />
                          </Button>
                        </>
                      ) : null}
                      <Button size="icon" onPress={() => open('download', w)} accessibilityLabel={tt('Download', 'تنزيل')}>
                        <Icon as={Download} className="text-primary-foreground size-3.5" />
                      </Button>
                    </View>
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}
        {pages > 1 ? (
          <View className="flex-row items-center justify-center gap-3">
            <Button size="sm" variant="outline" disabled={page === 0} onPress={() => setPage((p) => p - 1)}>
              <Text>{tt('Previous', 'السابق')}</Text>
            </Button>
            <Text className="text-sm">
              {page + 1} / {pages}
            </Text>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onPress={() => setPage((p) => p + 1)}>
              <Text>{tt('Next', 'التالي')}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
