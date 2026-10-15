import type { CalcRunResult, CalculationReport, ReportCell } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BarChart2, ChevronLeft, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CheckRow } from '@/features/admin/attendance';
import { ResultView } from '@/features/admin/calculations';
import { useCampus } from '@/features/campus/campus';
import { adminCalculations } from '@/lib/api';
import { useApi } from '@/lib/data';

const BREAKDOWNS = ['none', 'grade_level', 'section', 'student'];
const empty = (): ReportCell => ({});

/** Grids of saved calculations with labels, breakdowns and graphs; build, run, re-run (web: /admin/reports/calculation-reports). */
export default function CalculationReports() {
  const { t, i18n } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`admin.reports.calculation_reports.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId, campus } = useCampus();
  const reports = useApi(['admin', 'calc-reports', campusId ?? 'school'], () => adminCalculations.reports(campusId));
  const calcs = useApi(['admin', 'calculations', campusId ?? 'school'], () => adminCalculations.list(campusId));
  const [mode, setMode] = useState<'list' | 'edit' | 'results'>('list');
  const [editing, setEditing] = useState<CalculationReport | null>(null);
  const [title, setTitle] = useState('');
  const [grid, setGrid] = useState<ReportCell[][]>([[empty()]]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<(CalcRunResult | null)[][] | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const updateCell = (ri: number, ci: number, patch: Partial<ReportCell>) => setGrid((g) => g.map((row, i) => (i === ri ? row.map((cell, j) => (j === ci ? { ...cell, ...patch } : cell)) : row)));
  const open = (rep: CalculationReport | null) => {
    setEditing(rep);
    setTitle(rep?.title ?? '');
    setGrid(rep?.cells.length ? rep.cells : [[empty()]]);
    setResults(null);
    setMode('edit');
  };

  async function save() {
    if (!title.trim()) return toast.error(r('toast.enter_title'));
    setSaving(true);
    try {
      const res = editing ? await adminCalculations.updateReport(editing.id, { title, cells: grid }) : await adminCalculations.createReport({ title, cells: grid, campus_id: campusId });
      if (!res.success) return toast.error(res.error || r('toast.save_failed'));
      toast.success(editing ? r('toast.updated') : r('toast.saved'));
      reports.mutate();
      setMode('list');
    } finally {
      setSaving(false);
    }
  }

  async function run(reportId?: string) {
    const id = reportId ?? editing?.id;
    if (!id) return toast.error(r('toast.save_first'));
    setRunning(true);
    try {
      const res = await adminCalculations.runReport(id, { campus_id: campusId, start_date: startDate || undefined, end_date: endDate || undefined });
      if (!res.success || !res.data) return toast.error(res.error || r('toast.run_failed'));
      setResults(res.data.results);
      setGrid(res.data.cells);
      setMode('results');
    } finally {
      setRunning(false);
    }
  }

  async function remove(rep: CalculationReport) {
    if (!(await confirm({ title: r('delete_title'), body: r('delete_desc', { title: rep.title }), confirmLabel: t('common.delete'), destructive: true }))) return;
    const res = await adminCalculations.removeReport(rep.id);
    if (!res.success) return toast.error(res.error || r('toast.delete_failed'));
    toast.success(r('toast.deleted'));
    reports.mutate();
  }

  const dates = (
    <View className="flex-row gap-2">
      <DateField className="flex-1" label={r('start_date')} value={startDate} onChange={setStartDate} clearable />
      <DateField className="flex-1" label={r('end_date')} value={endDate} onChange={setEndDate} clearable />
    </View>
  );
  const campusBadge = campus ? (
    <View className="bg-secondary self-start rounded-full px-2 py-0.5">
      <Text className="text-xs">{campus.name}</Text>
    </View>
  ) : null;

  if (mode === 'results' && results) {
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: `${title} — ${r('results')}` }} />
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
          <Button size="sm" variant="outline" className="self-start" onPress={() => setMode('edit')}>
            <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
            <Text>{r('back_to_builder')}</Text>
          </Button>
          {campusBadge}
          {dates}
          <Button size="sm" className="self-start" onPress={() => run(editing?.id)} disabled={running}>
            <Icon as={Play} className="text-primary-foreground size-4" />
            <Text>{r('rerun')}</Text>
          </Button>
          {results.map((row, ri) => (
            <View key={ri} className="flex-row flex-wrap gap-2">
              {row.map((res, ci) => {
                const cell = grid[ri]?.[ci] ?? {};
                return (
                  <Card key={ci} className="min-w-[47%] flex-1">
                    <CardContent className="gap-1 pt-4">
                      {cell.text ? <Text className="text-sm font-semibold">{cell.text}</Text> : null}
                      {res ? <ResultView result={res} showGraph={cell.show_graph} /> : cell.text ? null : <Text className="text-muted-foreground text-xs">—</Text>}
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (mode === 'edit') {
    const calcOptions = [{ value: 'none', label: `— ${r('none')} —` }, ...(calcs.data ?? []).map((c) => ({ value: c.id, label: c.title }))];
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: editing ? r('edit_report') : r('new_report') }} />
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <View className="flex-row flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onPress={() => setMode('list')}>
              <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
              <Text>{t('common.back')}</Text>
            </Button>
            {campusBadge}
            <View className="flex-1" />
            <Button size="sm" variant="outline" onPress={() => run(editing?.id)} disabled={running || !editing}>
              <Icon as={Play} className="text-foreground size-4" />
              <Text>{r('go')}</Text>
            </Button>
            <Button size="sm" onPress={save} disabled={saving}>
              <Icon as={Save} className="text-primary-foreground size-4" />
              <Text>{t('common.save')}</Text>
            </Button>
          </View>
          {!editing ? <Text className="text-muted-foreground text-xs">{r('save_first_title')}</Text> : null}
          <Input value={title} onChangeText={setTitle} placeholder={r('title_placeholder')} />
          <Text className="text-muted-foreground text-sm">{r('date_range')}</Text>
          {dates}
          {grid.map((row, ri) => (
            <Card key={ri}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold">{t('app.cr_row', { n: ri + 1 })}</Text>
                  <Button size="sm" variant="ghost" disabled={grid.length <= 1} onPress={() => setGrid((g) => g.filter((_, i) => i !== ri))}>
                    <Icon as={X} className="text-destructive size-4" />
                    <Text>{t('app.cr_remove_row')}</Text>
                  </Button>
                </View>
                {row.map((cell, ci) => (
                  <View key={ci} className="border-border gap-2 rounded-md border p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-muted-foreground text-xs">{t('app.cr_column', { n: ci + 1 })}</Text>
                      {ri === 0 ? (
                        <Button size="sm" variant="ghost" disabled={row.length <= 1} onPress={() => setGrid((g) => g.map((rw) => rw.filter((_, j) => j !== ci)))}>
                          <Icon as={X} className="text-destructive size-3.5" />
                          <Text className="text-xs">{t('app.cr_remove_column')}</Text>
                        </Button>
                      ) : null}
                    </View>
                    <Input value={cell.text ?? ''} onChangeText={(v) => updateCell(ri, ci, { text: v })} placeholder={r('label_optional')} />
                    <Picker value={cell.calculation_id ?? 'none'} onChange={(v) => updateCell(ri, ci, { calculation_id: v === 'none' ? undefined : v })} placeholder={r('calculation')} options={calcOptions} />
                    <Picker value={cell.breakdown ?? 'none'} onChange={(v) => updateCell(ri, ci, { breakdown: v === 'none' ? undefined : v })} placeholder={r('breakdown')} options={BREAKDOWNS.map((b) => ({ value: b, label: b === 'none' ? r('none') : r(`breakdown_options.${b}`) }))} />
                    <CheckRow checked={!!cell.show_graph} onPress={() => updateCell(ri, ci, { show_graph: !cell.show_graph })} label={r('graph_results')} />
                  </View>
                ))}
              </CardContent>
            </Card>
          ))}
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" onPress={() => setGrid((g) => g.map((rw) => [...rw, empty()]))}>
              <Icon as={Plus} className="text-foreground size-4" />
              <Text>{r('add_column')}</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => setGrid((g) => [...g, g[0].map(() => empty())])}>
              <Icon as={Plus} className="text-foreground size-4" />
              <Text>{r('add_row')}</Text>
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: r('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{r('subtitle')}</Text>
        <Button className="self-start" onPress={() => open(null)}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{r('new_report')}</Text>
        </Button>
        {reports.isLoading ? (
          <LoadingList />
        ) : !(reports.data ?? []).length ? (
          <Card>
            <CardContent className="items-center gap-2 py-8">
              <Icon as={BarChart2} className="text-muted-foreground/40 size-12" />
              <Text className="text-muted-foreground">{r('no_reports')}</Text>
              <Text className="text-muted-foreground text-sm">{r('no_reports_desc')}</Text>
            </CardContent>
          </Card>
        ) : (
          <Card>
            {(reports.data ?? []).map((rep, i) => (
              <View key={rep.id}>
                {i > 0 ? <Separator /> : null}
                <View className="gap-1 px-4 py-3">
                  <Text className="font-medium">{rep.title}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {r('cells_summary', { rows: rep.cells.length, cols: rep.cells[0]?.length || 0, calcs: rep.cells.reduce((s, row) => s + row.filter((c) => c.calculation_id).length, 0) })} · {new Date(rep.created_at).toLocaleDateString(i18n.language)}
                  </Text>
                  <View className="flex-row justify-end gap-1">
                    <Button size="icon" variant="ghost" disabled={running} onPress={() => {
                      setEditing(rep);
                      setTitle(rep.title);
                      setGrid(rep.cells);
                      run(rep.id);
                    }} accessibilityLabel={r('run_report')}>
                      <Icon as={Play} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => open(rep)} accessibilityLabel={t('common.edit')}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(rep)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
