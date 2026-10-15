import type { CalcRunResult, Calculation } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Calculator, Delete, Pencil, Play, Save, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
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
import { ResultView } from '@/features/admin/calculations';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCalculations } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const FUNCTIONS = ['sum', 'average', 'count', 'max', 'min', 'average-max', 'average-min', 'sum-max', 'sum-min'];
const OPERATORS = ['+', '-', '*', '/', '(', ')'];
const TIME_FIELDS = ['present', 'absent', 'enrolled'];
const SIS_FIELDS = ['student_id'];
const CONSTANTS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'];
const BREAKDOWNS = ['', 'grade_level', 'section', 'student'];

/** Formula builder over attendance data, with breakdowns and saved calculations (web: /admin/reports/calculations). */
export default function Calculations() {
  const { t } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`admin.reports.calculations.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId, campus } = useCampus();
  const list = useApi(['admin', 'calculations', campusId ?? 'school'], () => adminCalculations.list(campusId));
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [formula, setFormula] = useState('');
  const [pendingFn, setPendingFn] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [breakdown, setBreakdown] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [running, setRunning] = useState(false);
  const [runFor, setRunFor] = useState<string | null>(null);
  const [result, setResult] = useState<CalcRunResult | null>(null);
  const [saving, setSaving] = useState(false);

  const append = (token: string) => {
    setFormula((p) => (p ? `${p} ${token}` : token));
    setResult(null);
  };
  function field(f: string) {
    if (pendingFn) {
      append(`${pendingFn}( ${f} )`);
      setPendingFn(null);
      return;
    }
    // A field needs an operator or "(" before it (web: invalid_field_position).
    const trimmed = formula.trim();
    if (!trimmed || !/[+\-*/(]/.test(trimmed.slice(-1))) return toast.error(c('toast.invalid_field_position'));
    append(f);
  }
  const backspace = () => {
    setFormula((p) => {
      const tr = p.trimEnd();
      const i = tr.lastIndexOf(' ');
      return i === -1 ? '' : tr.slice(0, i);
    });
    setResult(null);
  };
  const reset = () => {
    setEditingId(null);
    setTitle('');
    setFormula('');
    setBreakdown('');
    setResult(null);
    setPendingFn(null);
  };

  async function save() {
    if (!title.trim()) return toast.error(c('toast.enter_title'));
    if (!formula.trim()) return toast.error(c('toast.build_formula'));
    setSaving(true);
    try {
      const r = editingId ? await adminCalculations.update(editingId, { title, formula, breakdown: breakdown || undefined }) : await adminCalculations.create({ title, formula, breakdown: breakdown || undefined, campus_id: campusId });
      if (!r.success) return toast.error(r.error || c('toast.save_failed'));
      toast.success(editingId ? c('toast.updated') : c('toast.saved'));
      list.mutate();
      reset();
    } finally {
      setSaving(false);
    }
  }

  async function run(calcId?: string) {
    const id = calcId || editingId;
    if (!id && !formula.trim()) return toast.error(c('toast.no_formula'));
    setRunning(true);
    setRunFor(calcId ?? null);
    setResult(null);
    try {
      const filters = { campus_id: campusId, start_date: startDate || undefined, end_date: endDate || undefined, grade_level_id: gradeId || undefined };
      const r = id ? await adminCalculations.run(id, filters) : await adminCalculations.runFormula(formula, filters, breakdown || undefined);
      if (!r.success || !r.data) return toast.error(r.error || c('toast.run_failed'));
      setResult(r.data);
      if (!id) toast.success(c('toast.ran_success'));
    } finally {
      setRunning(false);
      setRunFor(null);
    }
  }

  async function remove(calc: Calculation) {
    if (!(await confirm({ title: c('delete_title'), body: c('delete_desc', { title: calc.title }), confirmLabel: t('common.delete'), destructive: true }))) return;
    const r = await adminCalculations.remove(calc.id);
    if (!r.success) return toast.error(r.error || c('toast.delete_failed'));
    if (editingId === calc.id) reset();
    toast.success(c('toast.deleted'));
    list.mutate();
  }

  const chip = (label: string, onPress: () => void, active = false) => (
    <Pressable key={label} onPress={onPress} className={cn('border-border min-w-10 items-center rounded-md border px-2.5 py-1.5', active && 'border-primary bg-primary/10')}>
      <Text className="font-mono text-sm">{label}</Text>
    </Pressable>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: c('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">
          {c('subtitle')}
          {campus ? ` — ${campus.name}` : ''}
        </Text>
        {pendingFn ? (
          <View className="bg-secondary flex-row items-center gap-2 self-start rounded-full px-3 py-1">
            <Text className="text-sm">
              {c('select_field_for')} <Text className="text-sm font-bold">{pendingFn}(…)</Text>
            </Text>
            <Pressable onPress={() => setPendingFn(null)} hitSlop={6}>
              <Icon as={X} className="text-foreground size-3.5" />
            </Pressable>
          </View>
        ) : null}

        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="text-muted-foreground text-xs font-semibold uppercase">{c('functions_operators')}</Text>
            <Text className="text-muted-foreground text-xs">{c('functions')}</Text>
            <View className="flex-row flex-wrap gap-1.5">{FUNCTIONS.map((fn) => chip(fn, () => setPendingFn(fn), pendingFn === fn))}</View>
            <Text className="text-muted-foreground text-xs">{c('operators')}</Text>
            <View className="flex-row flex-wrap gap-1.5">{OPERATORS.map((op) => chip(op, () => append(op)))}</View>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="text-muted-foreground text-xs font-semibold uppercase">{c('fields')}</Text>
            <Text className="text-muted-foreground text-xs">{c('time_values')}</Text>
            <View className="flex-row flex-wrap gap-1.5">{TIME_FIELDS.map((f) => chip(f, () => field(f)))}</View>
            <Text className="text-muted-foreground text-xs">{c('istudently_fields')}</Text>
            <View className="flex-row flex-wrap gap-1.5">{SIS_FIELDS.map((f) => chip(f, () => field(f)))}</View>
            <Text className="text-muted-foreground text-xs">{c('constants')}</Text>
            <View className="flex-row flex-wrap gap-1.5">{CONSTANTS.map((k) => chip(k, () => append(k)))}</View>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-muted-foreground text-xs font-semibold uppercase">{c('equation')}</Text>
            <Input value={title} onChangeText={setTitle} placeholder={c('title_placeholder')} />
            <Picker value={breakdown || 'none'} onChange={(v) => setBreakdown(v === 'none' ? '' : v)} options={BREAKDOWNS.map((b) => ({ value: b || 'none', label: b ? c(`breakdown_options.${b}`) : c('breakdown_options.none') }))} />
            {editingId ? (
              <Button size="sm" variant="outline" className="self-start" onPress={reset}>
                <Icon as={X} className="text-foreground size-4" />
                <Text>{c('cancel_edit')}</Text>
              </Button>
            ) : null}
            <View className="border-border bg-muted/30 min-h-12 justify-center rounded-md border p-3">
              {formula ? <Text className="font-mono">{formula}</Text> : <Text className="text-muted-foreground">{c('formula_placeholder')}</Text>}
            </View>
            <View className="flex-row gap-2">
              <Button size="sm" variant="outline" onPress={backspace}>
                <Icon as={Delete} className="text-foreground size-4" />
                <Text>{c('backspace')}</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setFormula('');
                  setPendingFn(null);
                  setResult(null);
                }}>
                <Icon as={Trash2} className="text-foreground size-4" />
                <Text>{t('common.clear')}</Text>
              </Button>
            </View>
            <Text className="text-sm font-medium">{c('filters')}</Text>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={c('date_from')} value={startDate} onChange={setStartDate} clearable />
              <DateField className="flex-1" label={t('common.to')} value={endDate} onChange={setEndDate} clearable />
            </View>
            <View className="gap-1">
              <Label>{c('grade_level')}</Label>
              <Picker value={gradeId || 'none'} onChange={(v) => setGradeId(v === 'none' ? '' : v)} options={[{ value: 'none', label: t('common.all_grades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
            </View>
            <View className="flex-row justify-end gap-2">
              <Button variant="outline" onPress={() => run()} disabled={running}>
                <Icon as={Play} className="text-foreground size-4" />
                <Text>{c('run')}</Text>
              </Button>
              <Button onPress={save} disabled={saving || !title.trim() || !formula.trim()}>
                <Icon as={Save} className="text-primary-foreground size-4" />
                <Text>{c('save_formula')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardContent className="gap-2 pt-4">
              <Text className="font-semibold">{c('result')}</Text>
              {result.type === 'breakdown' ? (
                <View className="flex-row justify-between">
                  <Text className="text-muted-foreground text-xs">{c('group')}</Text>
                  <Text className="text-muted-foreground text-xs">{c('value')}</Text>
                </View>
              ) : null}
              <ResultView result={result} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Calculator} className="text-primary size-4" />
              <Text className="font-semibold">{c('saved_calculations')}</Text>
            </View>
            {list.isLoading ? (
              <LoadingList rows={3} />
            ) : !(list.data ?? []).length ? (
              <View className="items-center py-4">
                <Text className="text-muted-foreground">{c('no_saved')}</Text>
                <Text className="text-muted-foreground text-sm">{c('no_saved_desc')}</Text>
              </View>
            ) : (
              (list.data ?? []).map((calc, i) => (
                <View key={calc.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className={cn('gap-1 py-2.5', editingId === calc.id && 'bg-primary/5')}>
                    <Text className="font-medium">{calc.title}</Text>
                    <Text className="bg-muted self-start rounded px-1 font-mono text-xs">{calc.formula}</Text>
                    <View className="flex-row items-center gap-1">
                      {calc.breakdown ? (
                        <View className="border-border rounded-full border px-2 py-0.5">
                          <Text className="text-xs">{calc.breakdown}</Text>
                        </View>
                      ) : null}
                      <View className="flex-1" />
                      <Button
                        size="icon"
                        variant="ghost"
                        onPress={() => {
                          setEditingId(calc.id);
                          setTitle(calc.title);
                          setFormula(calc.formula);
                          setBreakdown(calc.breakdown || '');
                          setResult(null);
                        }}
                        accessibilityLabel={t('common.edit')}>
                        <Icon as={Pencil} className="text-foreground size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={running && runFor === calc.id} onPress={() => run(calc.id)} accessibilityLabel={c('run')}>
                        <Icon as={Play} className="text-foreground size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onPress={() => remove(calc)} accessibilityLabel={t('common.delete')}>
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Button>
                    </View>
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
