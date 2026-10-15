import type { HistoricalGradeEntry, HistoricalGradeInput, HistoricalGradeMP } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminHistoricalGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

type Num = 'grade_percent' | 'gp_scale' | 'credit_attempted' | 'credit_earned';
type Draft = { course_title: string; grade_letter: string; comment: string } & Record<Num, string>;
type Row = Draft & { id: string; _dirty?: boolean; _isNew?: boolean; _deleted?: boolean };

const BLANK: Draft = { course_title: '', grade_letter: '', grade_percent: '', gp_scale: '', credit_attempted: '', credit_earned: '', comment: '' };
const str = (n: number | null | undefined) => (n == null ? '' : String(n));
const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};
const toRow = (g: HistoricalGradeEntry): Row => ({
  id: g.id,
  course_title: g.course_title,
  grade_letter: g.grade_letter ?? '',
  grade_percent: str(g.grade_percent),
  gp_scale: str(g.gp_scale),
  credit_attempted: str(g.credit_attempted),
  credit_earned: str(g.credit_earned),
  comment: g.comment ?? '',
});
const toInput = (r: Draft): HistoricalGradeInput => ({
  course_title: r.course_title.trim(),
  grade_letter: r.grade_letter.trim() || null,
  grade_percent: num(r.grade_percent),
  gp_scale: num(r.gp_scale),
  credit_attempted: num(r.credit_attempted),
  credit_earned: num(r.credit_earned),
  comment: r.comment.trim() || null,
});

function useH() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`school.grades_module.historical_grades.${k}`, o);
}

