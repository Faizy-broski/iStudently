import type { MarkingPeriod } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { CheckMark } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { StudentChecklist, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

export function Tick({ on }: { on: boolean }) {
  return <CheckMark on={on} />;
}

/** A labelled check box row. */
export function CheckRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} className="flex-row items-start gap-3 py-2 active:opacity-70" accessibilityRole="checkbox" accessibilityState={{ checked: value }}>
      <Tick on={value} />
      <View className="flex-1">
        <Text className="text-sm">{label}</Text>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Grade filter + searchable student checklist (web: the report pages' student tables). */
export function ReportStudents({ grade, onGrade, selected, onChange, allLabel }: { grade: string; onGrade: (g: string) => void; selected: Set<string>; onChange: (s: Set<string>) => void; allLabel: string }) {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const students = useCampusStudents();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const list = (students.data ?? []).filter((s) => grade === 'all' || s.grade_level === grade);
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold">{t('school.grades_module.common.filter_by_grade')}</Text>
      <FilterChips value={grade} onChange={onGrade} options={[{ value: 'all', label: allLabel }, ...(grades.data ?? []).map((g) => ({ value: g.name, label: g.name }))]} />
      <StudentChecklist students={list} loading={students.isLoading} selected={selected} onChange={onChange} countKey="school.grades_module.common.students_found" />
    </View>
  );
}

const ORDER: Record<string, number> = { FY: 0, SEM: 1, QTR: 2, PRO: 3 };

/** Marking periods grouped by type with check boxes (web: report pages' marking period picker). */
export function MarkingPeriodChecks({ list, value, onChange }: { list: MarkingPeriod[]; value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const types = [...new Set(list.map((m) => m.mp_type))].sort((a, b) => (ORDER[a] ?? 9) - (ORDER[b] ?? 9));
  if (!list.length) return <Text className="text-muted-foreground text-sm">{t('school.grades_module.common.no_marking_periods')}</Text>;
  return (
    <View className="gap-2">
      {types.map((type) => (
        <View key={type} className="gap-0.5">
          <Text variant="muted" className="text-[11px] font-semibold">
            {type}
          </Text>
          {list
            .filter((m) => m.mp_type === type)
            .map((m) => (
              <CheckRow key={m.id} label={m.title} value={value.includes(m.id)} onChange={(on) => onChange(on ? [...value, m.id] : value.filter((x) => x !== m.id))} />
            ))}
        </View>
      ))}
    </View>
  );
}
