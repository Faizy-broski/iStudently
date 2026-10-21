import { Stack } from 'expo-router';
import { BookOpen, Plus, Save } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { TeacherCoursePeriodPicker, useTeacherSelection } from '@/features/admin/teacher-programs';
import { adminTeacherPrograms } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const pointColor = (v: string, max: number) => {
  const n = parseFloat(v);
  if (!v || Number.isNaN(n)) return 'text-muted-foreground';
  const pct = (n / Math.max(1, max)) * 100;
  return pct >= 90 ? 'text-success' : pct >= 80 ? 'text-brand dark:text-brand-secondary' : pct >= 70 ? 'text-warning' : 'text-destructive';
};

/** A teacher's gradebook matrix, edited by an admin: points per student per assignment, add an assignment (web: /admin/teacher-programs/gradebook). */
export default function AdminGradebook() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`teacherPrograms.gradebook.${k}`, o);
  const toast = useToast();
  const [sel, setSel] = useTeacherSelection();
  const cpId = sel.coursePeriod?.id ?? null;
  const matrix = useApi(cpId ? ['admin', 'tp-gradebook', cpId] : null, ([, , c]) => adminTeacherPrograms.gradebook(c as string));
  const m = matrix.data ?? null;
  const [pending, setPending] = useState<Record<string, string>>({});
  const [assignmentId, setAssignmentId] = useState('');
  const [adding, setAdding] = useState<{ title: string; points: string; due: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keyOf = (s: string, a: string) => `${s}_${a}`;
  const value = (s: string, a: string) => {
    const k = keyOf(s, a);
    if (k in pending) return pending[k];
    const gr = m?.grades.find((x) => x.student_id === s && x.assignment_id === a);
    return gr?.points != null ? String(gr.points) : '';
  };
  const activeAssignment = m?.assignments.find((a) => a.id === assignmentId) ?? m?.assignments[0] ?? null;

  async function save() {
    if (!m || !cpId || !Object.keys(pending).length) return;
    setBusy(true);
    try {
      const by: Record<string, { student_id: string; points: number | null }[]> = {};
      for (const [k, v] of Object.entries(pending)) {
        const [s, a] = k.split('_');
        (by[a] ??= []).push({ student_id: s, points: v === '' ? null : parseFloat(v) });
      }
      const results = await Promise.all(Object.entries(by).map(([a, grades]) => adminTeacherPrograms.bulkEnterGrades({ assignment_id: a, course_period_id: cpId, grades })));
      if (results.some((r) => !r.success)) return toast.error(g('saveFailed'));
      setPending({});
      await matrix.mutate();
      toast.success(g('saveSuccess'));
    } finally {
      setBusy(false);
    }
  }

  async function addAssignment() {
    if (!adding || !cpId || !adding.title || !adding.type) return;
    setBusy(true);
    try {
      const r = await adminTeacherPrograms.createAssignment({ title: adding.title, course_period_id: cpId, assignment_type_id: adding.type, points: parseFloat(adding.points) || 100, due_date: adding.due || null });
      if (!r.success) return toast.error(r.error || g('assignmentAddFailed'));
      setAdding(null);
      await matrix.mutate();
      toast.success(g('assignmentAdded'));
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = Object.keys(pending).length;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
          <Card>
            <CardContent className="pt-4">
              <TeacherCoursePeriodPicker
                value={sel}
                onChange={(v) => {
                  setSel(v);
                  setPending({});
                  setAssignmentId('');
                }}
              />
            </CardContent>
          </Card>
          {!cpId ? (
            <EmptyState icon={BookOpen} title={g('selectPrompt')} />
          ) : matrix.isLoading ? (
            <LoadingList rows={5} />
          ) : !m || !m.students.length ? (
            <EmptyState title={g('noStudents')} />
          ) : (
            <>
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setAdding({ title: '', points: '100', due: '', type: '' })}>
                  <Icon as={Plus} className="text-foreground size-4" />
                  <Text>{g('addAssignment')}</Text>
                </Button>
                <Button className="flex-1" onPress={save} disabled={!pendingCount || busy}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>
                    {g('save')}
                    {pendingCount ? ` (${pendingCount})` : ''}
                  </Text>
                </Button>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-muted-foreground text-xs">{t('app.tp_counts', { students: m.students.length, assignments: m.assignments.length })}</Text>
                {pendingCount ? (
                  <Badge variant="secondary">
                    <Text className="text-xs">{g('unsavedChanges', { count: pendingCount })}</Text>
                  </Badge>
                ) : null}
              </View>
              {m.assignments.length ? (
                <Picker value={activeAssignment?.id ?? ''} onChange={setAssignmentId} options={m.assignments.map((a) => ({ value: a.id, label: `${a.title} /${a.points}` }))} />
              ) : null}
              {activeAssignment ? (
                <Card>
                  <CardContent className="py-1">
                    {m.students.map((s, i) => {
                      const v = value(s.id, activeAssignment.id);
                      const isPending = keyOf(s.id, activeAssignment.id) in pending;
                      return (
                        <View key={s.id}>
                          {i > 0 ? <Separator /> : null}
                          <View className="flex-row items-center gap-3 py-2">
                            <View className="flex-1">
                              <Text className="text-sm">
                                {s.last_name}, {s.first_name}
                              </Text>
                              <Text className="text-muted-foreground text-xs">{s.student_number}</Text>
                            </View>
                            <Input
                              className={cn('w-20 text-center', isPending && 'border-warning bg-warning-soft ', pointColor(v, activeAssignment.points))}
                              value={v}
                              onChangeText={(x) => setPending((p) => ({ ...p, [keyOf(s.id, activeAssignment.id)]: x.replace(/[^\d.]/g, '') }))}
                              keyboardType="decimal-pad"
                              placeholder="—"
                            />
                          </View>
                        </View>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          {adding ? (
            <View className="gap-3">
              <DialogHeader>
                <DialogTitle>{g('dialogTitle')}</DialogTitle>
              </DialogHeader>
              <View className="gap-1.5">
                <Label>{g('assignmentTitleLabel')}</Label>
                <Input value={adding.title} onChangeText={(v) => setAdding({ ...adding, title: v })} placeholder={g('assignmentTitlePlaceholder')} />
              </View>
              <View className="flex-row gap-2">
                <View className="w-24 gap-1.5">
                  <Label>{g('pointsLabel')}</Label>
                  <Input value={adding.points} onChangeText={(v) => setAdding({ ...adding, points: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
                </View>
                <DateField className="flex-1" label={g('dueDateLabel')} value={adding.due} onChange={(v) => setAdding({ ...adding, due: v })} clearable />
              </View>
              <View className="gap-1.5">
                <Label>{g('typeLabel')}</Label>
                <Picker value={adding.type} onChange={(v) => setAdding({ ...adding, type: v })} placeholder={g('typePlaceholder')} options={(m?.assignment_types ?? []).map((at) => ({ value: at.id, label: at.title }))} />
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setAdding(null)}>
                  <Text>{g('cancel')}</Text>
                </Button>
                <Button className="flex-1" onPress={addAssignment} disabled={busy || !adding.title || !adding.type}>
                  <Text>{g('addAssignment')}</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>
    </View>
  );
}
