import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, CheckSquare, MoreHorizontal, Plus, SlidersHorizontal, UserCheck, Users, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DataList } from '@/components/app/data-list';
import { ActionRow, CARD_LIST_PROPS, ListCard, Panel } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { FilterChips } from '@/components/app/filter-chips';
import { BottomSheet } from '@/components/app/bottom-sheet';
import { FilterTag, RoundIcon } from '@/components/app/layout';
import { PersonAvatar } from '@/components/app/person-avatar';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { ExportMenu, serialColumn, type ExportColumn } from '@/features/admin/table-export';
import { ConfidentialBadge, RelativesCard } from '@/features/admin/people-extras';
import { Tick } from '@/features/admin/report-students';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminStudents } from '@/lib/api';
import { usePagedApi, useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

type Status = 'active' | 'inactive' | 'all';
type Family = 'all' | 'with' | 'without';
type SortKey = 'name' | 'student_number' | 'grade' | 'status' | 'contact';
const ALL = '__all__';

/** Student directory: filters, sort, bulk activate/deactivate, export, family (web: /admin/students/student-info). */
export default function StudentsList() {
  const { t } = useTranslation();
  const si = (k: string, o?: Record<string, unknown>) => t(`school.students.student_info.${k}`, o);
  const app = (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('active');
  // Web UniversalFilter: several grades; the section list follows the first one.
  const [gradeNames, setGradeNames] = useState<string[]>([]);
  const [section, setSection] = useState(ALL);
  const [family, setFamily] = useState<Family>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ active: boolean; mode: 'selected' | 'grade' | 'school' } | null>(null);
  const [bulkGrade, setBulkGrade] = useState('');
  const [familyOf, setFamilyOf] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'filters' | 'actions' | null>(null);
  const q = useDebounced(search.trim());
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const gradeObj = (grades.data ?? []).find((g) => g.name === gradeNames[0]);
  const gradeId = gradeObj?.id ?? null;
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , c, g]) => adminAcademics.sections(c === 'school' ? undefined : (c as string), g as string));

  const activeFilters = gradeNames.length + (section !== ALL ? 1 : 0) + (family !== 'all' ? 1 : 0);
  const params = {
    search: q || undefined,
    is_active: status === 'all' ? undefined : status === 'active',
    grade_level: gradeNames.length ? gradeNames : undefined,
    section_id: section === ALL ? undefined : [section],
    has_siblings: family === 'all' ? undefined : family === 'with',
    sort_key: sort.key,
    sort_dir: sort.dir,
  };
  const key = `admin-students:${campusId ?? 'school'}:${JSON.stringify(params)}`;
  const list = usePagedApi<Student>(key, (page) => adminStudents.list(campusId, { ...params, page, limit: 30 }));

  const sortBy = (k: SortKey) => setSort((p) => (p.key === k ? { key: k, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));
  const toggle = (id: string) => setSelected((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));

  // Web ExportButton (reportKey students_list): every matching student, the school's default column preset.
  const exportColumns: ExportColumn<Student>[] = [
    serialColumn<Student>(),
    { key: 'student_number', label: si('th_student_id'), accessor: (s) => s.student_number },
    { key: 'name', label: t('common.name'), accessor: (s) => [s.profile?.first_name, s.profile?.father_name, s.profile?.grandfather_name, s.profile?.last_name].filter(Boolean).join(' ') },
    { key: 'grade', label: t('common.grade'), accessor: (s) => s.grade?.name || s.grade_level || '' },
    { key: 'status', label: t('common.status'), accessor: (s) => (s.profile?.is_active ? t('common.active') : t('common.inactive')) },
    { key: 'phone', label: si('th_contact'), accessor: (s) => s.profile?.phone || '' },
    { key: 'email', label: 'Email', accessor: (s) => s.profile?.email || '' },
    { key: 'siblings', label: si('th_siblings'), accessor: (s) => String(s.sibling_count || 0) },
  ];
  async function fetchAllStudents() {
    const r = await adminStudents.list(campusId, { ...params, page: 1, limit: Math.max(list.total ?? 0, 1) });
    if (!r.success || !r.data) throw new Error(r.error || t('common.error'));
    return r.data;
  }
  async function applyBulk() {
    if (!bulk) return;
    const target = bulk.mode === 'grade' ? bulkGrade || gradeId : undefined;
    if (bulk.mode === 'grade' && !target) return toast.error(app('st_pick_grade'));
    if (bulk.mode === 'selected' && !selected.size) return toast.error(app('st_pick_students'));
    setBusy(true);
    try {
      const r = await adminStudents.bulkStatus(campusId, {
        mode: bulk.mode,
        is_active: bulk.active,
        student_ids: bulk.mode === 'selected' ? [...selected] : undefined,
        grade_level_id: target ?? undefined,
        section_id: bulk.mode === 'grade' && section !== ALL ? section : undefined,
      });
      if (!r.success || !r.data) return toast.error(r.error || si('msg_update_failed'));
      toast.success(app(bulk.active ? 'st_bulk_activated' : 'st_bulk_deactivated', { count: r.data.updated }));
      setBulk(null);
      setSelected(new Set());
      setSelecting(false);
      list.mutate();
    } finally {
      setBusy(false);
    }
  }

  const sortChips: [SortKey, string][] = [
    ['name', t('common.name')],
    ['student_number', si('th_student_id')],
    ['grade', t('common.grade')],
    ['status', t('common.status')],
    ['contact', si('th_contact')],
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: si('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/admin/students/form')} accessibilityLabel={t('school.students.add_student.title', { defaultValue: 'Add student' })}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 px-4 pt-3 pb-3">
              {/* Search + filters + actions */}
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <SearchBar value={search} onChangeText={setSearch} placeholder={si('search_placeholder')} />
                </View>
                <RoundIcon icon={SlidersHorizontal} label={app('st_filters')} count={activeFilters} onPress={() => setSheet('filters')} />
                <RoundIcon icon={MoreHorizontal} label={app('st_actions')} onPress={() => setSheet('actions')} />
              </View>
              <Segmented<Status>
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'active', label: t('school.students.fields.active') },
                  { value: 'inactive', label: t('school.students.fields.inactive') },
                  { value: 'all', label: t('app.sa_filter_all') },
                ]}
              />
              {/* Active filters (tap to clear) + count */}
              <View className="flex-row flex-wrap items-center gap-1.5">
                {list.total !== undefined ? <StatusChip label={t('app.ppl_count', { count: list.total })} tone="info" className="px-2.5 py-1" /> : null}
                {gradeNames.map((g) => (
                  <FilterTag key={g} label={g} onClear={() => (setGradeNames((x) => x.filter((y) => y !== g)), setSection(ALL))} />
                ))}
                {section !== ALL ? <FilterTag label={(sections.data ?? []).find((x) => x.id === section)?.name ?? section} onClear={() => setSection(ALL)} /> : null}
                {family !== 'all' ? <FilterTag label={si(family === 'with' ? 'filter_family_with_siblings' : 'filter_family_without_siblings')} onClear={() => setFamily('all')} /> : null}
                {selecting ? <FilterTag label={si('selected_count', { count: selected.size })} onClear={() => (setSelecting(false), setSelected(new Set()))} /> : null}
              </View>
              {bulk ? (
                <Panel className="gap-2 p-4">
                  <Text className="font-semibold">{app(bulk.active ? 'st_bulk_activate' : 'st_bulk_deactivate')}</Text>
                  <Text className="text-muted-foreground text-xs">{app('st_target_scope')}</Text>
                  <FilterChips
                    value={bulk.mode}
                    onChange={(m) => setBulk({ ...bulk, mode: m })}
                    options={[
                      { value: 'selected', label: app('st_scope_selected') },
                      { value: 'grade', label: app('st_scope_grade') },
                      { value: 'school', label: app('st_scope_school') },
                    ]}
                  />
                  {bulk.mode === 'grade' ? <Picker value={bulkGrade} onChange={setBulkGrade} placeholder={app('st_pick_grade')} options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} /> : null}
                  <Text className="text-muted-foreground text-xs">{bulk.mode === 'selected' ? app('st_summary_selected', { count: selected.size }) : bulk.mode === 'grade' ? app('st_summary_grade') : app('st_summary_school')}</Text>
                  <View className="flex-row gap-2">
                    <Button className="flex-1" variant="outline" onPress={() => setBulk(null)} disabled={busy}>
                      <Text>{t('common.cancel')}</Text>
                    </Button>
                    <Button className="flex-1" variant={bulk.active ? 'default' : 'destructive'} onPress={applyBulk} disabled={busy}>
                      <Text>{app(bulk.active ? 'st_bulk_activate' : 'st_bulk_deactivate')}</Text>
                    </Button>
                  </View>
                </Panel>
              ) : null}
            </View>
          }
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={si('no_students_found')}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          {...CARD_LIST_PROPS}
          renderItem={(s) => {
            const name = shortName(s.profile) || s.student_number;
            const on = selected.has(s.id);
            return (
              <ListCard onPress={() => (selecting ? toggle(s.id) : router.push({ pathname: '/admin/students/[id]', params: { id: s.student_number } }))}>
                {selecting ? <Tick on={on} /> : <PersonAvatar url={s.profile?.profile_photo_url ?? s.profile?.avatar_url} name={name} size={42} />}
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                    {[s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · ')}
                  </Text>
                  {s.profile?.phone ? (
                    <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                      {s.profile.phone}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end gap-1">
                  {s.profile && !s.profile.is_active ? <StatusChip label={t('school.students.fields.inactive')} tone="muted" className="px-2 py-0.5" /> : null}
                  {s.sibling_count ? (
                    <Pressable onPress={() => setFamilyOf(s)} hitSlop={6} className="bg-info-soft flex-row items-center gap-1 rounded-full px-2 py-0.5" accessibilityRole="button" accessibilityLabel={app('st_family')}>
                      <Icon as={Users} className="text-brand dark:text-brand-secondary size-3" />
                      <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{s.sibling_count}</Text>
                    </Pressable>
                  ) : null}
                  <ConfidentialBadge status={s.confidential_family_status} />
                </View>
              </ListCard>
            );
          }}
        />
      </View>
      <BottomSheet open={sheet === 'filters'} onClose={() => setSheet(null)} title={app('st_filters')}>
        <ScrollView contentContainerClassName="gap-4 pb-2" keyboardShouldPersistTaps="handled">
          <View className="gap-1.5">
            <Text className="text-sm font-semibold">{t('common.grade')}</Text>
            <MultiSelect
              options={(grades.data ?? []).map((g) => ({ id: g.name, label: g.name }))}
              value={gradeNames}
              onChange={(v) => {
                setGradeNames(v);
                setSection(ALL);
              }}
              placeholder={si('all_grades')}
              title={t('common.grade')}
            />
          </View>
          {gradeId ? (
            <View className="gap-1.5">
              <Text className="text-sm font-semibold">{t('common.section', { defaultValue: 'Section' })}</Text>
              <Picker value={section} onChange={setSection} options={[{ value: ALL, label: t('common.all') }, ...(sections.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
            </View>
          ) : null}
          <View className="gap-1.5">
            <Text className="text-sm font-semibold">{si('filter_family_label')}</Text>
            <FilterChips<Family>
              value={family}
              onChange={setFamily}
              options={[
                { value: 'all', label: si('filter_family_all') },
                { value: 'with', label: si('filter_family_with_siblings') },
                { value: 'without', label: si('filter_family_without_siblings') },
              ]}
            />
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-semibold">{app('st_sort_by')}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {sortChips.map(([k, label]) => (
                <Pressable key={k} onPress={() => sortBy(k)} className={cn('flex-row items-center gap-1 rounded-full border px-3 py-1.5', sort.key === k ? 'border-brand bg-brand' : 'border-info-soft dark:border-border bg-card')} accessibilityRole="button">
                  <Text className={cn('text-xs font-semibold', sort.key === k ? 'text-white' : 'text-foreground')}>{label}</Text>
                  {sort.key === k ? <Icon as={sort.dir === 'asc' ? ArrowUp : ArrowDown} className="text-white size-3" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          <Button onPress={() => setSheet(null)}>
            <Text>{app('st_show_results')}</Text>
          </Button>
        </ScrollView>
      </BottomSheet>
      <BottomSheet open={sheet === 'actions'} onClose={() => setSheet(null)} title={app('st_actions')}>
        <ScrollView contentContainerClassName="gap-3 pb-2">
          <Panel>
            <ActionRow icon={CheckSquare} title={selecting ? si('selected_count', { count: selected.size }) : si('th_select')} onPress={() => (setSheet(null), selecting ? (setSelecting(false), setSelected(new Set())) : setSelecting(true))} />
            <ActionRow icon={Users} title={t('school.students.group_assign.btn_group_assign', { defaultValue: 'Group Assign' })} onPress={() => (setSheet(null), router.push({ pathname: '/admin/group-assign', params: { entity: 'student' } }))} />
            <ActionRow icon={UserX} title={app('st_bulk_deactivate')} onPress={() => (setSheet(null), setBulk({ active: false, mode: selected.size ? 'selected' : 'grade' }), setBulkGrade(gradeId ?? (grades.data ?? [])[0]?.id ?? ''))} />
            <ActionRow icon={UserCheck} title={app('st_bulk_activate')} onPress={() => (setSheet(null), setBulk({ active: true, mode: selected.size ? 'selected' : 'grade' }), setBulkGrade(gradeId ?? (grades.data ?? [])[0]?.id ?? ''))} last />
          </Panel>
          <Text className="text-sm font-semibold">{t('common.export')}</Text>
          <ExportMenu reportKey="students_list" columns={exportColumns} fetchRows={fetchAllStudents} filename="students" title={si('title')} />
        </ScrollView>
      </BottomSheet>
      <Dialog open={!!familyOf} onOpenChange={(o) => !o && setFamilyOf(null)}>
        <DialogContent className="max-h-[85%] w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {app('st_family')} — {familyOf ? shortName(familyOf.profile) : ''}
            </DialogTitle>
          </DialogHeader>
          <ScrollView>{familyOf ? <RelativesCard studentId={familyOf.id} onOpenSibling={(n) => (setFamilyOf(null), router.push({ pathname: '/admin/students/[id]', params: { id: n } }))} /> : null}</ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
}
