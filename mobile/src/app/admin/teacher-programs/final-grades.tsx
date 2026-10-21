import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { TeacherCoursePeriodPicker, useTeacherSelection } from '@/features/admin/teacher-programs';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { useRoleBase } from '@/features/portal/role-base';
import { adminGrades, adminScheduling, adminTeacherPrograms } from '@/lib/api';
import { useApi } from '@/lib/data';

type Row = { student_id: string; name: string; number: string; letter: string; percent: string; comment: string };

/** Final grades for one teacher's course period, entered by an admin (web: /admin/teacher-programs/final-grades) or by the teacher (web: /teacher/grades/input-final-grades). */
export default function AdminFinalGrades() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`teacherPrograms.finalGrades.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [sel, setSel] = useTeacherSelection();
  const cp = sel.coursePeriod;
  const cpId = cp?.id ?? null;
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const [mpPick, setMpPick] = useState('');
  const mpId = mpPick || (mps.data ?? [])[0]?.id || '';
  const [inactive, setInactive] = useState(false);
  const scaleId = cp?.grading_scale_id ?? null;
  const scales = useApi(cpId ? ['admin', 'grading-scales', campusId ?? 'school'] : null, () => adminGrades.scales(campusId));
  const scale = (scales.data ?? []).find((s) => s.id === scaleId) ?? (scales.data ?? []).find((s) => (s as { is_active?: boolean }).is_active) ?? (scales.data ?? [])[0];
  const scaleRowsRes = useApi(scale ? ['admin', 'scale-grades', scale.id] : null, ([, , s]) => adminGrades.scaleGrades(s as string));
  const scaleGrades = [...(scaleRowsRes.data ?? [])].sort((a, b) => (b.break_off ?? 0) - (a.break_off ?? 0));
  // Students of the class (with inactive ones when asked) merged with the saved final grades.
  const data = useApi(cpId && mpId ? ['admin', 'tp-final-grades', cpId, mpId, inactive ? 1 : 0] : null, async ([, , c, m]) => {
    const [list, grades] = await Promise.all([adminScheduling.classListForPeriod(c as string), adminTeacherPrograms.finalGrades(c as string, m as string)]);
    if (!list.success) return { ...list, data: undefined };
    // A failed grades load must not show (and then save over) existing grades as blank.
    if (!grades.success) return { ...grades, data: undefined };
    const byStudent = new Map((grades.data ?? []).map((g) => [g.student_id, g]));
    const rows: Row[] = (list.data?.students ?? [])
      .filter((s) => inactive || !s.end_date)
      .map((s) => {
        const g = byStudent.get(s.student_id);
        return { student_id: s.student_id, name: s.student_name, number: '', letter: g?.letter_grade ?? 'N/A', percent: g?.percent_grade != null ? String(g.percent_grade) : '', comment: g?.comment ?? '' };
      });
    return { success: true, data: rows };
  });
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [editsKey, setEditsKey] = useState('');
  const key = `${cpId}|${mpId}|${inactive}`;
  if (editsKey !== key) {
    setEditsKey(key);
    setEdits({});
  }
  const rows = (data.data ?? []).map((r) => ({ ...r, ...edits[r.student_id] }));
  const [saving, setSaving] = useState(false);
  // Teacher app (web: /teacher/grades/input-final-grades, InputFinalGrades): import from the gradebook and clear all.
  const role = useRoleBase();
  const portal = usePortalAcademicOptional();
  const yearId = portal?.year?.id ?? null;
  const it = (k: string) => t(`teacherPages.inputFinalGrades.${k}`);

  async function importGradebook() {
    if (!cpId || !mpId || !yearId) return;
    const r = await adminTeacherPrograms.importFromGradebook({ course_period_id: cpId, marking_period_id: mpId, academic_year_id: yearId, override_existing: true });
    if (!r.success) return toast.error(r.error || it('importGradesFailed'));
    toast.success(it('importedFromGradebook'));
    setEdits({});
    data.mutate();
  }

  const clearAll = () => setEdits(Object.fromEntries(rows.map((r) => [r.student_id, { letter: 'N/A', percent: '', comment: '' }])));

  const setLetter = (r: Row, letter: string) => {
    const match = scaleGrades.find((g) => g.title === letter);
    setEdits((e) => ({ ...e, [r.student_id]: { ...e[r.student_id], letter, ...(match && !r.percent ? { percent: String(match.break_off ?? '') } : {}) } }));
  };

  async function save() {
    if (!cpId || !mpId || !rows.length) return;
    setSaving(true);
    try {
      const results = await Promise.all(
        rows.map((r) =>
          adminTeacherPrograms.saveFinalGrade({
            student_id: r.student_id,
            course_period_id: cpId,
            marking_period_id: mpId,
            percent_grade: r.percent !== '' ? parseFloat(r.percent) : null,
            letter_grade: r.letter !== 'N/A' ? r.letter : null,
            comment: r.comment || null,
            is_override: true,
          }),
        ),
      );
      const failed = results.filter((x) => !x.success).length;
      if (failed) toast.error(f('savePartialFailure', { count: failed, total: rows.length }));
      else toast.success(f('saveSuccess'));
      data.mutate();
    } catch {
      toast.error(f('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Card>
            <CardContent className="gap-3 pt-4">
              <TeacherCoursePeriodPicker value={sel} onChange={setSel} />
              <View className="gap-1.5">
                <Label>{f('markingPeriod')}</Label>
                <Picker value={mpId} onChange={setMpPick} placeholder={f('markingPeriodPlaceholder')} options={(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))} />
              </View>
              <View className="flex-row items-center gap-3">
                <Switch checked={inactive} onCheckedChange={setInactive} />
                <Text className="flex-1 text-sm">{f('includeInactive')}</Text>
              </View>
              {role.isTeacher ? (
                <View className="flex-row flex-wrap gap-2">
                  <Button variant="outline" size="sm" onPress={importGradebook} disabled={!cpId || !mpId || !yearId}>
                    <Text>{it('getGradebookGrades')}</Text>
                  </Button>
                  <Button variant="outline" size="sm" onPress={clearAll} disabled={!rows.length}>
                    <Text>{it('clearAll')}</Text>
                  </Button>
                </View>
              ) : null}
              <Button onPress={save} disabled={saving || !rows.length}>
                <Icon as={Save} className="text-primary-foreground size-4" />
                <Text>{f('save')}</Text>
              </Button>
            </CardContent>
          </Card>
          {!cp ? (
            <EmptyState title={f('selectPrompt')} />
          ) : data.isLoading ? (
            <LoadingList rows={5} />
          ) : data.error ? (
            <ErrorState message={data.error.message} onRetry={() => data.mutate()} />
          ) : !rows.length ? (
            <EmptyState title={f('noStudents')} />
          ) : (
            <Card>
              <CardContent className="py-1">
                {rows.map((r, i) => (
                  <View key={r.student_id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="gap-2 py-2.5">
                      <Text className="text-sm font-semibold">{r.name}</Text>
                      <View className="flex-row gap-2">
                        <View className="flex-1">
                          <Picker value={r.letter} onChange={(v) => setLetter(r, v)} options={[{ value: 'N/A', label: 'N/A' }, ...scaleGrades.map((g) => ({ value: g.title, label: g.title }))]} />
                        </View>
                        <Input
                          className="w-24"
                          value={r.percent}
                          onChangeText={(v) => setEdits((e) => ({ ...e, [r.student_id]: { ...e[r.student_id], percent: v.replace(/[^\d.]/g, '') } }))}
                          keyboardType="decimal-pad"
                          placeholder="%"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
