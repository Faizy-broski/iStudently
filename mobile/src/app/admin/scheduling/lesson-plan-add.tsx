import { coursePeriodTeacherName, type LessonPlan, type LessonPlanItemInput } from '@studently/api-client';
import { Stack } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { lessonDate } from '@/features/admin/lesson-plans';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { adminCourses, adminScheduling, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments } from '@/lib/upload';

type Part = { uid: string; time: string; teacher: string; learner: string; assessment: string; materials: string };
type Lesson = { title: string; on_date: string; lesson_number: string; length: string; objectives: string; evaluation: string; inclusiveness: string };

let seq = 0;
const newPart = (): Part => ({ uid: `p${++seq}`, time: '', teacher: '', learner: '', assessment: '', materials: '' });
const ACCEPT = /\.(pdf|docx?|xlsx?|pptx?|txt|jpe?g|png|gif|webp|heic)$/i;

function LessonForm({ initial, parts: initialParts, editing, saving, onSave, onCancel }: { initial: Lesson; parts: Part[]; editing: boolean; saving: boolean; onSave: (l: Lesson, p: Part[]) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.lesson_plan_add.${k}`, o);
  const [f, setF] = useState(initial);
  const [parts, setParts] = useState(initialParts.length ? initialParts : [newPart()]);
  const setPart = (i: number, patch: Partial<Part>) => setParts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setParts((p) => {
      const n = [...p];
      const k = i + d;
      if (k < 0 || k >= n.length) return p;
      [n[i], n[k]] = [n[k], n[i]];
      return n;
    });
  const remove = (i: number) => setParts((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [newPart()]));

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="font-semibold">{editing ? a('edit_lesson') : a('new_lesson_plan')}</Text>
        <Text className="text-muted-foreground text-xs">{a('form_desc')}</Text>
        <View className="gap-1">
          <Label>{a('lesson_title')}</Label>
          <Input value={f.title} onChangeText={(v) => setF({ ...f, title: v })} placeholder={a('placeholder_title')} />
        </View>
        <DateField label={`${t('common.date')} *`} value={f.on_date} onChange={(v) => setF({ ...f, on_date: v })} />
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1">
            <Label>{a('lesson_num')}</Label>
            <Input value={f.lesson_number} onChangeText={(v) => setF({ ...f, lesson_number: v })} keyboardType="number-pad" />
          </View>
          <View className="flex-1 gap-1">
            <Label>{a('length_min')}</Label>
            <Input value={f.length} onChangeText={(v) => setF({ ...f, length: v })} keyboardType="number-pad" />
          </View>
        </View>
        <View className="gap-1">
          <Label>{a('learning_objectives')}</Label>
          <HtmlEditorField value={f.objectives} onChange={(v) => setF({ ...f, objectives: v })} placeholder={a('desc_objectives')} />
        </View>
        <Separator />
        <View className="flex-row items-center">
          <Text className="flex-1 font-semibold">{a('lesson_parts')}</Text>
          <Button size="sm" variant="outline" onPress={() => setParts((p) => [...p, newPart()])}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{a('add_part')}</Text>
          </Button>
        </View>
        {parts.map((p, i) => (
          <View key={p.uid} className="border-border gap-2 rounded-md border p-3">
            <View className="flex-row items-center gap-1">
              <Text className="flex-1 text-sm font-semibold">{a('part_label', { num: i + 1 })}</Text>
              <Text className="text-muted-foreground text-xs">{a('time_min')}:</Text>
              <Input value={p.time} onChangeText={(v) => setPart(i, { time: v })} keyboardType="number-pad" className="h-9 w-16" />
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} className="p-1">
                <Icon as={ArrowUp} className="text-muted-foreground size-4" />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === parts.length - 1} hitSlop={6} className="p-1">
                <Icon as={ArrowDown} className="text-muted-foreground size-4" />
              </Pressable>
              <Pressable onPress={() => remove(i)} hitSlop={6} className="p-1">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
            {(
              [
                ['teacher', 'teacher_activity'],
                ['learner', 'learner_activity'],
                ['assessment', 'formative_assessment'],
                ['materials', 'learning_materials'],
              ] as const
            ).map(([k, label]) => (
              <View key={k} className="gap-1">
                <Label>{a(label)}</Label>
                <HtmlEditorField value={p[k]} onChange={(v) => setPart(i, { [k]: v })} placeholder={`${a(label)}...`} />
              </View>
            ))}
          </View>
        ))}
        <Separator />
        <View className="gap-1">
          <Label>{a('lesson_evaluation')}</Label>
          <HtmlEditorField value={f.evaluation} onChange={(v) => setF({ ...f, evaluation: v })} placeholder={`${a('lesson_evaluation')}...`} />
        </View>
        <View className="gap-1">
          <Label>{a('inclusiveness')}</Label>
          <HtmlEditorField value={f.inclusiveness} onChange={(v) => setF({ ...f, inclusiveness: v })} placeholder={`${a('inclusiveness')}...`} />
        </View>
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={onCancel} disabled={saving}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={() => onSave(f, parts)} disabled={saving}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{editing ? t('common.update') : t('common.create')}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}

/** Create, edit, delete lesson plans and their attachments for a course period (web: LessonPlanAdd). */
export default function LessonPlanAdd() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.lesson_plan_add.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  // Teachers (web: /teacher/lesson-plans): their selected year and only their own course periods.
  const portal = usePortalAcademicOptional();
  const { me } = useSession();
  const staffId = me.status === 'ready' && me.me.profile.role === 'teacher' ? (me.me.profile.staff_id ?? null) : null;
  const yearId = portal ? (portal.year?.id ?? null) : (years.current?.id ?? null);
  const allCps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const cps = { ...allCps, data: staffId ? (allCps.data ?? []).filter((x) => x.teacher_id === staffId) : allCps.data };
  const [cpId, setCpId] = useState('');
  const lessons = useApi(cpId ? ['admin', 'lesson-plans-cp', cpId, yearId ?? '', campusId ?? 'school'] : null, ([, , cp, y]) =>
    adminScheduling.lessonPlans({ course_period_id: cp as string, academic_year_id: (y as string) || undefined, campus_id: campusId, limit: 200 }),
  );
  const [form, setForm] = useState<{ id: string | null; lesson: Lesson; parts: Part[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    lessons.mutate();
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'lesson-plan-summary' || key[1] === 'lesson-plan-read'));
  };
  const openNew = () =>
    setForm({ id: null, lesson: { title: '', on_date: todayYmd(), lesson_number: String((lessons.data?.length ?? 0) + 1), length: '', objectives: '', evaluation: '', inclusiveness: '' }, parts: [newPart()] });
  const openEdit = (x: LessonPlan) =>
    setForm({
      id: x.id,
      lesson: { title: x.title, on_date: x.on_date, lesson_number: String(x.lesson_number), length: x.length_minutes ? String(x.length_minutes) : '', objectives: x.learning_objectives ?? '', evaluation: x.evaluation ?? '', inclusiveness: x.inclusiveness ?? '' },
      parts: (x.items ?? []).map((it) => ({ uid: `p${++seq}`, time: it.time_minutes ? String(it.time_minutes) : '', teacher: it.teacher_activity ?? '', learner: it.learner_activity ?? '', assessment: it.formative_assessment ?? '', materials: it.learning_materials ?? '' })),
    });

  async function save(l: Lesson, parts: Part[]) {
    const cp = (cps.data ?? []).find((x) => x.id === cpId);
    if (!cpId || !yearId || !cp?.teacher_id) return toast.error(a('msg_cp_required'));
    if (!l.title.trim()) return toast.error(a('msg_title_required'));
    if (!l.on_date) return toast.error(a('msg_date_required'));
    const items: LessonPlanItemInput[] = parts
      .filter((p) => p.teacher || p.learner || p.assessment || p.materials || p.time)
      .map((p, i) => ({ sort_order: i, time_minutes: p.time ? Number(p.time) : undefined, teacher_activity: p.teacher || undefined, learner_activity: p.learner || undefined, formative_assessment: p.assessment || undefined, learning_materials: p.materials || undefined }));
    const base = {
      title: l.title,
      on_date: l.on_date,
      lesson_number: Number(l.lesson_number) || 1,
      length_minutes: l.length ? Number(l.length) : undefined,
      learning_objectives: l.objectives || undefined,
      evaluation: l.evaluation || undefined,
      inclusiveness: l.inclusiveness || undefined,
    };
    setSaving(true);
    try {
      if (form?.id) {
        const r = await adminScheduling.updateLessonPlan(form.id, base);
        if (!r.success) return toast.error(r.error || t('common.error'));
        const had = (lessons.data ?? []).find((x) => x.id === form.id)?.items?.length ?? 0;
        if (items.length || had) {
          const ir = await adminScheduling.replaceLessonItems(form.id, items);
          if (!ir.success) return toast.error(ir.error || t('common.error'));
        }
        toast.success(a('msg_updated'));
      } else {
        const r = await adminScheduling.createLessonPlan({ ...base, course_period_id: cpId, teacher_id: cp.teacher_id, academic_year_id: yearId, campus_id: campusId, items });
        if (!r.success) return toast.error(r.error || t('common.error'));
        toast.success(a('msg_created'));
      }
      setForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }
  async function remove(x: LessonPlan) {
    if (!(await confirm({ title: t('common.delete'), body: x.title, destructive: true, confirmLabel: t('common.delete') }))) return;
    setBusy(x.id);
    try {
      const r = await adminScheduling.deleteLessonPlan(x.id);
      if (!r.success) return toast.error(r.error || t('common.error'));
      toast.success(a('msg_deleted'));
      refresh();
    } finally {
      setBusy(null);
    }
  }
  async function upload(x: LessonPlan) {
    const [file] = await pickDocuments({ multiple: false });
    if (!file) return;
    if (!ACCEPT.test(file.name)) return toast.error(t('common.error'));
    setBusy(`up:${x.id}`);
    try {
      // Stored through the API (the web writes to Storage directly, which the app may not).
      const up = await media.uploadAttachment(file, campusId);
      if (!up.success || !up.data) return toast.error(up.error || t('common.error'));
      const r = await adminScheduling.addLessonFile(x.id, { file_name: file.name, file_url: up.data.url, file_type: file.type, file_size: file.size });
      if (!r.success) return toast.error(r.error || t('common.error'));
      toast.success(a('msg_file_uploaded'));
      refresh();
    } finally {
      setBusy(null);
    }
  }
  async function removeFile(id: string) {
    const r = await adminScheduling.removeLessonFile(id);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(a('msg_file_removed'));
    refresh();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{a('desc')}</Text>
          <View className="gap-1">
            <Label>{t('common.course_period')}</Label>
            {cps.isLoading ? (
              <LoadingList rows={1} />
            ) : !(cps.data ?? []).length ? (
              <Text className="text-muted-foreground text-sm">{a('no_cp_assigned')}</Text>
            ) : (
              <Picker
                value={cpId}
                onChange={(v) => {
                  setCpId(v);
                  setForm(null);
                }}
                options={(cps.data ?? []).map((cp) => ({ value: cp.id, label: [cp.course?.title ?? cp.title, cp.period?.period_name, coursePeriodTeacherName(cp)].filter(Boolean).join(' - ') || cp.id.slice(0, 8) }))}
              />
            )}
          </View>
          {cpId && !form ? (
            <Button onPress={openNew}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{a('new_lesson')}</Text>
            </Button>
          ) : null}
          {form ? <LessonForm key={form.id ?? 'new'} initial={form.lesson} parts={form.parts} editing={!!form.id} saving={saving} onSave={save} onCancel={() => setForm(null)} /> : null}
          {cpId ? (
            <Card>
              <CardContent className="gap-2 pt-4">
                <Text className="font-semibold">{a('existing_lessons')}</Text>
                <Text className="text-muted-foreground text-xs">{lessons.isLoading ? t('common.loading') : a('found_lessons', { count: lessons.data?.length ?? 0 })}</Text>
                {lessons.isLoading ? (
                  <LoadingList rows={2} />
                ) : !(lessons.data ?? []).length ? (
                  <Text className="text-muted-foreground py-4 text-center text-sm">{a('no_lessons_yet')}</Text>
                ) : (
                  (lessons.data ?? []).map((x) => (
                    <View key={x.id}>
                      <Separator />
                      <View className="gap-1 py-2">
                        <View className="flex-row items-center gap-1">
                          <View className="flex-1">
                            <Text className="text-sm font-medium">
                              #{x.lesson_number} {x.title}
                            </Text>
                            <Text className="text-muted-foreground text-xs">
                              {lessonDate(x.on_date, i18n.language)}
                              {x.length_minutes ? ` · ${x.length_minutes} min` : ''}
                            </Text>
                          </View>
                          <Pressable onPress={() => upload(x)} disabled={!!busy} hitSlop={6} className="p-1.5" accessibilityLabel={t('common.upload')}>
                            <Icon as={Upload} className="text-muted-foreground size-4" />
                          </Pressable>
                          <Pressable onPress={() => openEdit(x)} hitSlop={6} className="p-1.5" accessibilityLabel={t('common.edit')}>
                            <Icon as={Pencil} className="text-muted-foreground size-4" />
                          </Pressable>
                          <Pressable onPress={() => remove(x)} disabled={busy === x.id} hitSlop={6} className="p-1.5" accessibilityLabel={t('common.delete')}>
                            <Icon as={Trash2} className="text-destructive size-4" />
                          </Pressable>
                        </View>
                        {(x.files ?? []).map((f) => (
                          <View key={f.id} className="ms-3 flex-row items-center gap-1.5">
                            <Pressable onPress={() => openBrowserAsync(f.file_url)} className="flex-1 flex-row items-center gap-1">
                              <Icon as={Download} className="text-primary size-3.5" />
                              <Text className="text-primary text-xs">
                                {f.file_name}
                                {f.file_size ? ` (${(f.file_size / 1024).toFixed(1)} KB)` : ''}
                              </Text>
                            </Pressable>
                            <Pressable onPress={() => removeFile(f.id)} hitSlop={6} className="p-1">
                              <Icon as={X} className="text-destructive size-3.5" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
