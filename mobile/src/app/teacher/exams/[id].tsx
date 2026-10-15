import type { TeacherExamResult } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { PortalError } from '@/features/portal/ui';
import { useTeacherExams } from '@/features/teacher/exams';
import { exams } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Every student's result for one exam; mark or edit marks, absence and remarks (web: /teacher/exams, grading dialog). */
export default function TeacherExamGrading() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.exams.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profileId = me.status === 'ready' ? me.me.profile.id : null;
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useTeacherExams();
  const exam = (list.data ?? []).find((e) => e.id === id) ?? null;
  const res = useApi(id ? ['teacher', 'exam-results', id] : null, ([, , e]) => exams.results(e as string));
  const [marking, setMarking] = useState<TeacherExamResult | null>(null);
  const [form, setForm] = useState({ marks: '', absent: false, remarks: '' });
  const [busy, setBusy] = useState(false);
  const nameOf = (r: TeacherExamResult) => `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim();

  function open(r: TeacherExamResult) {
    setMarking(r);
    setForm({ marks: r.marks_obtained != null ? String(r.marks_obtained) : '', absent: r.is_absent, remarks: r.remarks ?? '' });
  }

  async function save() {
    if (!marking || !profileId || !id) return;
    if (!form.absent && !form.marks) return toast.error(k('enterMarksOrAbsent'));
    setBusy(true);
    const r = await exams.recordMarks({ exam_id: id, student_id: marking.student_id, marks_obtained: form.absent ? undefined : parseFloat(form.marks), is_absent: form.absent, remarks: form.remarks, marked_by: profileId });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('recordMarksFailed'));
    toast.success(k('marksRecorded'));
    setMarking(null);
    res.mutate();
  }

  if (res.error) return <PortalError title={k('loadResultsFailed')} message={res.error.message} />;
  return (
    <>
      <Stack.Screen options={{ title: k('gradeStudentsTitle', { examName: exam?.exam_name ?? '' }) }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {exam ? <Text className="text-muted-foreground text-sm">{`${exam.section?.name ?? ''} - ${exam.subject?.name ?? ''} • ${k('maxPassLabel', { max: exam.max_marks, pass: exam.passing_marks })}`}</Text> : null}
        {res.isLoading ? (
          <LoadingList rows={5} />
        ) : (
          (res.data ?? []).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex-row items-center gap-3 p-4">
                <View className="flex-1 gap-1">
                  <Text className="font-semibold">{nameOf(r) || '—'}</Text>
                  {r.is_absent ? (
                    <Text className="text-sm font-medium text-red-600">{k('absent')}</Text>
                  ) : r.marks_obtained != null ? (
                    <Text className="text-sm">{[k('marksLabel', { marks: r.marks_obtained, max: exam?.max_marks ?? '' }), k('gradeLabel', { grade: r.grade ?? '' }), k('percentageLabel', { percentage: r.percentage?.toFixed(2) ?? '' })].join('  ')}</Text>
                  ) : (
                    <Text className="text-muted-foreground text-sm">{k('notGradedYet')}</Text>
                  )}
                </View>
                <Button size="sm" onPress={() => open(r)}>
                  <Text>{r.marks_obtained != null || r.is_absent ? k('edit') : k('mark')}</Text>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <Dialog open={!!marking} onOpenChange={(o) => !o && setMarking(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{k('recordMarksTitle', { name: marking ? nameOf(marking) : '' })}</DialogTitle>
          </DialogHeader>
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Checkbox checked={form.absent} onCheckedChange={(v) => setForm((x) => ({ ...x, absent: !!v, marks: '' }))} />
              <Text className="text-sm font-medium" onPress={() => setForm((x) => ({ ...x, absent: !x.absent, marks: '' }))}>
                {k('markAsAbsent')}
              </Text>
            </View>
            {!form.absent ? (
              <View className="gap-1.5">
                <Label>{`${k('marksObtained')} *`}</Label>
                <Input value={form.marks} onChangeText={(v) => setForm((x) => ({ ...x, marks: v.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" placeholder={k('outOf', { max: exam?.max_marks ?? '' })} />
              </View>
            ) : null}
            <View className="gap-1.5">
              <Label>{k('remarks')}</Label>
              <Textarea value={form.remarks} onChangeText={(v) => setForm((x) => ({ ...x, remarks: v }))} placeholder={k('optionalFeedback')} />
            </View>
          </View>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setMarking(null)}>
              <Text>{k('cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={save} disabled={busy}>
              <Text>{k('saveMarks')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
