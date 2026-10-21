import type { DisciplineReferral } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Eye, Plus, RefreshCcw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { DateField, formatYmd } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Initials, RowActions } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { GradeSectionPickers, useAttendanceScope, useGradeSection } from '@/features/admin/attendance';
import { formatFieldValue, LibraryBadge, LibraryRelatedSwitch, referralPersonName } from '@/features/admin/discipline';
import { useCampus } from '@/features/campus/campus';
import { adminDiscipline } from '@/lib/api';
import { useApi, usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

const LIMIT = 20;

/** Discipline referrals: filters, paged list, details, delete (web: /admin/discipline). */
export default function DisciplineReferrals() {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId, campusId } = useAttendanceScope();
  const { campus } = useCampus();
  const gs = useGradeSection();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim().toLowerCase());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [view, setView] = useState<DisciplineReferral | null>(null);
  const [libraryOnly, setLibraryOnly] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [total, setTotal] = useState(0);

  const fields = useApi(schoolId ? ['admin', 'discipline-all-fields', schoolId] : null, () => adminDiscipline.getAllFields(schoolId));
  const fieldList = fields.data ?? [];
  const list = usePagedApi<DisciplineReferral>(
    schoolId ? `discipline-referrals:${schoolId}:${campusId ?? 'school'}:${start}:${end}:${gs.gradeName ?? ''}:${gs.sectionId ?? ''}:${libraryOnly ? 'library' : 'all'}` : null,
    async (page) => {
      const res = await adminDiscipline.getReferrals({ school_id: schoolId, campus_id: campusId, start_date: start || undefined, end_date: end || undefined, grade_level: gs.gradeName, section_id: gs.sectionId, library_related: libraryOnly || undefined, page, limit: LIMIT });
      if (!res.success) return res;
      setTotal(res.total ?? 0);
      return { ...res, pagination: { total: res.total ?? 0, page, limit: LIMIT, totalPages: Math.max(1, Math.ceil((res.total ?? 0) / LIMIT)) } };
    },
  );
  const rows = list.items.filter((r) => !q || referralPersonName(r).toLowerCase().includes(q) || (r.students?.student_number ?? '').includes(q));

  async function setLibrary(r: DisciplineReferral, on: boolean) {
    setSavingLibrary(true);
    const res = await adminDiscipline.updateReferral(r.id, { library_related: on });
    setSavingLibrary(false);
    if (!res.success) return toast.error(res.error || t('common.error'));
    setView({ ...r, library_related: on });
    list.mutate();
  }

  async function remove(r: DisciplineReferral) {
    if (!(await confirm({ title: d('delete'), body: referralPersonName(r), destructive: true }))) return;
    const res = await adminDiscipline.deleteReferral(r.id);
    if (!res.success) return toast.error(res.error || d('errors.deleteReferral'));
    toast.success(d('toasts.referralDeleted'));
    if (view?.id === r.id) setView(null);
    list.mutate();
  }

  const date = (s: string) => formatYmd(s, i18n.language);

  return (
    <>
      <Stack.Screen options={{ title: d('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Text variant="muted">
                {d('subtitle')}
                {campus ? ` · ${campus.name}` : ''}
              </Text>
              <Button onPress={() => router.push({ pathname: '/admin/discipline/add-referral', params: { kind: 'student' } })}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{d('add')}</Text>
              </Button>
              <SearchBar value={search} onChangeText={setSearch} placeholder={d('search_placeholder')} />
              <GradeSectionPickers gs={gs} />
              <View className="flex-row items-center gap-3">
                <Switch checked={libraryOnly} onCheckedChange={setLibraryOnly} />
                <Text className="flex-1 text-sm" onPress={() => setLibraryOnly(!libraryOnly)}>
                  {t('app.dc_library_only')}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={d('from_date')} value={start} onChange={setStart} clearable />
                <DateField className="flex-1" label={d('to_date')} value={end} onChange={setEnd} clearable />
              </View>
              <View className="flex-row items-center justify-between">
                <StatusChip label={d('totalCount', { count: total })} tone="info" className="px-2.5 py-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setSearch('');
                    setStart('');
                    setEnd('');
                    gs.setGrade('all');
                  }}>
                  <Icon as={RefreshCcw} className="text-foreground size-3.5" />
                  <Text>{d('reset')}</Text>
                </Button>
              </View>
            </View>
          }
          items={list.data ? rows : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && !list.isLoading && list.hasMore}
          emptyTitle={`${d('no_referrals')}${start || end || q ? ` ${d('forSelectedFilters')}` : ''}`}
          keyExtractor={(r) => r.id}
          renderItem={(r) => (
            <Pressable onPress={() => setView(r)} className="gap-1.5 px-4 py-3 active:opacity-70">
              <View className="flex-row items-center gap-3">
                <Initials name={referralPersonName(r)} tone="warning" />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{referralPersonName(r)}</Text>
                  <Text variant="muted" className="text-[11px]">
                    {[r.students?.student_number, date(r.incident_date), r.reporter?.full_name].filter(Boolean).join(' · ')}
                  </Text>
                  {r.library_related ? <LibraryBadge /> : null}
                </View>
                <RowActions onDelete={() => remove(r)} deleteLabel={d('delete')}>
                  <Pressable onPress={() => setView(r)} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={d('detail_title')}>
                    <Icon as={Eye} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                </RowActions>
              </View>
              {fieldList.slice(0, 3).map((f) => (
                <Text key={f.id} className="ps-12 text-xs" numberOfLines={1}>
                  <Text className="text-muted-foreground text-xs">{`${f.name}: `}</Text>
                  {formatFieldValue(r.field_values?.[f.id])}
                </Text>
              ))}
            </Pressable>
          )}
        />
      </View>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{d('detail_title')}</DialogTitle>
          </DialogHeader>
          {view ? (
            <ScrollView contentContainerClassName="gap-4">
              <View className="flex-row flex-wrap">
                {[
                  [d('student'), referralPersonName(view)],
                  [d('studentNumber'), view.students?.student_number ?? '-'],
                  [d('incident_date'), date(view.incident_date)],
                  [d('reporter'), view.reporter?.full_name ?? '-'],
                ].map(([k, v]) => (
                  <View key={k} className="w-1/2 py-1.5">
                    <Text className="text-muted-foreground text-xs">{k}</Text>
                    <Text className="text-sm font-semibold">{v}</Text>
                  </View>
                ))}
              </View>
              {view.target_type === 'student' || !view.target_type ? (
                <View pointerEvents={savingLibrary ? 'none' : 'auto'}>
                  <LibraryRelatedSwitch value={!!view.library_related} onChange={(on) => setLibrary(view, on)} />
                </View>
              ) : null}
              {fieldList.length ? (
                <View className="border-border gap-3 border-t pt-3">
                  <Text className="text-muted-foreground text-sm font-semibold">{d('referralDetails')}</Text>
                  {fieldList.map((f) => {
                    const v = view.field_values?.[f.id];
                    if (v === null || v === undefined || v === '') return null;
                    return (
                      <View key={f.id}>
                        <Text className="text-muted-foreground text-xs">{f.name}</Text>
                        <Text className="text-sm">{formatFieldValue(v)}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setView(null)}>
              <Text>{d('close')}</Text>
            </Button>
            {view ? (
              <Button variant="destructive" onPress={() => remove(view)}>
                <Icon as={Trash2} className="size-4 text-white" />
                <Text>{d('delete')}</Text>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
