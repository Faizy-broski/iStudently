import { Eye, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminBillingElements, adminEmployees } from '@/lib/api';
import { useApi } from '@/lib/data';

// Who can see a portal note / poll (web: components/portal/visibility-picker.tsx).
// Students mode stores student ids, staff mode stores profile ids, the same as the web.

export type VisibilityMode = 'roles' | 'students' | 'staff';
export interface VisibilityState {
  mode: VisibilityMode;
  roles: string[];
  userIds: string[];
  gradeIds: string[];
}
export const EMPTY_VISIBILITY: VisibilityState = { mode: 'roles', roles: [], userIds: [], gradeIds: [] };
/** Stored audience → picker state (web: getVisibilityMode — any user ids means the people tab). */
export const visibilityOf = (x: { visible_to_roles?: string[] | null; visible_to_user_ids?: string[] | null; visible_to_grade_ids?: string[] | null }): VisibilityState => ({
  mode: (x.visible_to_user_ids?.length ?? 0) > 0 ? 'staff' : 'roles',
  roles: x.visible_to_roles ?? [],
  userIds: x.visible_to_user_ids ?? [],
  gradeIds: x.visible_to_grade_ids ?? [],
});

const ROLES = ['admin', 'teacher', 'student', 'parent'] as const;

export function VisibilityPicker({ value, onChange }: { value: VisibilityState; onChange: (v: VisibilityState) => void }) {
  const { t } = useTranslation();
  const v = (k: string, o?: Record<string, unknown>) => t(`app.vis_${k}`, o);
  const { campusId } = useCampus();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VisibilityState>(value);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  const grades = useApi(open ? ['admin', 'grades', campusId ?? 'school'] : null, () => adminAcademics.grades(campusId));
  const sections = useApi(open ? ['admin', 'sections', campusId ?? 'school', 'all'] : null, () => adminAcademics.sections(campusId));
  const students = useApi(open ? ['admin', 'students-for-assign'] : null, () => adminBillingElements.studentsForAssign());
  const staff = useApi(open && draft.mode === 'staff' ? ['admin', 'vis-staff', campusId ?? 'school'] : null, () => adminEmployees.list('employees', campusId, { limit: 200 }));

  const staffList = (staff.data ?? []).map((s) => ({ id: s.profile_id || s.id, name: shortName(s.profile) || s.profile?.email || 'Staff', tag: s.employment_type || 'staff' }));
  const sq = studentSearch.trim().toLowerCase();
  const filteredStudents = (students.data ?? []).filter(
    (s) =>
      (gradeFilter === 'all' || s.grade_level_id === gradeFilter) &&
      (sectionFilter === 'all' || s.section_id === sectionFilter) &&
      (!sq || (s.name || `${s.first_name} ${s.last_name}`).toLowerCase().includes(sq) || (s.admission_number || '').toLowerCase().includes(sq)),
  );
  const tq = staffSearch.trim().toLowerCase();
  const filteredStaff = staffList.filter((s) => !tq || s.name.toLowerCase().includes(tq) || s.tag.toLowerCase().includes(tq));
  const sectionOptions = (sections.data ?? []).filter((s) => gradeFilter === 'all' || s.grade_level_id === gradeFilter);

  const toggleId = (id: string) => setDraft((d) => ({ ...d, userIds: d.userIds.includes(id) ? d.userIds.filter((x) => x !== id) : [...d.userIds, id] }));
  const toggleAll = (ids: string[]) =>
    setDraft((d) => {
      const all = ids.every((id) => d.userIds.includes(id));
      return { ...d, userIds: all ? d.userIds.filter((x) => !ids.includes(x)) : [...new Set([...d.userIds, ...ids])] };
    });

  const summary =
    value.mode === 'roles'
      ? value.roles.length === 0 || value.roles.length === 4
        ? v('all_roles')
        : value.roles.map((r) => v(`role_${r}`)).join(', ')
      : value.mode === 'students'
        ? value.userIds.length
          ? v('n_students', { count: value.userIds.length })
          : v('no_students')
        : value.userIds.length
          ? v('n_staff', { count: value.userIds.length })
          : v('no_staff');

  const nameOf = (id: string) => {
    const s = (students.data ?? []).find((x) => x.id === id);
    if (s) return s.name || `${s.first_name} ${s.last_name}`;
    return staffList.find((x) => x.id === id)?.name ?? id.slice(0, 8);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="border-input flex-row items-center gap-2 rounded-md border px-3 py-2.5">
        <Icon as={Eye} className="text-muted-foreground size-4" />
        <Text className="flex-1 text-sm" numberOfLines={1}>
          {summary}
        </Text>
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{v('title')}</DialogTitle>
          </DialogHeader>
          <FilterChips
            value={draft.mode}
            onChange={(m) => setDraft((d) => ({ ...d, mode: m }))}
            options={[
              { value: 'roles', label: v('tab_roles') },
              { value: 'students', label: v('tab_students') },
              { value: 'staff', label: v('tab_staff') },
            ]}
          />
          <ScrollView className="max-h-[420px]" contentContainerClassName="gap-2" keyboardShouldPersistTaps="handled">
            {draft.mode === 'roles' ? (
              <>
                {ROLES.map((r) => (
                  <CheckRow key={r} checked={draft.roles.includes(r)} onPress={() => setDraft((d) => ({ ...d, roles: d.roles.includes(r) ? d.roles.filter((x) => x !== r) : [...d.roles, r] }))} label={v(`role_${r}`)} />
                ))}
                {draft.roles.length === 0 ? <Text className="text-xs text-amber-600">{v('no_roles_hint')}</Text> : null}
              </>
            ) : (
              <>
                {draft.userIds.length ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {draft.userIds.map((id) => (
                      <View key={id} className="bg-muted flex-row items-center gap-1 rounded-full px-2 py-0.5">
                        <Text className="text-xs">{nameOf(id)}</Text>
                        <Pressable onPress={() => toggleId(id)} hitSlop={6}>
                          <Icon as={X} className="text-muted-foreground size-3" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                {draft.mode === 'students' ? (
                  <>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Picker
                          value={gradeFilter}
                          onChange={(g) => {
                            setGradeFilter(g);
                            setSectionFilter('all');
                          }}
                          options={[{ value: 'all', label: v('all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
                        />
                      </View>
                      {gradeFilter !== 'all' ? (
                        <View className="flex-1">
                          <Picker value={sectionFilter} onChange={setSectionFilter} options={[{ value: 'all', label: v('all_sections') }, ...sectionOptions.map((s) => ({ value: s.id, label: s.name }))]} />
                        </View>
                      ) : null}
                    </View>
                    <SearchBar value={studentSearch} onChangeText={setStudentSearch} placeholder={v('search_students')} />
                    {filteredStudents.length ? (
                      <CheckRow checked={filteredStudents.every((s) => draft.userIds.includes(s.id))} onPress={() => toggleAll(filteredStudents.map((s) => s.id))} label={v('select_all_n', { count: filteredStudents.length })} />
                    ) : null}
                    {students.isLoading ? (
                      <Text className="text-muted-foreground py-4 text-center text-sm">{t('common.loading')}</Text>
                    ) : !(students.data ?? []).length ? (
                      <Text className="text-muted-foreground py-4 text-center text-sm">{v('no_students_found')}</Text>
                    ) : !filteredStudents.length ? (
                      <Text className="text-muted-foreground py-4 text-center text-sm">{v('no_students_match')}</Text>
                    ) : (
                      filteredStudents.map((s) => (
                        <CheckRow key={s.id} checked={draft.userIds.includes(s.id)} onPress={() => toggleId(s.id)} label={`${s.name || `${s.first_name} ${s.last_name}`} · ${s.grade_level}${s.section_name ? ` - ${s.section_name}` : ''}`} />
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <SearchBar value={staffSearch} onChangeText={setStaffSearch} placeholder={v('search_staff')} />
                    {filteredStaff.length ? <CheckRow checked={filteredStaff.every((s) => draft.userIds.includes(s.id))} onPress={() => toggleAll(filteredStaff.map((s) => s.id))} label={v('select_all_staff')} /> : null}
                    {staff.isLoading ? (
                      <Text className="text-muted-foreground py-4 text-center text-sm">{t('common.loading')}</Text>
                    ) : !filteredStaff.length ? (
                      <Text className="text-muted-foreground py-4 text-center text-sm">{v('no_staff_found')}</Text>
                    ) : (
                      filteredStaff.map((s) => <CheckRow key={s.id} checked={draft.userIds.includes(s.id)} onPress={() => toggleId(s.id)} label={`${s.name} · ${s.tag}`} />)
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </Button>
            <Button
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}>
              <Text>{v('apply')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}
