import { coursePeriodTeacherName, type Course, type CoursePeriod, type Subject } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Trash2, Video } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { useRoleBase } from '@/features/portal/role-base';
import { adminAcademics, adminCourses, adminEmployees, adminGrades, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const DAYS = ['M', 'T', 'W', 'R', 'F', 'S', 'U'] as const;
const bySort = <T extends { sort_order?: number }>(label: (x: T) => string) => (a: T, b: T) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || label(a).localeCompare(label(b));

function useC() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`school.scheduling.courses.${k}`, o);
}

type CpForm = {
  short_name: string;
  teacher_id: string;
  secondary_teacher_id: string;
  room: string;
  marking_period_id: string;
  period_id: string;
  days: string;
  grading_scale_id: string;
  gender_restriction: string;
  total_seats: string;
  does_honor_roll: boolean;
  takes_attendance: boolean;
  calendar_id: string;
  allow_teacher_grade_scale: boolean;
  credits: string;
  affects_class_rank: boolean;
  parent_course_period_id: string;
};

const cpFormOf = (cp?: CoursePeriod): CpForm => ({
  short_name: cp?.short_name ?? '',
  teacher_id: cp?.teacher_id ?? '',
  secondary_teacher_id: cp?.secondary_teacher_id ?? '',
  room: cp?.room ?? '',
  marking_period_id: cp?.marking_period_id ?? '',
  period_id: cp?.period_id ?? '',
  days: cp?.days ?? 'MTWRF',
  grading_scale_id: cp?.grading_scale_id ?? '',
  gender_restriction: cp?.gender_restriction ?? 'N',
  total_seats: cp?.total_seats != null ? String(cp.total_seats) : '',
  does_honor_roll: cp ? cp.does_honor_roll !== false : true,
  takes_attendance: cp?.takes_attendance ?? false,
  calendar_id: cp?.calendar_id ?? '',
  allow_teacher_grade_scale: cp?.allow_teacher_grade_scale ?? false,
  credits: cp?.credits != null ? String(cp.credits) : '1',
  affects_class_rank: cp?.affects_class_rank ?? false,
  parent_course_period_id: cp?.parent_course_period_id ?? '',
});

