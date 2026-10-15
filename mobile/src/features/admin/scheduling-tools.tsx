import { coursePeriodTeacherName, type CoursePeriod, type Student } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Check, Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { useTeacherStudents } from '@/features/teacher/students';
import { adminAcademics, adminCourses, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

export const studentFullName = (p?: { first_name?: string | null; father_name?: string | null; last_name?: string | null } | null) => [p?.first_name, p?.father_name, p?.last_name].filter(Boolean).join(' ');

/** Day indexes (0 = Monday … 6 = Sunday) of a course period's `days` (letters "MTWRFSU" or a number list). */
export function dayIndexes(days: string | number[] | null | undefined): number[] {
  if (Array.isArray(days)) return days;
  if (!days) return [];
  return [...days].map((c) => 'MTWRFSU'.indexOf(c)).filter((i) => i >= 0);
}

/** The campus's students, up to 1000 like the web's scheduling pages. */
/** The campus's students; for a teacher, only the students of their own course periods (web scope="teacher"). */
export function useCampusStudents() {
  const { campusId } = useCampus();
  const { me } = useSession();
  const isTeacher = me.status === 'ready' && me.me.profile.role === 'teacher';
  const all = useApi(isTeacher ? null : ['admin', 'sched-students', campusId ?? 'school'], () => adminStudents.list(campusId, { limit: 1000 }));
  const mine = useTeacherStudents(isTeacher);
  return isTeacher ? mine : all;
}

function Check3({ on }: { on: boolean }) {
  return <View className={cn('size-5 items-center justify-center rounded border', on ? 'border-primary bg-primary' : 'border-border')}>{on ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}</View>;
}

/** Searchable student list with check boxes, select-all and CSV download (web: the scheduling pages' student tables). */
export function StudentChecklist({ students, loading, selected, onChange, countKey }: { students: Student[]; loading: boolean; selected: Set<string>; onChange: (s: Set<string>) => void; countKey: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term ? students.filter((s) => studentFullName(s.profile).toLowerCase().includes(term) || s.student_number.toLowerCase().includes(term) || (s.grade_level ?? '').toLowerCase().includes(term)) : students;
  const all = shown.length > 0 && shown.every((s) => selected.has(s.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const download = () =>
    shareTextFile(
      'students.csv',
      toCsv(
        [t('school.scheduling.group_schedule.th_student'), t('school.scheduling.group_schedule.th_student_number'), t('school.scheduling.group_schedule.th_grade_level')],
        shown.map((s) => [studentFullName(s.profile), s.student_number, s.grade_level ?? '']),
      ),
      'text/csv',
      'public.comma-separated-values-text',
    ).catch((e) => toast.error(e instanceof Error ? e.message : ''));

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground flex-1 text-sm">{t(countKey, { count: shown.length })}</Text>
        <Pressable onPress={download} hitSlop={8} className="p-1" accessibilityLabel={t('common.download')}>
          <Icon as={Download} className="text-muted-foreground size-4" />
        </Pressable>
      </View>
      <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
      {loading ? (
        <LoadingList rows={5} />
      ) : (
        <Card>
          <CardContent className="py-1">
            <Pressable onPress={() => onChange(all ? new Set() : new Set([...selected, ...shown.map((s) => s.id)]))} className="flex-row items-center gap-3 py-2.5">
              <Check3 on={all} />
              <Text className="text-sm font-semibold">{t('app.sc_select_all', { count: selected.size })}</Text>
            </Pressable>
            {!shown.length ? <Text className="text-muted-foreground py-4 text-center text-sm">{t('school.scheduling.group_schedule.no_students_found')}</Text> : null}
            {shown.map((s) => (
              <View key={s.id}>
                <Separator />
                <Pressable onPress={() => toggle(s.id)} className="flex-row items-center gap-3 py-2.5" accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(s.id) }}>
                  <Check3 on={selected.has(s.id)} />
                  <View className="flex-1">
                    <Text className="text-sm">{studentFullName(s.profile) || '—'}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {s.student_number} · {s.grade_level || '—'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </View>
  );
}

export interface PickedCoursePeriod {
  coursePeriodId: string;
  courseId: string;
  courseTitle: string;
  periodLabel: string;
  availableSeats: number | null;
}

export const coursePeriodLabel = (cp: Pick<CoursePeriod, 'period' | 'days' | 'short_name' | 'teacher'>) =>
  [cp.period?.period_name || cp.days, cp.short_name, coursePeriodTeacherName(cp)].filter(Boolean).join(' - ');

/** Subject → course → course period drill-down (web: ChooseCourseDialog). */
export function CoursePeriodPicker({ value, onSelect }: { value: PickedCoursePeriod | null; onSelect: (p: PickedCoursePeriod) => void }) {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.add_course_dialog.${k}`, o);
  const { campusId } = useCampus();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const subjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const courses = useApi(['admin', 'courses', campusId ?? 'school'], () => adminCourses.courses(campusId));
  const cps = useApi(courseId ? ['admin', 'course-periods', courseId] : null, ([, , c]) => adminCourses.coursePeriods(c as string));
  const courseList = (courses.data ?? []).filter((c) => !subjectId || c.subject_id === subjectId);
  const course = (courses.data ?? []).find((c) => c.id === courseId);

  const row = (label: string, on: boolean, onPress: () => void, trailing?: string) => (
    <Pressable key={label + String(on)} onPress={onPress} className={cn('flex-row items-center gap-2 rounded-md px-2 py-2', on && 'bg-primary/10')}>
      <Text className={cn('text-primary flex-1 text-sm', on && 'font-semibold')}>{label}</Text>
      {trailing ? <Text className="text-muted-foreground text-xs">{trailing}</Text> : null}
    </Pressable>
  );

  return (
    <View className="border-border gap-3 rounded-lg border p-3">
      <Text className="font-semibold">{d('title')}</Text>
      <Text className="text-muted-foreground text-xs">{d('found_subjects', { count: (subjects.data ?? []).length })}</Text>
      {subjects.isLoading ? <LoadingList rows={2} /> : !(subjects.data ?? []).length ? <Text className="text-muted-foreground text-sm">{d('no_subjects_found')}</Text> : null}
      <View>
        {(subjects.data ?? []).map((s) =>
          row(s.name, subjectId === s.id, () => {
            setSubjectId(s.id);
            setCourseId(null);
          }),
        )}
      </View>
      <Separator />
      <Text className="text-muted-foreground text-xs">{d('found_courses', { count: courseList.length })}</Text>
      {!courseList.length ? <Text className="text-muted-foreground text-sm">{subjectId ? d('no_courses_found') : d('select_subject')}</Text> : null}
      <View>{courseList.map((c) => row(c.title, courseId === c.id, () => setCourseId(c.id)))}</View>
      <Separator />
      <View className="flex-row">
        <Text className="text-muted-foreground flex-1 text-xs">{d('found_cps', { count: (cps.data ?? []).length })}</Text>
        <Text className="text-muted-foreground text-xs">{d('th_available_seats')}</Text>
      </View>
      {!courseId ? (
        <Text className="text-muted-foreground text-sm">{d('select_course')}</Text>
      ) : cps.isLoading ? (
        <LoadingList rows={2} />
      ) : !(cps.data ?? []).length ? (
        <Text className="text-muted-foreground text-sm">{d('no_cps_found')}</Text>
      ) : (
        <View>
          {(cps.data ?? []).map((cp) => {
            const label = coursePeriodLabel(cp) || `${t('common.period')} ${cp.id.slice(0, 6)}`;
            const filled = (cp as CoursePeriod & { filled_seats?: number }).filled_seats ?? 0;
            const seats = cp.total_seats != null ? cp.total_seats - filled : null;
            return row(
              label,
              value?.coursePeriodId === cp.id,
              () => onSelect({ coursePeriodId: cp.id, courseId: courseId ?? cp.course_id, courseTitle: course?.title || '—', periodLabel: label, availableSeats: seats }),
              seats == null ? '—' : String(seats),
            );
          })}
        </View>
      )}
    </View>
  );
}

/** "Choose a course" panel: selected course period summary + toggled picker (web: the Courses to Add / Drop panels). */
export function CoursePanel({ title, value, onChange, chooseLabel, changeLabel }: { title: string; value: PickedCoursePeriod | null; onChange: (p: PickedCoursePeriod) => void; chooseLabel: string; changeLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-2">
      <Text className="font-semibold">{title}</Text>
      {value ? (
        <View className="bg-muted/50 rounded-md p-2">
          <Text className="font-medium">{value.courseTitle}</Text>
          <Text className="text-muted-foreground text-xs">{value.periodLabel}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text className="text-primary text-sm font-medium">{value ? changeLabel : chooseLabel}</Text>
      </Pressable>
      {open ? (
        <CoursePeriodPicker
          value={value}
          onSelect={(p) => {
            onChange(p);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
