import type { EmployeeKind, GroupEntity } from '@studently/api-client';
import { CheckSquare, MailCheck, Square } from 'lucide-react-native';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { ListRow } from '@/components/app/list-row';
import { SearchBar } from '@/components/app/search-bar';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { shortName } from '@/features/admin/people';
import { adminEmployees, adminParents, adminStudents } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { IconTile } from '@/components/app/layout';

export type PersonRow = { id: string; name: string; subtitle: string; email?: string | null };
/** People lists: group-assign entities, or a staff role list like the web email pages (employees = teachers + staff). */
export type PeopleEntity = GroupEntity | Extract<EmployeeKind, 'employees' | 'librarian' | 'counselor'>;
/** Student filters (web email pages): grade ids and section ids. */
export type PeopleFilter = { gradeIds?: string[]; sectionIds?: string[] };

async function fetchPeople(entity: PeopleEntity, campusId: string | undefined, q: string, filter: PeopleFilter | undefined, page: number, limit: number) {
  {
    const p = { page, limit, search: q || undefined };
    if (entity === 'student') {
      const res = await adminStudents.list(campusId, {
        ...p,
        is_active: true,
        sort_key: 'name',
        grade_level: filter?.gradeIds?.length ? filter.gradeIds : undefined,
        section_id: filter?.sectionIds?.length ? filter.sectionIds : undefined,
      });
      return {
        ...res,
        data: res.data?.map((s) => ({
          id: s.id,
          name: shortName(s.profile) || s.student_number,
          subtitle: [s.student_number, s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' · '),
          email: s.profile?.email,
        })),
      };
    }
    if (entity === 'parent') {
      const res = await adminParents.list(p);
      return { ...res, data: res.data?.map((x) => ({ id: x.id, name: shortName(x.profile) || '—', subtitle: x.profile?.phone ?? '', email: x.profile?.email })) };
    }
    const res = await adminEmployees.list(entity, campusId, p);
    return {
      ...res,
      data: res.data?.map((e) => ({ id: e.id, name: shortName(e.profile) || e.employee_number, subtitle: [e.employee_number, e.title].filter(Boolean).join(' · '), email: e.profile?.email })),
    };
  }
}

/** People of one type for the selected campus, as simple rows (paged, searchable, optional student filters). */
export function usePeople(entity: PeopleEntity, campusId: string | undefined, q: string, filter?: PeopleFilter) {
  const f = `${(filter?.gradeIds ?? []).join(',')}|${(filter?.sectionIds ?? []).join(',')}`;
  return usePagedApi<PersonRow>(`admin-people:${entity}:${campusId ?? 'school'}:${q}:${f}`, (page) => fetchPeople(entity, campusId, q, filter, page, 40));
}

/** Search + checkbox list of people; selection is kept across searches. */
export function PeoplePicker({
  entity,
  campusId,
  selected,
  onChange,
  header,
  footer,
  subtitle,
  filter,
  selectAllWithEmail,
}: {
  entity: PeopleEntity;
  campusId: string | undefined;
  /** Student grade/section filters (web email pages). */
  filter?: PeopleFilter;
  /** Adds "Select all with email": every matching person (up to 1000) that has an email (web email pages). */
  selectAllWithEmail?: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  header?: ReactElement;
  footer?: ReactElement;
  /** Override the second line (e.g. show the email). */
  subtitle?: (row: PersonRow) => string;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const people = usePeople(entity, campusId, q, filter);
  const [selectingAll, setSelectingAll] = useState(false);
  async function selectAll() {
    setSelectingAll(true);
    const res = await fetchPeople(entity, campusId, q, filter, 1, 1000);
    setSelectingAll(false);
    const withEmail = (res.data ?? []).filter((r) => !!r.email);
    const next = new Set(selected);
    const all = withEmail.length > 0 && withEmail.every((r) => next.has(r.id));
    for (const r of withEmail) {
      if (all) next.delete(r.id);
      else next.add(r.id);
    }
    onChange(next);
  }
  const items = people.items;
  const allShown = items.length > 0 && items.every((r) => selected.has(r.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <View className="bg-background flex-1">
      <View className="gap-3 px-4 pt-3 pb-2">
        {header}
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.ga_search')} />
        <Pressable
          onPress={() => {
            const next = new Set(selected);
            for (const r of items) {
              if (allShown) next.delete(r.id);
              else next.add(r.id);
            }
            onChange(next);
          }}
          className="flex-row items-center gap-2"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allShown }}>
          <Icon as={allShown ? CheckSquare : Square} className="text-primary size-5" />
          <Label>{t('app.ga_select_shown', { count: items.length })}</Label>
        </Pressable>
        {selectAllWithEmail ? (
          <Pressable onPress={selectAll} disabled={selectingAll} className="flex-row items-center gap-2" accessibilityRole="button">
            {selectingAll ? <ActivityIndicator size="small" /> : <IconTile icon={MailCheck} size={32} />}
            <Label>{`${t('school.students.send_email.select_all_with_email')} · ${t('app.ga_selected_n', { count: selected.size })}`}</Label>
          </Pressable>
        ) : null}
      </View>
      <DataList
        items={people.data ? items : undefined}
        error={people.error}
        isLoading={people.isLoading}
        onEndReached={people.loadMore}
        loadingMore={people.isValidating && people.size > 1}
        emptyTitle={t('app.ga_none')}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        renderItem={(r) => (
          <ListRow
            title={r.name}
            subtitle={subtitle ? subtitle(r) : r.subtitle}
            leading={<Icon as={selected.has(r.id) ? CheckSquare : Square} className={selected.has(r.id) ? 'text-primary size-5' : 'text-muted-foreground size-5'} />}
            chevron={false}
            onPress={() => toggle(r.id)}
          />
        )}
      />
      {footer}
    </View>
  );
}