function GradeFields({ value, onChange }: { value: Draft; onChange: (p: Partial<Draft>) => void }) {
  const h = useH();
  const field = (k: Num, label: string) => (
    <View className="flex-1 gap-1">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Input value={value[k]} onChangeText={(v) => onChange({ [k]: v })} keyboardType="decimal-pad" />
    </View>
  );
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <View className="flex-[3] gap-1">
          <Text className="text-muted-foreground text-xs">{h('th_course')}</Text>
          <Input value={value.course_title} onChangeText={(v) => onChange({ course_title: v })} placeholder={h('course_placeholder')} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-muted-foreground text-xs">{h('th_grade')}</Text>
          <Input value={value.grade_letter} onChangeText={(v) => onChange({ grade_letter: v })} autoCapitalize="characters" />
        </View>
      </View>
      <View className="flex-row gap-2">
        {field('grade_percent', h('th_percent'))}
        {field('gp_scale', h('th_gp'))}
        {field('credit_attempted', h('th_cr_att'))}
        {field('credit_earned', h('th_cr_earn'))}
      </View>
      <View className="gap-1">
        <Text className="text-muted-foreground text-xs">{h('th_comment')}</Text>
        <Input value={value.comment} onChangeText={(v) => onChange({ comment: v })} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="items-center py-3">
        <Text className="text-xl font-bold">{value}</Text>
        <Text className="text-muted-foreground text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}

/** One past marking period's grades for the student: grade level, stats, rows, save, remove period. */
function PeriodEditor({ studentId, mp, grades, onSaved, onRemoved }: { studentId: string; mp: HistoricalGradeMP; grades: HistoricalGradeEntry[]; onSaved: () => Promise<void>; onRemoved: () => void }) {
  const h = useH();
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>(grades.map(toRow));
  const [gradeLevel, setGradeLevel] = useState(mp.grade_level ?? '');
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);

  const update = (id: string, p: Partial<Draft>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p, _dirty: true } : r)));
  const remove = (r: Row) => setRows((prev) => (r._isNew ? prev.filter((x) => x.id !== r.id) : prev.map((x) => (x.id === r.id ? { ...x, _deleted: true } : x))));
  const add = () => {
    if (!draft.course_title.trim()) return toast.error(h('msg_course_required'));
    setRows((prev) => [...prev, { ...draft, course_title: draft.course_title.trim(), id: `new-${Date.now()}`, _isNew: true, _dirty: true }]);
    setDraft(BLANK);
  };

  async function save() {
    if (rows.some((r) => !r._deleted && !r.course_title.trim())) return toast.error(h('msg_course_required'));
    setSaving(true);
    let errors = 0;
    try {
      for (const r of rows.filter((x) => x._deleted && !x._isNew)) if (!(await adminHistoricalGrades.deleteHistoricalGrade(r.id)).success) errors++;
      for (const r of rows.filter((x) => x._isNew && !x._deleted)) if (!(await adminHistoricalGrades.createHistoricalGrade(studentId, mp.mp_id, toInput(r))).success) errors++;
      for (const r of rows.filter((x) => x._dirty && !x._isNew && !x._deleted)) if (!(await adminHistoricalGrades.updateHistoricalGrade(r.id, toInput(r))).success) errors++;
      // The web's grade level box is never saved; the app saves it with the grades.
      if (gradeLevel.trim() !== (mp.grade_level ?? '')) if (!(await adminHistoricalGrades.updateStudentMarkingPeriod(studentId, mp.mp_id, gradeLevel.trim() || null)).success) errors++;
      if (errors) toast.error(h('msg_save_partial', { count: errors }));
      else toast.success(h('msg_save_success'));
      await onSaved();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function removePeriod() {
    if (!(await confirm({ title: h('btn_remove_mp'), body: h('remove_mp_confirm', { name: mp.mp_name }), destructive: true, confirmLabel: h('btn_remove_mp') }))) return;
    setSaving(true);
    try {
      const r = await adminHistoricalGrades.removeStudentMarkingPeriod(studentId, mp.mp_id);
      if (!r.success) return toast.error(r.error || h('msg_load_failed'));
      toast.success(h('msg_mp_removed'));
      onRemoved();
    } finally {
      setSaving(false);
    }
  }

  const visible = rows.filter((r) => !r._deleted);
  const graded = visible.filter((r) => num(r.gp_scale) != null);
  const gpa = graded.length ? graded.reduce((s, r) => s + (num(r.gp_scale) ?? 0), 0) / graded.length : 0;
  const attempted = visible.reduce((s, r) => s + (num(r.credit_attempted) ?? 0), 0);
  const earned = visible.reduce((s, r) => s + (num(r.credit_earned) ?? 0), 0);
  const dirty = rows.some((r) => r._dirty || r._deleted || r._isNew) || gradeLevel.trim() !== (mp.grade_level ?? '');

  return (
    <>
      <Card>
        <CardContent className="gap-3 pt-4">
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-muted-foreground text-xs uppercase">{h('mp_label')}</Text>
              <Text className="text-primary font-semibold">{mp.mp_name}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground text-xs uppercase">{h('school_year_label')}</Text>
              <Text className="font-semibold">{mp.school_year || '—'}</Text>
            </View>
          </View>
          <View className="gap-1">
            <Label>{h('grade_level_label')}</Label>
            <Input value={gradeLevel} onChangeText={setGradeLevel} placeholder="—" />
          </View>
          <Button variant="destructive" size="sm" onPress={removePeriod} disabled={saving}>
            <Icon as={Trash2} className="size-4 text-white" />
            <Text>{h('btn_remove_mp')}</Text>
          </Button>
        </CardContent>
      </Card>
      <View className="flex-row flex-wrap gap-2">
        <Stat value={gpa.toFixed(2)} label={h('stat_gpa')} />
        <Stat value={visible.length} label={h('stat_courses')} />
        <Stat value={attempted.toFixed(1)} label={h('stat_credits_attempted')} />
        <Stat value={earned.toFixed(1)} label={h('stat_credits_earned')} />
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground flex-1 text-sm">{h('entries_count', { count: visible.length })}</Text>
        <Button size="sm" onPress={save} disabled={!dirty || saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{h('btn_save')}</Text>
        </Button>
      </View>
      {visible.map((r) => (
        <Card key={r.id}>
          <CardContent className="gap-2 pt-3">
            <View className="items-end">
              <Pressable onPress={() => remove(r)} hitSlop={8} className="p-1" accessibilityLabel={t('common.delete')}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
            <GradeFields value={r} onChange={(p) => update(r.id, p)} />
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="gap-3 pt-4">
          <GradeFields value={draft} onChange={(p) => setDraft({ ...draft, ...p })} />
          <Button variant="outline" onPress={add}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{t('common.add')}</Text>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

/** A student's historical marking periods and grades (web: /admin/grades/historical-grades, student view). */
export default function StudentHistoricalGrades() {
  const h = useH();
  const toast = useToast();
  const { campusId } = useCampus();
  const { id, name, number, grade } = useLocalSearchParams<{ id: string; name?: string; number?: string; grade?: string }>();
  const studentId = id ?? null;
  const mps = useApi(studentId ? ['admin', 'historical-mps', studentId] : null, ([, , s]) => adminHistoricalGrades.studentMarkingPeriods(s as string));
  const available = useApi(['admin', 'history-mps', campusId ?? 'school'], () => adminHistoricalGrades.historyMarkingPeriods(campusId));
  const [picked, setPicked] = useState<string | null>(null);
  const list = mps.data ?? [];
  const activeId = list.some((m) => m.mp_id === picked) ? picked : (list[0]?.mp_id ?? null);
  const active = list.find((m) => m.mp_id === activeId) ?? null;
  const grades = useApi(studentId && activeId ? ['admin', 'historical-grades', studentId, activeId] : null, ([, , s, m]) => adminHistoricalGrades.historicalGrades(s as string, m as string));
  const [addId, setAddId] = useState('');
  const [addLevel, setAddLevel] = useState('');
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  const addable = (available.data ?? []).filter((a) => !list.some((m) => m.mp_id === a.id));
  async function addPeriod() {
    if (!studentId || !addId) return;
    setAdding(true);
    try {
      const r = await adminHistoricalGrades.addStudentMarkingPeriod(studentId, addId, addLevel.trim() || null);
      if (!r.success) return toast.error(r.error || h('msg_load_failed'));
      toast.success(h('msg_mp_added'));
      setPicked(addId);
      setAddId('');
      setAddLevel('');
      mps.mutate();
    } finally {
      setAdding(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView
          contentContainerClassName="gap-3 p-4 pb-10"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                mps.mutate();
                grades.mutate();
              }}
            />
          }>
          <Text className="text-lg font-semibold">
            {name || '—'}
            {number ? <Text className="text-muted-foreground text-sm font-normal"> #{number}</Text> : null}
            {grade ? <Text className="text-muted-foreground text-sm font-normal"> — {grade}</Text> : null}
          </Text>
          <Card>
            <CardContent className="gap-2 pt-4">
              {addable.length ? (
                <Picker
                  value={addId}
                  onChange={setAddId}
                  placeholder={h('add_mp_placeholder')}
                  options={addable.map((a) => ({ value: a.id, label: `${a.school_year}, ${a.name}` }))}
                />
              ) : (
                <Text className="text-muted-foreground text-sm">{h('no_mps_available')}</Text>
              )}
              {addId ? (
                <View className="gap-2">
                  <Text className="font-semibold">{h('add_mp_title')}</Text>
                  <View className="gap-1">
                    <Label>{h('grade_level_label')}</Label>
                    <Input value={addLevel} onChangeText={setAddLevel} />
                  </View>
                  <View className="flex-row gap-2">
                    <Button variant="outline" className="flex-1" onPress={() => setAddId('')} disabled={adding}>
                      <Text>{h('btn_cancel')}</Text>
                    </Button>
                    <Button className="flex-1" onPress={addPeriod} disabled={adding}>
                      <Text>{h('btn_save')}</Text>
                    </Button>
                  </View>
                </View>
              ) : null}
            </CardContent>
          </Card>
          {mps.isLoading ? (
            <LoadingList rows={3} />
          ) : mps.error ? (
            <ErrorState message={mps.error.message || h('msg_load_failed')} onRetry={() => mps.mutate()} />
          ) : !list.length ? (
            <Text className="text-muted-foreground py-6 text-center text-sm">{h('no_historical_mps')}</Text>
          ) : (
            <>
              <FilterChips value={activeId ?? ''} onChange={setPicked} options={list.map((m) => ({ value: m.mp_id, label: m.school_year ? `${m.mp_name} (${m.school_year})` : m.mp_name }))} />
              {grades.isLoading || !active ? (
                <LoadingList rows={3} />
              ) : grades.error ? (
                <ErrorState message={grades.error.message || h('msg_load_failed')} onRetry={() => grades.mutate()} />
              ) : (
                <PeriodEditor
                  key={`${active.mp_id}:${version}`}
                  studentId={studentId ?? ''}
                  mp={active}
                  grades={grades.data ?? []}
                  onSaved={async () => {
                    await Promise.all([grades.mutate(), mps.mutate()]);
                    setVersion((v) => v + 1);
                  }}
                  onRemoved={() => {
                    setPicked(null);
                    mps.mutate();
                  }}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
