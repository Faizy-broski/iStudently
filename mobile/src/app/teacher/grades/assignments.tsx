import type { CpAssignmentType, GradebookAssignment, GradebookAssignmentInput } from '@studently/api-client';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Award, Paperclip, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { useScopedCoursePeriods } from '@/features/teacher/course-periods';
import { adminGrades, media, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';
import { cn } from '@/lib/utils';

type TypeForm = { id?: string; title: string; sort_order: string; color: string };
type AssignmentForm = { id?: string; data: Partial<GradebookAssignmentInput> };

/**
 * Gradebook assignment types and assignments per course period and marking period: add / edit types,
 * add / edit / delete assignments with description, file, dates, submissions, and "apply to all
 * periods of this course" (web: /teacher/grades/assignments, TeacherAssignments).
 */
export default function TeacherGradebookAssignments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.gradesAssignments.${key}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const cps = useScopedCoursePeriods();
  const mps = useApi(['teacher', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const [cpPick, setCpPick] = useState('');
  const [mpPick, setMpPick] = useState('');
  const cpList = cps.data ?? [];
  const cpId = cpPick || cpList[0]?.id || '';
  const mpId = mpPick || mps.data?.[0]?.id || '';
  const cp = cpList.find((c) => c.id === cpId) ?? null;
  const types = useApi(cpId ? ['teacher', 'cp-assignment-types', cpId] : null, ([, , c]) => teacher.cpAssignmentTypes(c as string));
  const items = useApi(cpId && mpId ? ['teacher', 'staff-assignments', cpId, mpId] : null, ([, , c, m]) => teacher.staffAssignments(c as string, m as string));
  const [typeId, setTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [allPeriods, setAllPeriods] = useState(false);
  const [saving, setSaving] = useState(false);
  const typeList = [...(types.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const shown = typeId ? (items.data ?? []).filter((a) => a.assignment_type_id === typeId) : [];
  const mpName = (mps.data ?? []).find((m) => m.id === mpId)?.title ?? '';
  const siblings = cp ? cpList.filter((c) => c.course_id === cp.course_id) : [];
  const set = (patch: Partial<GradebookAssignmentInput>) => form && setForm({ ...form, data: { ...form.data, ...patch } });

  const reset = () => {
    setTypeId(null);
    setForm(null);
    setTypeForm(null);
  };

  async function saveType() {
    if (!typeForm?.title.trim()) return toast.error(k('titleRequired'));
    if (!cp) return;
    setSaving(true);
    try {
      const body = { title: typeForm.title.trim(), sort_order: parseInt(typeForm.sort_order, 10) || 0, color: typeForm.color || undefined };
      const r = typeForm.id ? await teacher.updateCpAssignmentType(typeForm.id, body) : await teacher.createCpAssignmentType({ ...body, course_period_id: cp.id, course_id: cp.course_id });
      if (!r.success) return toast.error(r.error || k('saveTypeFailed'));
      toast.success(k(typeForm.id ? 'typeUpdated' : 'typeCreated'));
      setTypeForm(null);
      types.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignment() {
    if (!form || !form.data.title || form.data.points === undefined || form.data.points === null) return toast.error(k('titleAndPointsRequired'));
    setSaving(true);
    try {
      let fileUrl = form.data.file_url ?? undefined;
      if (file) {
        toast.info(k('uploadingFile'));
        const up = await media.uploadAttachment(file, campusId ?? undefined);
        if (!up.success || !up.data) return toast.error(up.error || k('fileUploadFailed'));
        fileUrl = up.data.url;
        toast.success(k('fileUploaded'));
      }
      const payload = { ...form.data, file_url: fileUrl, course_period_id: cpId, marking_period_id: mpId };
      if (!form.id) {
        if (allPeriods) {
          const ids = siblings.map((c) => c.id);
          const r = await adminGrades.massCreateAssignment({
            title: payload.title as string,
            assignment_type_id: payload.assignment_type_id as string,
            points: payload.points || 100,
            weight: payload.weight || 1,
            description: payload.description ?? null,
            assigned_date: payload.assigned_date || null,
            due_date: payload.due_date || null,
            enable_submission: payload.enable_submission,
            course_period_ids: ids.length ? ids : [cpId],
          });
          if (!r.success) return toast.error(r.error || k('saveAssignmentFailed'));
          toast.success(k('assignmentCreatedForPeriods', { count: ids.length || 1 }));
        } else {
          const r = await teacher.createAssignment(payload);
          if (!r.success) return toast.error(r.error || k('saveAssignmentFailed'));
          toast.success(k('assignmentCreated'));
        }
      } else {
        const r = await teacher.updateAssignment(form.id, payload);
        if (!r.success) return toast.error(r.error || k('saveAssignmentFailed'));
        toast.success(k('assignmentUpdated'));
      }
      setFile(null);
      setAllPeriods(false);
      setForm(null);
      items.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: GradebookAssignment) {
    if (!(await confirm({ title: k('delete'), body: a.title, destructive: true, confirmLabel: k('delete') }))) return;
    const r = await teacher.deleteAssignment(a.id);
    if (!r.success) return toast.error(r.error || k('deleteAssignmentFailed'));
    toast.success(k('assignmentDeleted'));
    setForm(null);
    items.mutate();
  }

  function openAdd() {
    if (!typeId) return toast.error(k('selectTypeFirst'));
    setFile(null);
    setAllPeriods(false);
    setForm({ data: { title: '', points: 0, weight: 1, assignment_type_id: typeId, course_period_id: cpId, marking_period_id: mpId, enable_submission: false } });
  }

  async function chooseFile() {
    const [doc] = await pickDocuments({ multiple: false });
    if (doc) setFile(doc);
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitleWithPeriod', { mpName }) }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView
          contentContainerClassName="gap-3 p-4 pb-10"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([types.mutate(), items.mutate()])} />}>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Label>{k('coursePeriod')}</Label>
              <Picker
                value={cpId || null}
                onChange={(v) => {
                  setCpPick(v);
                  reset();
                }}
                options={cpList.map((c) => ({ value: c.id, label: c.course?.title || c.title || c.id.slice(0, 8) }))}
              />
            </View>
            <View className="flex-1 gap-1">
              <Label>{k('markingPeriod')}</Label>
              <Picker
                value={mpId || null}
                onChange={(v) => {
                  setMpPick(v);
                  setForm(null);
                }}
                options={(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))}
              />
            </View>
          </View>

          {typeForm ? (
            <Card>
              <CardHeader>
                <CardTitle>{typeForm.title || k('newAssignmentType')}</CardTitle>
              </CardHeader>
              <CardContent className="gap-3">
                <View className="gap-1.5">
                  <Label>{k('title')}</Label>
                  <Input value={typeForm.title} onChangeText={(v) => setTypeForm({ ...typeForm, title: v })} placeholder={k('title')} />
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1.5">
                    <Label>{k('sortOrder')}</Label>
                    <Input value={typeForm.sort_order} onChangeText={(v) => setTypeForm({ ...typeForm, sort_order: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Label>{k('color')}</Label>
                    <View className="flex-row items-center gap-2">
                      <View className="border-border size-8 rounded border" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(typeForm.color) ? typeForm.color : '#ffffff' }} />
                      <Input className="flex-1" value={typeForm.color} onChangeText={(v) => setTypeForm({ ...typeForm, color: v })} autoCapitalize="none" placeholder="#ffffff" />
                    </View>
                  </View>
                </View>
                <View className="flex-row justify-end gap-2">
                  <Button variant="outline" onPress={() => setTypeForm(null)}>
                    <Text>{t('common.cancel')}</Text>
                  </Button>
                  <Button onPress={saveType} disabled={saving}>
                    <Text>{k('save')}</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : null}

          {form ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="flex-1">{form.data.title || k('newAssignment')}</CardTitle>
                <Pressable onPress={() => setForm(null)} hitSlop={8} accessibilityLabel={t('common.close')}>
                  <Icon as={X} className="text-muted-foreground size-5" />
                </Pressable>
              </CardHeader>
              <CardContent className="gap-3">
                <View className="gap-1.5">
                  <Label>{k('title')}</Label>
                  <Input value={form.data.title ?? ''} onChangeText={(v) => set({ title: v })} />
                </View>
                <View className="gap-1.5">
                  <Label>{k('assignmentType')}</Label>
                  <Picker value={form.data.assignment_type_id ?? null} onChange={(v) => set({ assignment_type_id: v })} placeholder={k('typeEllipsis')} options={typeList.map((x) => ({ value: x.id, label: x.title }))} />
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1.5">
                    <Label>{k('points')}</Label>
                    <Input value={String(form.data.points ?? '')} onChangeText={(v) => set({ points: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Label>{k('weight')}</Label>
                    <Input value={String(form.data.weight ?? 1)} onChangeText={(v) => set({ weight: parseFloat(v) || 1 })} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View className="gap-1.5">
                  <Label>{k('description')}</Label>
                  <HtmlEditorField key={form.id ?? 'new'} value={form.data.description ?? ''} onChange={(html) => set({ description: html })} placeholder={k('describeAssignment')} />
                </View>
                <View className="gap-1.5">
                  <Label>{k('fileAttachment')}</Label>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onPress={chooseFile}>
                      <Icon as={Paperclip} className="size-4" />
                      <Text>{file ? file.name : k('chooseFileEllipsis')}</Text>
                    </Button>
                    {file ? (
                      <Pressable onPress={() => setFile(null)} hitSlop={8} accessibilityLabel={t('common.delete')}>
                        <Icon as={X} className="size-4 text-red-500" />
                      </Pressable>
                    ) : null}
                    {form.data.file_url ? (
                      <Pressable onPress={() => WebBrowser.openBrowserAsync(form.data.file_url as string)} accessibilityRole="link">
                        <Text className="text-sm text-[#4A90E2]">{k('viewCurrentFile')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <DateField label={k('assigned')} value={form.data.assigned_date?.slice(0, 10) ?? null} onChange={(v) => set({ assigned_date: v })} clearable />
                {!form.id ? (
                  <View className="flex-row items-center gap-3">
                    <Switch checked={allPeriods} onCheckedChange={setAllPeriods} />
                    <Text className="flex-1 text-sm">
                      {k('applyToAllPeriods')}
                      {siblings.length > 1 ? <Text className="text-xs text-blue-600">{` ${k('periodsCount', { count: siblings.length })}`}</Text> : null}
                    </Text>
                  </View>
                ) : null}
                <DateField label={k('due')} value={form.data.due_date?.slice(0, 10) ?? null} onChange={(v) => set({ due_date: v })} clearable />
                <View className="flex-row items-center gap-3">
                  <Switch checked={!!form.data.enable_submission} onCheckedChange={(v) => set({ enable_submission: v })} />
                  <Text className="flex-1 text-sm">{k('enableAssignmentSubmission')}</Text>
                </View>
                <View className="flex-row justify-end gap-2">
                  {form.id ? (
                    <Button variant="outline" onPress={() => remove({ ...(form.data as GradebookAssignment), id: form.id as string })} disabled={saving}>
                      <Text className="text-destructive">{k('delete')}</Text>
                    </Button>
                  ) : null}
                  <Button onPress={saveAssignment} disabled={saving}>
                    <Text>{k('save')}</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="gap-1 pt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-xs">{k('assignmentTypesFound', { count: typeList.length })}</Text>
                <Pressable onPress={() => setTypeForm({ title: '', sort_order: '0', color: '#ffffff' })} hitSlop={8} accessibilityLabel={k('newAssignmentType')}>
                  <Icon as={Plus} className="text-primary size-5" />
                </Pressable>
              </View>
              {cps.isLoading || types.isLoading ? (
                <LoadingList rows={3} />
              ) : (
                typeList.map((x: CpAssignmentType) => (
                  <Pressable
                    key={x.id}
                    onPress={() => {
                      setTypeId(x.id);
                      setForm(null);
                    }}
                    onLongPress={() => setTypeForm({ id: x.id, title: x.title, sort_order: String(x.sort_order ?? 0), color: x.color ?? '#ffffff' })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: typeId === x.id }}
                    className={cn('border-border flex-row items-center gap-2 border-t py-2.5', typeId === x.id && 'bg-primary/10')}>
                    <View className="size-3 rounded-full" style={{ backgroundColor: x.color || '#e5e7eb' }} />
                    <Text className={cn('flex-1 text-sm text-[#4A90E2]', typeId === x.id && 'font-semibold')}>{x.title}</Text>
                    <Text className="text-muted-foreground text-xs">{String(x.sort_order ?? '')}</Text>
                    <Pressable onPress={() => setTypeForm({ id: x.id, title: x.title, sort_order: String(x.sort_order ?? 0), color: x.color ?? '#ffffff' })} hitSlop={6} className="px-1">
                      <Text className="text-primary text-xs">{t('common.edit')}</Text>
                    </Pressable>
                  </Pressable>
                ))
              )}
            </CardContent>
          </Card>

          {typeId ? (
            <Card>
              <CardContent className="gap-1 pt-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-xs">{k('assignmentsFound', { count: shown.length })}</Text>
                  <Pressable onPress={openAdd} hitSlop={8} accessibilityLabel={k('newAssignment')}>
                    <Icon as={Plus} className="text-primary size-5" />
                  </Pressable>
                </View>
                {items.isLoading ? (
                  <LoadingList rows={3} />
                ) : (
                  shown.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => {
                        setFile(null);
                        setForm({ id: a.id, data: { ...a } });
                      }}
                      accessibilityRole="button"
                      className={cn('border-border flex-row items-center gap-2 border-t py-2.5', form?.id === a.id && 'bg-primary/10')}>
                      <Icon as={Award} className="size-4 text-[#4A90E2]" />
                      <Text className="flex-1 text-sm">{a.title}</Text>
                      <Text className="text-muted-foreground text-xs">{String(a.points)}</Text>
                    </Pressable>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Text className="text-muted-foreground text-center text-sm">{k('selectAssignmentTypeBelow')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
