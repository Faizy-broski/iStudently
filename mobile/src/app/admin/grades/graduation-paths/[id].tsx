import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Tick } from '@/features/admin/report-students';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Kind = 'grade_levels' | 'subjects' | 'students';

function Section({ title, count, onAssign, assignLabel, children, empty }: { title: string; count: number; onAssign: () => void; assignLabel: string; children: React.ReactNode; empty: string }) {
  return (
    <Card>
      <CardContent className="gap-1 pt-4">
        <View className="flex-row items-center pb-1">
          <Text className="flex-1 text-xs font-semibold">
            {title} ({count})
          </Text>
          <Button size="sm" variant="outline" onPress={onAssign}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{assignLabel}</Text>
          </Button>
        </View>
        {count ? children : <Text className="text-muted-foreground py-2 text-sm">{empty}</Text>}
      </CardContent>
    </Card>
  );
}

function Row({ label, hint, onRemove }: { label: string; hint?: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <Separator />
      <View className="flex-row items-center gap-2 py-2.5">
        <View className="flex-1">
          <Text className="text-sm font-medium">{label}</Text>
          {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
        </View>
        <Pressable onPress={onRemove} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={t('common.delete')}>
          <Icon as={Trash2} className="text-destructive size-4" />
        </Pressable>
      </View>
    </View>
  );
}

/** One graduation path: assign and remove grade levels, subjects (with credits) and students (web: /admin/grades/graduation-paths dialogs). */
export default function GraduationPathDetail() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.graduation_paths.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathId = id ?? null;
  const path = useApi(pathId ? ['admin', 'graduation-path', pathId] : null, ([, , p]) => adminGrades.graduationPath(p as string));
  const gl = useApi(pathId ? ['admin', 'gp-grade-levels', pathId] : null, ([, , p]) => adminGrades.graduationPathGradeLevels(p as string));
  const subj = useApi(pathId ? ['admin', 'gp-subjects', pathId] : null, ([, , p]) => adminGrades.graduationPathSubjects(p as string));
  const stud = useApi(pathId ? ['admin', 'gp-students', pathId] : null, ([, , p]) => adminGrades.graduationPathStudents(p as string));
  const allGrades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const allSubjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const allStudents = useCampusStudents();
  const [assign, setAssign] = useState<Kind | null>(null);
  const [pickGrades, setPickGrades] = useState<Set<string>>(new Set());
  const [pickSubjects, setPickSubjects] = useState<Map<string, string>>(new Map());
  const [pickStudents, setPickStudents] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const title = path.data?.title ?? '';

  const refresh = () => {
    path.mutate();
    gl.mutate();
    subj.mutate();
    stud.mutate();
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'graduation-paths');
  };
  const open = (k: Kind) => {
    setAssign(assign === k ? null : k);
    setPickGrades(new Set());
    setPickSubjects(new Map());
    setPickStudents(new Set());
    setQ('');
  };

  async function save() {
    if (!pathId || !assign) return;
    setSaving(true);
    try {
      const r =
        assign === 'grade_levels'
          ? await adminGrades.assignPathGradeLevels(pathId, [...pickGrades])
          : assign === 'subjects'
            ? await adminGrades.assignPathSubjects(pathId, [...pickSubjects].map(([subject_id, credits]) => ({ subject_id, credits: Number(credits) || 0 })))
            : await adminGrades.assignPathStudents(pathId, [...pickStudents]);
      if (!r.success) return toast.error(r.error || t('common.error'));
      setAssign(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }
  async function remove(kind: Kind, itemId: string, label: string) {
    if (!pathId) return;
    if (!(await confirm({ title: t('common.delete'), body: label, destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = kind === 'grade_levels' ? await adminGrades.removePathGradeLevel(pathId, itemId) : kind === 'subjects' ? await adminGrades.removePathSubject(pathId, itemId) : await adminGrades.removePathStudent(pathId, itemId);
    if (!r.success) return toast.error(r.error || t('common.error'));
    refresh();
  }

  const assignedGrades = new Set((gl.data ?? []).map((x) => x.grade_level_id));
  const assignedSubjects = new Set((subj.data ?? []).map((x) => x.subject_id));
  const assignedStudents = new Set((stud.data ?? []).map((x) => x.student_id));
  const freeGrades = (allGrades.data ?? []).filter((x) => !assignedGrades.has(x.id));
  const freeSubjects = (allSubjects.data ?? []).filter((x) => !assignedSubjects.has(x.id));
  const term = q.trim().toLowerCase();
  const freeStudentsAll = (allStudents.data ?? []).filter((x) => !assignedStudents.has(x.id));
  const freeStudents = freeStudentsAll.filter((x) => !term || studentFullName(x.profile).toLowerCase().includes(term) || x.student_number.toLowerCase().includes(term));
  const toggle = (set: Set<string>, v: string) => (set.has(v) ? new Set([...set].filter((x) => x !== v)) : new Set([...set, v]));
  const count = assign === 'grade_levels' ? pickGrades.size : assign === 'subjects' ? pickSubjects.size : pickStudents.size;

  const panel = assign ? (
    <Card>
      <CardContent className="gap-2 pt-4">
        <Text className="font-semibold">{assign === 'grade_levels' ? g('assign_gl_title', { title }) : assign === 'subjects' ? g('assign_subj_title', { title }) : g('assign_stud_title', { title })}</Text>
        {assign === 'grade_levels' ? (
          !freeGrades.length ? (
            <Text className="text-muted-foreground text-sm">{g('all_gl_assigned')}</Text>
          ) : (
            freeGrades.map((x) => (
              <Pressable key={x.id} onPress={() => setPickGrades(toggle(pickGrades, x.id))} className="flex-row items-center gap-3 py-2">
                <Tick on={pickGrades.has(x.id)} />
                <Text className="text-sm">{x.name}</Text>
              </Pressable>
            ))
          )
        ) : assign === 'subjects' ? (
          !freeSubjects.length ? (
            <Text className="text-muted-foreground text-sm">{g('all_subj_assigned')}</Text>
          ) : (
            freeSubjects.map((x) => {
              const credits = pickSubjects.get(x.id);
              return (
                <View key={x.id} className="flex-row items-center gap-3 py-1.5">
                  <Pressable
                    onPress={() => {
                      const next = new Map(pickSubjects);
                      if (next.has(x.id)) next.delete(x.id);
                      else next.set(x.id, '3');
                      setPickSubjects(next);
                    }}
                    className="flex-1 flex-row items-center gap-3">
                    <Tick on={credits !== undefined} />
                    <Text className="flex-1 text-sm">{x.name}</Text>
                  </Pressable>
                  {credits !== undefined ? (
                    <Input value={credits} onChangeText={(v) => setPickSubjects(new Map(pickSubjects).set(x.id, v.replace(/[^0-9.]/g, '')))} keyboardType="decimal-pad" placeholder={g('credits_placeholder')} className="h-9 w-20" />
                  ) : null}
                </View>
              );
            })
          )
        ) : (
          <>
            <SearchBar value={q} onChangeText={setQ} placeholder={g('search_students')} />
            {!freeStudents.length ? <Text className="text-muted-foreground py-3 text-center text-sm">{freeStudentsAll.length ? g('no_stud_match') : g('all_stud_assigned')}</Text> : null}
            {freeStudents.slice(0, 300).map((x) => (
              <Pressable key={x.id} onPress={() => setPickStudents(toggle(pickStudents, x.id))} className="flex-row items-center gap-3 py-2">
                <Tick on={pickStudents.has(x.id)} />
                <View className="flex-1">
                  <Text className="text-sm">{studentFullName(x.profile) || x.student_number}</Text>
                  <Text className="text-muted-foreground text-xs">{[x.student_number, x.grade_level].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        <View className="flex-row gap-2 pt-1">
          <Button variant="outline" className="flex-1" onPress={() => setAssign(null)} disabled={saving}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={save} disabled={!count || saving}>
            <Text>{assign === 'students' ? g('btn_add_selected_count', { count }) : g('btn_add_selected')}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  ) : null;

  const loading = gl.isLoading || subj.isLoading || stud.isLoading;
  const err = gl.error || subj.error || stud.error;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: title || g('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
          {path.data?.comment ? <Text className="text-muted-foreground text-sm">{path.data.comment}</Text> : null}
          {loading ? (
            <LoadingList rows={5} />
          ) : err ? (
            <ErrorState message={err.message} onRetry={refresh} />
          ) : (
            <>
              {panel}
              <Section title={g('th_grade_levels')} count={gl.data?.length ?? 0} onAssign={() => open('grade_levels')} assignLabel={g('btn_assign_gl')} empty={g('no_assigned', { type: g('th_grade_levels').toLowerCase() })}>
                {(gl.data ?? []).map((x) => (
                  <Row key={x.id} label={x.grade_level?.name ?? '—'} onRemove={() => remove('grade_levels', x.grade_level_id, x.grade_level?.name ?? '')} />
                ))}
              </Section>
              <Section title={g('th_subjects')} count={subj.data?.length ?? 0} onAssign={() => open('subjects')} assignLabel={g('btn_assign_subj')} empty={g('no_assigned', { type: g('th_subjects').toLowerCase() })}>
                {(subj.data ?? []).map((x) => (
                  <Row key={x.id} label={x.subject?.name ?? '—'} hint={`${x.credits} ${g('credits_placeholder').toLowerCase()}`} onRemove={() => remove('subjects', x.subject_id, x.subject?.name ?? '')} />
                ))}
              </Section>
              <Section title={g('th_students')} count={stud.data?.length ?? 0} onAssign={() => open('students')} assignLabel={g('btn_assign_stud')} empty={g('no_assigned', { type: g('th_students').toLowerCase() })}>
                {(stud.data ?? []).map((x) => {
                  const name = studentFullName(x.student?.profile) || x.student?.student_number || '—';
                  return <Row key={x.id} label={name} hint={x.student?.student_number} onRemove={() => remove('students', x.student_id, name)} />;
                })}
              </Section>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
