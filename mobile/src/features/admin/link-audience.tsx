import type { ResourceLinkInput } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEmployees, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export const LINK_ROLES = ['admin', 'teacher', 'student', 'parent', 'librarian'] as const;

export type LinkAudience = Pick<ResourceLinkInput, 'visible_to' | 'visible_to_grade_ids' | 'visible_to_section_ids' | 'visible_to_teacher_ids' | 'visible_to_student_ids'>;

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Chip({ label, on, onPress, tone = 'primary' }: { label: string; on: boolean; onPress: () => void; tone?: 'primary' | 'teal' | 'orange' | 'amber' }) {
  const onCls = { primary: 'bg-blue-600 border-blue-600', teal: 'bg-teal-600 border-teal-600', orange: 'bg-orange-500 border-orange-500', amber: 'bg-amber-500 border-amber-500' }[tone];
  return (
    <Pressable onPress={onPress} className={cn('rounded-full border px-3 py-1', on ? onCls : 'border-border')}>
      <Text className={cn('text-xs font-medium', on && 'text-white')}>{label}</Text>
    </Pressable>
  );
}

/** Students of one selected section, as chips (loaded when the section is picked). */
function SectionStudents({ sectionId, name, value, onToggle }: { sectionId: string; name: string; value: string[]; onToggle: (id: string) => void }) {
  const { t } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`school.resources.links.${k}`, o);
  const { campusId } = useCampus();
  const res = useApi(['admin', 'link-section-students', sectionId, campusId ?? 'school'], ([, , sid]) => adminStudents.list(campusId, { section_id: [sid as string], limit: 200 }));
  const rows = res.data ?? [];
  return (
    <View className="gap-1.5 ps-3">
      <Text className="text-muted-foreground text-xs">{l('section_students_label', { section: name })}</Text>
      {res.isLoading ? (
        <Text className="text-muted-foreground text-xs">{l('loading_students')}</Text>
      ) : !rows.length ? (
        <Text className="text-muted-foreground text-xs">{l('no_students_found')}</Text>
      ) : (
        <View className="flex-row flex-wrap gap-1.5">
          {rows.map((s) => (
            <Chip key={s.id} tone="orange" label={shortName(s.profile) || s.student_number} on={value.includes(s.id)} onPress={() => onToggle(s.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

/** One grade: toggle it, then its sections, then students of selected sections. */
function GradeBlock({ grade, link, onChange }: { grade: { id: string; name: string }; link: LinkAudience; onChange: (p: Partial<LinkAudience>) => void }) {
  const { campusId } = useCampus();
  const selected = link.visible_to_grade_ids.includes(grade.id);
  const sections = useApi(selected ? ['admin', 'sections', campusId ?? 'school', grade.id] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));
  const secs = sections.data ?? [];
  return (
    <View className="gap-2">
      <Chip
        label={grade.name}
        on={selected}
        onPress={() => {
          if (selected) {
            // Dropping a grade also drops its sections (students of those sections stay unless known).
            const ids = new Set(secs.map((s) => s.id));
            onChange({ visible_to_grade_ids: link.visible_to_grade_ids.filter((x) => x !== grade.id), visible_to_section_ids: link.visible_to_section_ids.filter((x) => !ids.has(x)) });
          } else onChange({ visible_to_grade_ids: [...link.visible_to_grade_ids, grade.id] });
        }}
      />
      {selected && secs.length ? (
        <View className="gap-2 ps-3">
          <View className="flex-row flex-wrap gap-1.5">
            {secs.map((s) => (
              <Chip key={s.id} tone="teal" label={s.name} on={link.visible_to_section_ids.includes(s.id)} onPress={() => onChange({ visible_to_section_ids: toggle(link.visible_to_section_ids, s.id) })} />
            ))}
          </View>
          {secs
            .filter((s) => link.visible_to_section_ids.includes(s.id))
            .map((s) => (
              <SectionStudents key={s.id} sectionId={s.id} name={s.name} value={link.visible_to_student_ids} onToggle={(id) => onChange({ visible_to_student_ids: toggle(link.visible_to_student_ids, id) })} />
            ))}
        </View>
      ) : null}
    </View>
  );
}

/** Who sees a resource link: roles, then grade/section/student and teacher sub-filters (web: AudiencePopover). */
export function LinkAudienceEditor({ value, onChange }: { value: LinkAudience; onChange: (p: Partial<LinkAudience>) => void }) {
  const { t } = useTranslation();
  const l = (k: string, o?: Record<string, unknown>) => t(`school.resources.links.${k}`, o);
  const { campusId } = useCampus();
  const [tab, setTab] = useState<'roles' | 'students' | 'teachers'>('roles');
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const teachers = useApi(tab === 'teachers' ? ['admin', 'link-teachers', campusId ?? 'school'] : null, () => adminEmployees.list('teacher', campusId, { limit: 200 }));

  const hasStudent = value.visible_to.includes('student');
  const hasParent = value.visible_to.includes('parent');
  const showStudents = hasStudent || hasParent;
  const showTeachers = value.visible_to.includes('teacher');
  const current = (tab === 'students' && !showStudents) || (tab === 'teachers' && !showTeachers) ? 'roles' : tab;

  const toggleRole = (role: string) => {
    const next = toggle(value.visible_to, role);
    const patch: Partial<LinkAudience> = { visible_to: next };
    if (!next.includes('student') && !next.includes('parent')) {
      patch.visible_to_grade_ids = [];
      patch.visible_to_section_ids = [];
      patch.visible_to_student_ids = [];
    }
    if (!next.includes('teacher')) patch.visible_to_teacher_ids = [];
    onChange(patch);
  };

  const tabs = [{ value: 'roles' as const, label: l('tab_roles') }];
  if (showStudents) tabs.push({ value: 'students' as never, label: hasStudent && hasParent ? l('tab_students_parents') : hasParent ? l('tab_parents') : l('tab_students') });
  if (showTeachers) tabs.push({ value: 'teachers' as never, label: l('tab_teachers') });

  return (
    <View className="gap-3">
      {tabs.length > 1 ? <FilterChips value={current} onChange={setTab} options={tabs} /> : null}
      {current === 'roles' ? (
        <>
          <Text className="text-muted-foreground text-xs">{l('audience_roles_help')}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {LINK_ROLES.map((r) => (
              <Chip key={r} label={l(`role_${r}`)} on={value.visible_to.includes(r)} onPress={() => toggleRole(r)} />
            ))}
          </View>
        </>
      ) : current === 'students' ? (
        <>
          <Text className="text-muted-foreground text-xs">{hasParent && !hasStudent ? l('audience_parents_help') : hasStudent && hasParent ? l('audience_students_parents_help') : l('audience_students_help')}</Text>
          {grades.isLoading ? (
            <LoadingList rows={2} />
          ) : !(grades.data ?? []).length ? (
            <Text className="text-muted-foreground text-xs">{l('no_grades_configured')}</Text>
          ) : (
            (grades.data ?? []).map((g) => <GradeBlock key={g.id} grade={g} link={value} onChange={onChange} />)
          )}
        </>
      ) : (
        <>
          <Text className="text-muted-foreground text-xs">{l('audience_teachers_help')}</Text>
          {teachers.isLoading ? (
            <LoadingList rows={2} />
          ) : !(teachers.data ?? []).length ? (
            <Text className="text-muted-foreground text-xs">{l('no_teachers_found')}</Text>
          ) : (
            <View className="flex-row flex-wrap gap-1.5">
              {(teachers.data ?? []).map((tr) => (
                <Chip key={tr.id} tone="amber" label={shortName(tr.profile) || tr.employee_number} on={value.visible_to_teacher_ids.includes(tr.id)} onPress={() => onChange({ visible_to_teacher_ids: toggle(value.visible_to_teacher_ids, tr.id) })} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
