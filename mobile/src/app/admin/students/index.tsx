import type { Student } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, CheckSquare, Download, Plus, UserCheck, Users, UserX, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { fullName, shortName } from '@/features/admin/people';
import { ConfidentialBadge, RelativesCard } from '@/features/admin/people-extras';
import { Tick } from '@/features/admin/report-students';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminStudents } from '@/lib/api';
import { usePagedApi, useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
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
  const [grade, setGrade] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [family, setFamily] = useState<Family>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ active: boolean; mode: 'selected' | 'grade' | 'school' } | null>(null);
  const [bulkGrade, setBulkGrade] = useState('');
  const [familyOf, setFamilyOf] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim());
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const gradeObj = (grades.data ?? []).find((g) => g.name === grade);
  const gradeId = gradeObj?.id ?? null;
  const sections = useApi(gradeId ? ['admin', 'sections', campusId ?? 'school', gradeId] : null, ([, , c, g]) => adminAcademics.sections(c === 'school' ? undefined : (c as string), g as string));

  const params = {
    search: q || undefined,
    is_active: status === 'all' ? undefined : status === 'active',
    grade_level: grade === ALL ? undefined : [grade],
    section_id: section === ALL ? undefined : [section],
    has_siblings: family === 'all' ? undefined : family === 'with',
    sort_key: sort.key,
    sort_dir: sort.dir,
  };
  const key = `admin-students:${campusId ?? 'school'}:${JSON.stringify(params)}`;
  const list = usePagedApi<Student>(key, (page) => adminStudents.list(campusId, { ...params, page, limit: 30 }));

  const sortBy = (k: SortKey) => setSort((p) => (p.key === k ? { key: k, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));
  const toggle = (id: string) => setSelected((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));

  async function exportCsv() {
    setBusy(true);
    try {
      const r = await adminStudents.list(campusId, { ...params, page: 1, limit: Math.max(list.total ?? 0, 1) });
      if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
      const rows = r.data.map((s, i) => [
        String(i + 1),
        s.student_number,
        fullName(s.profile),
        s.grade?.name || s.grade_level || '',
        s.profile?.is_active ? t('common.active') : t('common.inactive'),
        s.profile?.phone || '',
        s.profile?.email || '',
        String(s.sibling_count || 0),
      ]);
      await shareTextFile('students.csv', toCsv(['#', si('th_student_id'), t('common.name'), t('common.grade'), t('common.status'), si('th_contact'), 'Email', si('th_siblings')], rows), 'text/csv', 'public.comma-separated-values-text');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
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
            <View className="gap-3 px-4 pt-3 pb-2">
              <SearchBar value={search} onChangeText={setSearch} placeholder={si('search_placeholder')} />
              <FilterChips<Status>
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'active', label: t('school.students.fields.active') },
                  { value: 'inactive', label: t('school.students.fields.inactive') },
                  { value: 'all', label: t('app.sa_filter_all') },
                ]}
              />
              <View className="flex-row gap-2">
                <Picker
                  className="flex-1"
                  value={grade}
                  onChange={(v) => {
                    setGrade(v);
                    setSection(ALL);
                  }}
                  options={[{ value: ALL, label: si('all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.name, label: g.name }))]}
                />
                {gradeId ? <Picker className="flex-1" value={section} onChange={setSection} options={[{ value: ALL, label: t('common.all') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]} /> : null}
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-muted-foreground text-xs">{si('filter_family_label')}</Text>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                {sortChips.map(([k, label]) => (
                  <Pressable key={k} onPress={() => sortBy(k)} className={cn('flex-row items-center gap-1 rounded-full border px-2.5 py-1', sort.key === k ? 'border-primary bg-primary' : 'border-border')}>
                    <Text className={cn('text-xs', sort.key === k ? 'text-primary-foreground' : 'text-foreground')}>{label}</Text>
                    {sort.key === k ? <Icon as={sort.dir === 'asc' ? ArrowUp : ArrowDown} className="text-primary-foreground size-3" /> : null}
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                <Button size="sm" variant={selecting ? 'default' : 'outline'} onPress={() => (selecting ? (setSelecting(false), setSelected(new Set())) : setSelecting(true))}>
                  <Icon as={selecting ? X : CheckSquare} className={cn('size-4', selecting ? 'text-primary-foreground' : 'text-foreground')} />
                  <Text>{selecting ? si('selected_count', { count: selected.size }) : si('th_select')}</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/group-assign', params: { entity: 'student' } })}>
                  <Icon as={Users} className="text-foreground size-4" />
                  <Text>{t('school.students.group_assign.btn_group_assign', { defaultValue: 'Group Assign' })}</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => (setBulk({ active: false, mode: selected.size ? 'selected' : 'grade' }), setBulkGrade(gradeId ?? (grades.data ?? [])[0]?.id ?? ''))}>
                  <Icon as={UserX} className="size-4 text-amber-600" />
                  <Text>{app('st_bulk_deactivate')}</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={() => (setBulk({ active: true, mode: selected.size ? 'selected' : 'grade' }), setBulkGrade(gradeId ?? (grades.data ?? [])[0]?.id ?? ''))}>
                  <Icon as={UserCheck} className="size-4 text-emerald-600" />
                  <Text>{app('st_bulk_activate')}</Text>
                </Button>
                <Button size="sm" variant="outline" onPress={exportCsv} disabled={busy}>
                  <Icon as={Download} className="text-foreground size-4" />
                  <Text>{t('common.export', { defaultValue: 'Export' })}</Text>
                </Button>
              </ScrollView>
              {bulk ? (
                <Card>
                  <CardContent className="gap-2 pt-4">
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
                  </CardContent>
                </Card>
              ) : null}
              {list.total !== undefined ? <Text className="text-muted-foreground text-xs">{t('app.ppl_count', { count: list.total })}</Text> : null}
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
          renderItem={(s) => {
            const name = shortName(s.profile) || s.student_number;
            return (
              <ListRow
                title={name}
                subtitle={[s.student_number, s.grade?.name ?? s.grade_level, s.section?.name, s.profile?.phone].filter(Boolean).join(' · ')}
                leading={selecting ? <Tick on={selected.has(s.id)} /> : <PersonAvatar url={s.profile?.profile_photo_url ?? s.profile?.avatar_url} name={name} />}
                trailing={
                  <View className="items-end gap-1">
                    {s.profile && !s.profile.is_active ? (
                      <Badge variant="secondary">
                        <Text>{t('school.students.fields.inactive')}</Text>
                      </Badge>
                    ) : null}
                    {s.sibling_count ? (
                      <Pressable onPress={() => setFamilyOf(s)} hitSlop={6} className="flex-row items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 dark:bg-blue-900/40">
                        <Icon as={Users} className="size-3 text-blue-700 dark:text-blue-300" />
                        <Text className="text-xs text-blue-700 dark:text-blue-300">{s.sibling_count}</Text>
                      </Pressable>
                    ) : null}
                    <ConfidentialBadge status={s.confidential_family_status} />
                  </View>
                }
                onPress={() => (selecting ? toggle(s.id) : router.push({ pathname: '/admin/students/[id]', params: { id: s.student_number } }))}
              />
            );
          }}
        />
      </View>
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