function SubjectDialog({ subject, onClose, onSaved }: { subject: Subject | null; onClose: () => void; onSaved: () => void }) {
  const c = useC();
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [name, setName] = useState(subject?.name ?? '');
  const [code, setCode] = useState(subject?.code ?? '');
  const [grade, setGrade] = useState(subject?.grade_level_id ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || !code.trim() || !grade) return toast.error(c('msg_fill_required'));
    setBusy(true);
    try {
      const r = subject ? await adminAcademics.updateSubject(subject.id, { name: name.trim(), code: code.trim() }) : await adminAcademics.createSubject({ name: name.trim(), code: code.trim(), grade_level_id: grade, campus_id: campusId });
      if (!r.success) return toast.error(r.error || t('app.sc_save_failed'));
      toast.success(subject ? c('msg_subject_updated') : c('msg_subject_created'));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="gap-3">
            <DialogHeader>
              <DialogTitle>{subject ? c('dialog_subject_edit') : c('dialog_subject_add')}</DialogTitle>
            </DialogHeader>
            <View className="gap-1.5">
              <Label>{c('label_grade_level')}</Label>
              {subject ? (
                <Text className="text-muted-foreground text-sm">{(grades.data ?? []).find((g) => g.id === grade)?.name ?? '—'}</Text>
              ) : (
                <Picker value={grade} onChange={setGrade} placeholder={c('placeholder_select_grade')} options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} />
              )}
            </View>
            <View className="gap-1.5">
              <Label>{c('label_name')}</Label>
              <Input value={name} onChangeText={setName} placeholder={c('placeholder_subject_name')} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_code')}</Label>
              <Input value={code} onChangeText={setCode} placeholder={c('placeholder_subject_code')} autoCapitalize="characters" />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <Text>{c('btn_cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={save} disabled={busy}>
                <Text>{subject ? c('btn_save') : c('btn_create')}</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

function CourseDialog({ subject, course, onClose, onSaved }: { subject: Subject; course: Course | null; onClose: () => void; onSaved: () => void }) {
  const c = useC();
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const [title, setTitle] = useState(course?.title ?? '');
  const [short, setShort] = useState(course?.short_name ?? '');
  const [credits, setCredits] = useState(course?.credit_hours != null ? String(course.credit_hours) : '1');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error(c('msg_course_title_required'));
    setBusy(true);
    try {
      const body = { title: title.trim(), short_name: short.trim() || undefined, credit_hours: credits ? parseFloat(credits) : 1 };
      const r = course ? await adminCourses.updateCourse(course.id, body) : await adminCourses.createCourse({ ...body, subject_id: subject.id, campus_id: campusId });
      if (!r.success) return toast.error(r.error || t('app.sc_save_failed'));
      toast.success(course ? c('msg_course_updated') : c('msg_course_created'));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="gap-3">
            <DialogHeader>
              <DialogTitle>
                {course ? c('dialog_course_edit') : c('dialog_course_add')} ({subject.name})
              </DialogTitle>
            </DialogHeader>
            <View className="gap-1.5">
              <Label>{c('label_title')}</Label>
              <Input value={title} onChangeText={setTitle} placeholder={c('placeholder_course_title')} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_short_name')}</Label>
              <Input value={short} onChangeText={setShort} placeholder={c('placeholder_course_short')} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_credit_hours')}</Label>
              <Input value={credits} onChangeText={(v) => setCredits(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder={c('placeholder_credit_hours')} />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <Text>{c('btn_cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={save} disabled={busy}>
                <Text>{course ? c('btn_save') : c('btn_create')}</Text>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

function CpDialog({ course, cp, siblings, onClose, onSaved }: { course: Course; cp: CoursePeriod | null; siblings: CoursePeriod[]; onClose: () => void; onSaved: () => void }) {
  const c = useC();
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const teachers = useApi(['admin', 'cp-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { limit: 500 }));
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const periods = useApi(['admin', 'school-periods', campusId ?? 'school'], () => adminCourses.schoolPeriods(campusId));
  const scales = useApi(['admin', 'grading-scales', campusId ?? 'school'], () => adminGrades.scales(campusId));
  const [f, setF] = useState<CpForm>(cpFormOf(cp ?? undefined));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<CpForm>) => setF((x) => ({ ...x, ...p }));
  const teacherOpts = (teachers.data ?? []).map((tr) => ({ value: tr.id, label: shortName(tr.profile) || tr.id }));
  const none = (label: string) => ({ value: '', label });

  async function save() {
    if (!yearId) return toast.error(c('msg_cp_course_required'));
    if (!f.teacher_id) return toast.error(c('msg_cp_teacher_required'));
    setBusy(true);
    try {
      const common = {
        teacher_id: f.teacher_id,
        short_name: f.short_name.trim() || undefined,
        marking_period_id: f.marking_period_id || undefined,
        period_id: f.period_id || undefined,
        grading_scale_id: f.grading_scale_id || undefined,
        does_honor_roll: f.does_honor_roll,
        takes_attendance: f.takes_attendance,
        allow_teacher_grade_scale: f.allow_teacher_grade_scale,
        affects_class_rank: f.affects_class_rank,
      };
      const r = cp
        ? await adminCourses.updateCoursePeriod(course.id, cp.id, {
            ...common,
            secondary_teacher_id: f.secondary_teacher_id || null,
            room: f.room.trim() || null,
            days: f.days || null,
            gender_restriction: f.gender_restriction !== 'N' ? f.gender_restriction : null,
            total_seats: f.total_seats ? parseInt(f.total_seats, 10) : null,
            calendar_id: f.calendar_id || null,
            credits: f.credits ? parseFloat(f.credits) : null,
            parent_course_period_id: f.parent_course_period_id || null,
          })
        : await adminCourses.createCoursePeriod(course.id, {
            ...common,
            academic_year_id: yearId,
            secondary_teacher_id: f.secondary_teacher_id || undefined,
            room: f.room.trim() || undefined,
            days: f.days || undefined,
            gender_restriction: f.gender_restriction !== 'N' ? f.gender_restriction : undefined,
            total_seats: f.total_seats ? parseInt(f.total_seats, 10) : undefined,
            campus_id: campusId,
            calendar_id: f.calendar_id || undefined,
            credits: f.credits ? parseFloat(f.credits) : undefined,
            parent_course_period_id: f.parent_course_period_id || undefined,
          });
      if (!r.success) return toast.error(r.error || t('app.sc_save_failed'));
      toast.success(cp ? c('msg_cp_updated') : c('msg_cp_created'));
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const sw = (label: string, value: boolean, key: keyof CpForm) => (
    <View className="flex-row items-center gap-3">
      <Switch checked={value} onCheckedChange={(v) => set({ [key]: v } as Partial<CpForm>)} />
      <Text className="flex-1 text-sm">{label}</Text>
    </View>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92%] w-[96vw] max-w-lg">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <DialogTitle>{cp ? c('dialog_cp_edit') : c('dialog_cp_add')}</DialogTitle>
              <Text className="text-muted-foreground text-sm">{c('dialog_cp_for', { title: course.title })}</Text>
            </DialogHeader>
            <View className="gap-1.5">
              <Label>{c('label_short_name')}</Label>
              <Input value={f.short_name} onChangeText={(v) => set({ short_name: v })} placeholder={c('placeholder_cp_short')} />
              {!cp && !f.short_name ? <Text className="text-muted-foreground text-xs">{c('hint_short_name_required')}</Text> : null}
            </View>
            <View className="gap-1.5">
              <Label>{c('label_teacher')}</Label>
              <Picker value={f.teacher_id} onChange={(v) => set({ teacher_id: v })} placeholder={c('placeholder_choose')} options={teacherOpts} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_secondary_teacher')}</Label>
              <Picker value={f.secondary_teacher_id} onChange={(v) => set({ secondary_teacher_id: v })} options={[none(c('placeholder_na')), ...teacherOpts]} />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{c('label_room')}</Label>
                <Input value={f.room} onChangeText={(v) => set({ room: v })} placeholder={c('placeholder_room')} />
              </View>
              <View className="w-28 gap-1.5">
                <Label>{c('label_seats')}</Label>
                <Input value={f.total_seats} onChangeText={(v) => set({ total_seats: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder={c('placeholder_seats')} />
              </View>
            </View>
            <View className="gap-1.5">
              <Label>{c('label_marking_period')}</Label>
              <Picker value={f.marking_period_id} onChange={(v) => set({ marking_period_id: v })} options={[none(c('placeholder_na')), ...(mps.data ?? []).map((m) => ({ value: m.id, label: `${m.title} (${m.mp_type})` }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_period')}</Label>
              <Picker value={f.period_id} onChange={(v) => set({ period_id: v })} options={[none(c('placeholder_full_day')), ...(periods.data ?? []).map((p) => ({ value: p.id, label: p.title ?? p.period_name ?? '—' }))]} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_meeting_days')}</Label>
              <View className="flex-row flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = f.days.includes(d);
                  return (
                    <Pressable key={d} onPress={() => set({ days: on ? f.days.replace(d, '') : f.days + d })} className={cn('h-9 min-w-11 items-center justify-center rounded border px-1', on ? 'border-primary bg-primary' : 'border-border')}>
                      <Text className={cn('text-xs font-medium', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{c(`days.${d}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {sw(c('label_takes_attendance'), f.takes_attendance, 'takes_attendance')}
            <View className="gap-1.5">
              <Label>{c('label_calendar')}</Label>
              <Picker value={f.calendar_id} onChange={(v) => set({ calendar_id: v })} options={[none(c('placeholder_main'))]} />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_grading_scale')}</Label>
              <Picker value={f.grading_scale_id} onChange={(v) => set({ grading_scale_id: v })} options={[none(c('placeholder_not_graded')), ...(scales.data ?? []).map((s) => ({ value: s.id, label: s.title }))]} />
            </View>
            {sw(c('label_allow_teacher_scale'), f.allow_teacher_grade_scale, 'allow_teacher_grade_scale')}
            <View className="gap-1.5">
              <Label>{c('label_credits')}</Label>
              <Input value={f.credits} onChangeText={(v) => set({ credits: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="1" />
            </View>
            {sw(c('label_affects_rank'), f.affects_class_rank, 'affects_class_rank')}
            {sw(c('label_affects_honor'), f.does_honor_roll, 'does_honor_roll')}
            <View className="gap-1.5">
              <Label>{c('label_gender_restriction')}</Label>
              <Picker
                value={f.gender_restriction}
                onChange={(v) => set({ gender_restriction: v })}
                options={[
                  { value: 'N', label: c('gender_none') },
                  { value: 'M', label: c('gender_male') },
                  { value: 'F', label: c('gender_female') },
                ]}
              />
            </View>
            <View className="gap-1.5">
              <Label>{c('label_parent_cp')}</Label>
              <Picker
                value={f.parent_course_period_id}
                onChange={(v) => set({ parent_course_period_id: v })}
                options={[none(c('gender_none')), ...siblings.filter((s) => s.id !== cp?.id).map((s) => ({ value: s.id, label: s.short_name || s.title || s.id.slice(0, 8) }))]}
              />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <Text>{c('btn_cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={save} disabled={busy}>
                <Text>{cp ? c('btn_save') : c('btn_create')}</Text>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

/** One ordered list: rows, up/down reordering (web: drag), edit/delete and an add row. */
function OrderedList<T extends { id: string; sort_order?: number }>({
  title,
  items,
  loading,
  selectedId,
  label,
  trailing,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  onReorder,
  action,
}: {
  title: string;
  items: T[];
  loading: boolean;
  selectedId?: string | null;
  label: (x: T) => string;
  trailing?: (x: T) => string;
  onSelect?: (x: T) => void;
  /** Left out for read-only viewers (teachers: the API is admin-only). */
  onEdit?: (x: T) => void;
  onDelete?: (x: T) => void;
  onAdd?: () => void;
  onReorder?: (from: number, to: number) => void;
  action?: (x: T) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="gap-1 py-3">
        <Text className="text-muted-foreground text-xs">{title}</Text>
        {loading ? <LoadingList rows={2} /> : null}
        {items.map((x, i) => (
          <View key={x.id}>
            {i > 0 ? <Separator /> : null}
            <View className={cn('flex-row items-center gap-1 py-1.5', selectedId === x.id && 'bg-primary/10 rounded')}>
              {onReorder ? (
              <View>
                <Pressable onPress={() => i > 0 && onReorder(i, i - 1)} disabled={i === 0} hitSlop={4} className={cn('px-1', i === 0 && 'opacity-30')} accessibilityLabel={t('app.sc_move_up')}>
                  <Icon as={ArrowUp} className="text-muted-foreground size-3.5" />
                </Pressable>
                <Pressable onPress={() => i < items.length - 1 && onReorder(i, i + 1)} disabled={i === items.length - 1} hitSlop={4} className={cn('px-1', i === items.length - 1 && 'opacity-30')} accessibilityLabel={t('app.sc_move_down')}>
                  <Icon as={ArrowDown} className="text-muted-foreground size-3.5" />
                </Pressable>
              </View>
              ) : null}
              <Pressable onPress={onSelect ? () => onSelect(x) : undefined} disabled={!onSelect} className="flex-1 flex-row items-center gap-2 py-1">
                <Text className="text-muted-foreground w-5 text-xs">{i + 1}</Text>
                <Text className={cn('flex-1 text-sm', selectedId === x.id && 'font-semibold')}>{label(x)}</Text>
                {trailing ? <Text className="text-muted-foreground text-xs">{trailing(x)}</Text> : null}
                {onSelect ? <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" /> : null}
              </Pressable>
              {action ? action(x) : null}
              {onEdit ? (
                <Pressable onPress={() => onEdit(x)} hitSlop={6} className="p-1.5">
                  <Icon as={Pencil} className="text-muted-foreground size-3.5" />
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable onPress={() => onDelete(x)} hitSlop={6} className="p-1.5">
                  <Icon as={Trash2} className="text-destructive size-3.5" />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        {onAdd ? (
          <Pressable onPress={onAdd} className="mt-1 flex-row items-center justify-center gap-1 rounded-md border border-dashed py-2">
            <Icon as={Plus} className="text-primary size-4" />
          </Pressable>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Subjects → courses → course periods, with seats, ordering and full course-period settings (web:
 * /admin/scheduling/courses). Teachers (web: /teacher/scheduling/courses) browse read-only, as the
 * write API is admin-only, and can start an online session for their own course periods.
 */
export default function CoursesScreen() {
  const c = useC();
  const role = useRoleBase();
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const w = role.isAdmin;
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'subject'; item: Subject | null } | { kind: 'course'; item: Course | null } | { kind: 'cp'; item: CoursePeriod | null } | null>(null);

  const subjectsRes = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const coursesRes = useApi(subjectId ? ['admin', 'courses', campusId ?? 'school'] : null, () => adminCourses.courses(campusId));
  const cpsRes = useApi(courseId ? ['admin', 'course-periods', courseId] : null, ([, , cid]) => adminCourses.coursePeriods(cid as string));
  const cpIds = (cpsRes.data ?? []).map((x) => x.id);
  const seats = useApi(cpIds.length ? ['admin', 'cp-seats', ...cpIds] : null, async ([, , ...ids]) => {
    const lists = await Promise.allSettled((ids as string[]).map((i) => adminScheduling.classListForPeriod(i)));
    const map: Record<string, { filled: number; total: number | null }> = {};
    lists.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.success && r.value.data) map[(ids as string[])[i]] = { filled: r.value.data.filled_seats, total: r.value.data.total_seats ?? null };
    });
    return { success: true, data: map };
  });

  const subjects = [...(subjectsRes.data ?? [])].sort(bySort<Subject>((s) => s.name));
  const courses = (coursesRes.data ?? []).filter((x) => x.subject_id === subjectId).sort(bySort<Course>((x) => x.title));
  const cps = [...(cpsRes.data ?? [])].sort(bySort<CoursePeriod>((x) => x.title || x.short_name || ''));
  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const course = courses.find((x) => x.id === courseId) ?? null;

  async function reorder<T extends { id: string; sort_order?: number }>(items: T[], from: number, to: number, save: (id: string, order: number) => Promise<unknown>, refresh: () => void) {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await Promise.all(next.map((x, i) => ((i + 1) * 10 !== x.sort_order ? save(x.id, (i + 1) * 10) : null)));
    refresh();
  }

  async function remove(kind: 'subject' | 'course' | 'cp', id: string, label: string) {
    const typeLabel = c(`type_${kind}`);
    const warn = kind === 'subject' ? c('delete_subject_warning') : kind === 'course' ? c('delete_course_warning') : '';
    if (!(await confirm({ title: c('delete_title', { type: typeLabel }), body: `${c('delete_desc', { label })}${warn ? `\n${warn}` : ''}`, destructive: true, confirmLabel: c('btn_delete') }))) return;
    const r = kind === 'subject' ? await adminAcademics.deleteSubject(id, campusId) : kind === 'course' ? await adminCourses.deleteCourse(id) : await adminCourses.deleteCoursePeriod(courseId ?? '', id);
    if (!r.success) return toast.error(r.error || c('msg_delete_failed'));
    toast.success(c(kind === 'subject' ? 'msg_deleted_subject' : kind === 'course' ? 'msg_deleted_course' : 'msg_deleted_cp'));
    if (kind === 'subject') {
      if (subjectId === id) setSubjectId(null);
      subjectsRes.mutate();
    } else if (kind === 'course') {
      if (courseId === id) setCourseId(null);
      coursesRes.mutate();
    } else cpsRes.mutate();
  }

  const cpTitle = (x: CoursePeriod) => [x.marking_period?.title, x.period?.period_name, course?.title, coursePeriodTeacherName(x) || null].filter(Boolean).join(' - ') || x.title || '—';
  const seatsOf = (x: CoursePeriod) => {
    const s = seats.data?.[x.id];
    const total = s?.total ?? x.total_seats ?? null;
    return total == null ? '—' : String(total - (s?.filled ?? 0));
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (subjectsRes.mutate(), coursesRes.mutate(), cpsRes.mutate())} />}>
        <View className="flex-row flex-wrap items-center gap-1">
          <Pressable
            onPress={() => {
              setSubjectId(null);
              setCourseId(null);
            }}>
            <Text className="text-primary text-sm">{c('title')}</Text>
          </Pressable>
          {subject ? (
            <Pressable onPress={() => setCourseId(null)}>
              <Text className="text-primary text-sm"> › {subject.name}</Text>
            </Pressable>
          ) : null}
          {course ? <Text className="text-sm"> › {course.title}</Text> : null}
        </View>
        <OrderedList
          title={c('found_subjects', { count: subjects.length })}
          items={subjects}
          loading={subjectsRes.isLoading}
          selectedId={subjectId}
          label={(s) => s.name}
          onSelect={(s) => {
            setSubjectId(s.id);
            setCourseId(null);
          }}
          onEdit={w ? (s) => setDialog({ kind: 'subject', item: s }) : undefined}
          onDelete={w ? (s) => remove('subject', s.id, s.name) : undefined}
          onAdd={w ? () => setDialog({ kind: 'subject', item: null }) : undefined}
          onReorder={w ? (a, b) => reorder(subjects, a, b, (id, o) => adminAcademics.updateSubject(id, { sort_order: o }), () => subjectsRes.mutate()) : undefined}
        />
        {subject ? (
          <OrderedList
            title={c('found_courses', { count: courses.length })}
            items={courses}
            loading={coursesRes.isLoading}
            selectedId={courseId}
            label={(x) => x.title}
            onSelect={(x) => setCourseId(x.id)}
            onEdit={w ? (x) => setDialog({ kind: 'course', item: x }) : undefined}
            onDelete={w ? (x) => remove('course', x.id, x.title) : undefined}
            onAdd={w ? () => setDialog({ kind: 'course', item: null }) : undefined}
            onReorder={w ? (a, b) => reorder(courses, a, b, (id, o) => adminCourses.updateCourse(id, { sort_order: o }), () => coursesRes.mutate()) : undefined}
          />
        ) : (
          <Text className="text-muted-foreground text-center text-sm">{c('empty_select_subject')}</Text>
        )}
        {course ? (
          <>
            <Text className="text-muted-foreground text-xs">{c('th_available_seats')}</Text>
            <OrderedList
              title={c('found_course_periods', { count: cps.length })}
              items={cps}
              loading={cpsRes.isLoading}
              label={cpTitle}
              trailing={seatsOf}
              onEdit={w ? (x) => setDialog({ kind: 'cp', item: x }) : undefined}
              onDelete={w ? (x) => remove('cp', x.id, cpTitle(x) || c('type_cp').toLowerCase()) : undefined}
              onAdd={w ? () => setDialog({ kind: 'cp', item: null }) : undefined}
              onReorder={w ? (a, b) => reorder(cps, a, b, (id, o) => adminCourses.updateCoursePeriod(course.id, id, { sort_order: o }), () => cpsRes.mutate()) : undefined}
              action={(x) =>
                role.isTeacher && staffId && x.teacher_id === staffId ? (
                  <Pressable
                    onPress={() => router.push(role.href('/online-classes', { course_period_id: x.id, autostart: '1' }))}
                    hitSlop={6}
                    className="p-1.5"
                    accessibilityLabel={c('btn_start_online_session')}>
                    <Icon as={Video} className="size-3.5 text-green-600" />
                  </Pressable>
                ) : null
              }
            />
          </>
        ) : subject ? (
          <Text className="text-muted-foreground text-center text-sm">{c('empty_select_course')}</Text>
        ) : null}
      </ScrollView>
      {dialog?.kind === 'subject' ? <SubjectDialog subject={dialog.item} onClose={() => setDialog(null)} onSaved={() => subjectsRes.mutate()} /> : null}
      {dialog?.kind === 'course' && subject ? <CourseDialog subject={subject} course={dialog.item} onClose={() => setDialog(null)} onSaved={() => coursesRes.mutate()} /> : null}
      {dialog?.kind === 'cp' && course ? <CpDialog course={course} cp={dialog.item} siblings={cps} onClose={() => setDialog(null)} onSaved={() => cpsRes.mutate()} /> : null}
    </View>
  );
}
