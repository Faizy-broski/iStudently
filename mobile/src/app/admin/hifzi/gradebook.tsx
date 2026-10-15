import type { HifziBridgePreviewRow, HifziBridgeResult } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Eye, Link2, Save, UploadCloud } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades, adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

const pct = (v: number | null) => (v !== null ? v.toFixed(1) : '—');

/** Link the grade's Quran course, then preview and push a term's Hifzi marks into the gradebook (web: /admin/hifzi/gradebook). */
export default function HifziGradebook() {
  const { h } = useHz('gradebook');
  const toast = useToast();
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const courses = useApi(['admin', 'hifzi-courses', campusId ?? 'school'], () => adminHifzi.courses(campusId));
  const year = useApi(['admin', 'academic-year-current'], () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;

  const [pickedGrade, setPickedGrade] = useState('');
  const gradeList = grades.data ?? [];
  const gradeId = gradeList.some((g) => g.id === pickedGrade) ? pickedGrade : (gradeList[0]?.id ?? '');
  const [pickedMp, setPickedMp] = useState('');
  const mpList = mps.data ?? [];
  const mpId = mpList.some((m) => m.id === pickedMp) ? pickedMp : (mpList[0]?.id ?? '');

  const subjects = useApi(gradeId ? ['admin', 'subjects', campusId ?? 'school', gradeId] : null, ([, , , g]) => adminAcademics.subjects(campusId, g as string));
  const link = useApi(gradeId && yearId ? ['admin', 'hifzi-gb-link', gradeId, yearId, campusId ?? 'school'] : null, ([, , g, y]) => adminHifzi.gradebookLink(g as string, y as string, campusId));

  // Form values: local edits over the saved link (reset when the grade changes).
  const [form, setForm] = useState<{ key: string; subjectId?: string; courseId?: string; ca?: string }>({ key: '' });
  const formKey = `${gradeId}|${yearId}`;
  const [preview, setPreview] = useState<HifziBridgePreviewRow[] | null>(null);
  const [result, setResult] = useState<HifziBridgeResult | null>(null);
  if (form.key !== formKey) {
    setForm({ key: formKey });
    setPreview(null);
    setResult(null);
  }
  const saved = link.data ?? null;
  const subjectId = form.subjectId ?? saved?.subject_id ?? '';
  const courseId = form.courseId ?? saved?.course_id ?? '';
  const ca = form.ca ?? (saved ? String(saved.ca_weight_percent) : '70');
  const courseOptions = (courses.data ?? []).filter((c) => c.subject_id === subjectId);
  const [busy, setBusy] = useState<'save' | 'preview' | 'run' | null>(null);

  async function saveLink() {
    if (!gradeId || !yearId || !subjectId || !courseId) return;
    const caN = Number(ca);
    if (!(caN >= 0 && caN <= 100)) return toast.error(h('invalidWeight'));
    setBusy('save');
    try {
      const res = await adminHifzi.linkGradebook({ grade_level_id: gradeId, academic_year_id: yearId, subject_id: subjectId, course_id: courseId, ca_weight_percent: caN, exam_weight_percent: 100 - caN }, campusId);
      if (!res.success) return toast.error(res.error || h('linkError'));
      toast.success(h('linkSaved'));
      link.mutate();
    } finally {
      setBusy(null);
    }
  }

  async function runPreview() {
    if (!gradeId || !yearId || !mpId) return;
    setBusy('preview');
    setResult(null);
    try {
      const res = await adminHifzi.previewBridge(gradeId, yearId, mpId, campusId);
      if (!res.success || !res.data) return toast.error(res.error || h('previewError'));
      setPreview(res.data);
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    if (!gradeId || !yearId || !mpId) return;
    setBusy('run');
    try {
      const res = await adminHifzi.runBridge(gradeId, yearId, mpId, campusId);
      if (!res.success || !res.data) return toast.error(res.error || h('runError'));
      setResult(res.data);
      toast.success(h('runSuccess', { saved: res.data.saved, skipped: res.data.skipped }));
    } finally {
      setBusy(null);
    }
  }

  const loading = grades.isLoading || mps.isLoading || year.isLoading;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
          {loading ? (
            <LoadingList rows={4} />
          ) : (
            <>
              <View className="gap-1.5">
                <Label>{h('gradeLevel')}</Label>
                <Picker value={gradeId} onChange={setPickedGrade} options={gradeList.map((g) => ({ value: g.id, label: g.name }))} />
              </View>
              <View className="gap-1.5">
                <Label>{h('markingPeriod')}</Label>
                <Picker value={mpId} onChange={setPickedMp} options={mpList.map((m) => ({ value: m.id, label: m.title }))} />
              </View>

              <Card>
                <CardContent className="gap-3 pt-4">
                  <View className="flex-row items-center gap-2">
                    <Icon as={Link2} className="text-primary size-4" />
                    <Text className="flex-1 font-semibold">{h('linkSectionTitle')}</Text>
                    {saved ? (
                      <Badge variant="secondary">
                        <Text className="text-xs">{h('linked')}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <View className="gap-1.5">
                    <Label>{h('subject')}</Label>
                    <Picker value={subjectId} onChange={(v) => setForm((f) => ({ ...f, subjectId: v, courseId: '' }))} placeholder={h('selectSubject')} options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
                  </View>
                  <View className="gap-1.5">
                    <Label>{h('course')}</Label>
                    <Picker value={courseId} onChange={(v) => setForm((f) => ({ ...f, courseId: v }))} placeholder={h('selectCourse')} options={courseOptions.map((c) => ({ value: c.id, label: c.title }))} />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1 gap-1.5">
                      <Label>{h('caWeight')}</Label>
                      <Input value={ca} onChangeText={(v) => setForm((f) => ({ ...f, ca: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" />
                    </View>
                    <View className="flex-1 gap-1.5">
                      <Label>{h('examWeight')}</Label>
                      <Input value={String(100 - (Number(ca) || 0))} editable={false} />
                    </View>
                  </View>
                  <Button size="sm" onPress={saveLink} disabled={busy !== null || !subjectId || !courseId}>
                    <Icon as={Save} className="text-primary-foreground size-4" />
                    <Text>{h('saveLink')}</Text>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="gap-3 pt-4">
                  <Text className="font-semibold">{h('bridgeSectionTitle')}</Text>
                  <View className="flex-row gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onPress={runPreview} disabled={busy !== null || !saved}>
                      <Icon as={Eye} className="text-foreground size-4" />
                      <Text>{h('preview')}</Text>
                    </Button>
                    <Button size="sm" className="flex-1" onPress={run} disabled={busy !== null || !saved}>
                      <Icon as={UploadCloud} className="text-primary-foreground size-4" />
                      <Text>{h('pushToGradebook')}</Text>
                    </Button>
                  </View>
                  {!saved ? <Text className="text-muted-foreground text-xs">{h('noLinkYet')}</Text> : null}
                  {result ? (
                    <View className="gap-1 rounded-md bg-green-50 p-3 dark:bg-green-950">
                      <Text className="text-sm">{h('runSummary', { processed: result.processed, saved: result.saved, skipped: result.skipped })}</Text>
                      {result.errors.slice(0, 10).map((e, i) => (
                        <Text key={i} className="text-destructive text-xs">
                          • {e}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {preview ? (
                    !preview.length ? (
                      <Text className="text-muted-foreground text-sm">{h('noStudents')}</Text>
                    ) : (
                      <View>
                        {preview.map((r, i) => (
                          <View key={r.studentId}>
                            {i > 0 ? <Separator /> : null}
                            <View className="gap-0.5 py-2">
                              <View className="flex-row items-center justify-between gap-2">
                                <Text className="flex-1 font-medium">{r.studentName}</Text>
                                <Text className="font-semibold">{r.letterGrade ?? '—'}</Text>
                              </View>
                              <Text className="text-muted-foreground text-xs">
                                {h('caPercent')} {pct(r.caPercent)} · {h('examPercent')} {pct(r.examPercent)} · {h('finalPercent')} {pct(r.finalPercent)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
