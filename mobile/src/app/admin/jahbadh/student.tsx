import type { JgCellInput, JgComponent, JgEffectiveCell, JgGrid, JgSubItemCellInput } from '@studently/api-client';
import { computeSubject, fmtMark, fmtPct, JG_RESULT_LABELS, round2Need, subItemsValue, type JgCell } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarRange, ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, HeroCard, StickyActions } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, needText, parseMark, resultChipTone, useJg, useJgGrid } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { cn } from '@/lib/utils';

const cellText = (c?: { value: number | null; absent?: boolean } | null) => (!c ? '' : c.absent ? 'غ' : fmtMark(c.value));
/** Draft keys: component id, `s:<sub-item id>` for sub-items, `round2` for the single second-round mark. */
const subKey = (id: string) => `s:${id}`;
const enterableComp = (c: JgComponent) => !c.monthly_kind && !c.subitems.length;
const enterableSub = (c: JgComponent) => !c.monthly_kind;

/** One student's marks in one subject: every component per stage (max shown), sub-items, absent, second round; live result. */
export default function JahbadhStudentEntry() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId, href } = useJg();
  const params = useLocalSearchParams<{ section: string; subject: string; index: string; stage?: string }>();
  const sectionId = params.section ?? null;
  const subjectId = params.subject ?? null;
  const stageParam = params.stage ?? null;
  const index = Number(params.index ?? 0);
  const grid = useJgGrid(sectionId, subjectId, campusId);
  const g = grid.data;
  const row = g?.rows[index];
  const studentId = row?.student.id ?? null;

  // Drafts per student, reset when the student changes.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftFor, setDraftFor] = useState<string | null>(null);
  if (studentId !== draftFor) {
    setDraftFor(studentId);
    setDraft({});
  }
  const [saving, setSaving] = useState(false);

  const comps = useMemo(() => g?.subject.components ?? [], [g]);
  const r2Items = useMemo(() => g?.subject.round2_subitems ?? [], [g]);
  const allStages = useMemo(() => [...new Set(comps.map((c) => c.stage))].sort((a, b) => a - b), [comps]);
  const serverStage = g?.stage ?? null;
  const viewStage = stageParam === 'all' ? null : stageParam ? Number(stageParam) : serverStage;
  const stages = viewStage && allStages.includes(viewStage) ? [viewStage] : allStages;
  const locked = new Set(g?.locked_stages ?? []);

  const live = useMemo(() => {
    if (!g || !row) return null;
    const rule = { noFail: g.rule.no_fail, totalMin: Number(g.rule.total_min), examMin: Number(g.rule.exam_min) };
    const errors = new Set<string>();
    const fromDraft = (k: string, max: number): JgCell | undefined | null => {
      if (!(k in draft)) return null;
      const p = parseMark(draft[k]);
      if (!p.ok || (p.value !== null && (p.value < 0 || p.value > max))) {
        errors.add(k);
        return null;
      }
      return p.value !== null || p.absent ? { value: p.value, absent: p.absent } : undefined;
    };
    const subCell = (id: string, max: number): JgCell | undefined => {
      const d = fromDraft(subKey(id), max);
      if (d !== null) return d;
      const server = row.subitem_cells[id];
      return server && (server.value !== null || server.absent) ? { value: server.value, absent: server.absent } : undefined;
    };
    const cells: Record<string, JgCell> = {};
    const derived: Record<string, JgEffectiveCell> = {};
    for (const c of comps) {
      if (c.subitems.length && enterableSub(c)) {
        const v = subItemsValue(c.subitems.map((si) => subCell(si.id, Number(si.max_score))), Number(c.divisor) || 1);
        derived[c.id] = { value: v.value, absent: !!v.absent, source: 'teacher', derived: 'subitems', partial: v.partial };
        if (v.value !== null || v.absent) cells[c.id] = { value: v.value, absent: !!v.absent };
        continue;
      }
      if (!enterableComp(c)) {
        const server = row.cells[c.id];
        if (server) {
          derived[c.id] = server;
          if (server.value !== null || server.absent) cells[c.id] = { value: server.value, absent: server.absent };
        }
        continue;
      }
      const d = fromDraft(c.id, Number(c.max_score));
      if (d !== null) {
        if (d) cells[c.id] = d;
        continue;
      }
      const server = row.cells[c.id];
      if (server && (server.value !== null || server.absent)) cells[c.id] = { value: server.value, absent: server.absent };
    }
    let round2 = row.round2;
    if (r2Items.length) {
      const parts = r2Items.map((si) => subCell(si.id, Number(si.max_score))).filter((p): p is JgCell => !!p && p.value !== null);
      if (parts.length) round2 = parts.reduce((a, p) => a + (p.value ?? 0), 0);
    } else if ('round2' in draft) {
      const p = parseMark(draft.round2);
      if (!p.ok || p.absent || (p.value !== null && (p.value < 0 || p.value > g.subject.meta.examMax))) errors.add('round2');
      else round2 = p.value;
    }
    const comp = g.subject.components.map((c) => ({ id: c.id, stage: c.stage, max: Number(c.max_score), isExam: c.is_exam }));
    const result = computeSubject(comp, cells, round2, rule, g.settings.grading_scale, { jabrKasur: g.settings.jabr_kasur });
    return { result, need: round2Need(comp, result, rule), errors, derived, round2 };
  }, [g, row, comps, r2Items, draft]);

  const dirty = Object.keys(draft).length > 0;
  const go = (i: number) =>
    router.replace(href('/jahbadh/student', { section: sectionId ?? '', subject: subjectId ?? '', index: String(i), ...(stageParam ? { stage: stageParam } : {}) }));
  const openMonthly = (stage: number) => router.push(href('/jahbadh/monthly', { section: sectionId ?? '', subject: subjectId ?? '', stage: String(stage) }));

  const maxOf = (k: string): number => {
    if (k === 'round2') return g?.subject.meta.examMax ?? 0;
    if (k.startsWith('s:')) {
      const id = k.slice(2);
      const si = comps.flatMap((c) => c.subitems).find((x) => x.id === id) ?? r2Items.find((x) => x.id === id);
      return Number(si?.max_score ?? 0);
    }
    return Number(comps.find((c) => c.id === k)?.max_score ?? 0);
  };

  const errorText = (code?: string, fallback?: string) =>
    code === 'computed_component' ? t('grades.errComputed') : code === 'monthly_component' || code === 'monthly_subitem' ? t('grades.errMonthly') : code === 'not_migrated' ? t('grades.notMigratedBody') : (fallback ?? t('app.error_title'));

  const save = async (then?: () => void) => {
    const sid = sectionId;
    const sub = subjectId;
    const stu = studentId;
    if (!sid || !sub || !stu || !live) return;
    if (live.errors.size) {
      const bad = [...live.errors][0];
      return toast.error(t('grades.errNumber', { max: fmtMark(maxOf(bad)) }));
    }
    setSaving(true);
    let latest: JgGrid | undefined;
    const cells: JgCellInput[] = [];
    const subCells: JgSubItemCellInput[] = [];
    for (const [k, text] of Object.entries(draft)) {
      if (k === 'round2') continue;
      const p = parseMark(text);
      if (!p.ok) continue;
      if (k.startsWith('s:')) subCells.push({ student_id: stu, subitem_id: k.slice(2), value: p.value, absent: p.absent });
      else cells.push({ student_id: stu, component_id: k, value: p.value, absent: p.absent });
    }
    if (cells.length) {
      const res = await jahbadhGrades.saveMarks(sid, sub, cells, campusId);
      if (!res.success) {
        setSaving(false);
        return toast.error(errorText(res.code, res.error));
      }
      latest = res.data;
    }
    if (subCells.length) {
      const res = await jahbadhGrades.saveSubItemMarks(sid, sub, subCells, campusId);
      if (!res.success) {
        setSaving(false);
        return toast.error(errorText(res.code, res.error));
      }
      latest = res.data;
    }
    if ('round2' in draft) {
      const p = parseMark(draft.round2);
      const res = await jahbadhGrades.saveRound2(sid, sub, [{ student_id: stu, value: p.ok ? p.value : null }], campusId);
      if (!res.success) {
        setSaving(false);
        return toast.error(errorText(res.code, res.error));
      }
      latest = res.data;
    }
    setSaving(false);
    if (latest) await grid.mutate(latest, { revalidate: false });
    setDraft({});
    toast.success(t('grades.saved'));
    then?.();
  };

  if (grid.error) return <View className="bg-background flex-1 p-4"><JgBlocked error={grid.error} isAdmin={isAdmin} /></View>;
  if (!g || !row || !live) return <View className="bg-background flex-1 gap-3 p-4"><Skeleton className="h-28 rounded-3xl" /><Skeleton className="h-64 rounded-2xl" /></View>;

  const r = live.result;
  const canEnter = g.can_enter;
  const referred = r.result === 'round2' || r.result === 'pass_round2' || r.result === 'fail';
  const need = needText(live.need, fmtMark, t('grades.impossible'));
  const total = g.rows.length;

  /** One mark input (component, sub-item or second-round branch) with its «غ» toggle. */
  const markInput = (k: string, label: string, max: number, server: JgEffectiveCell | undefined, disabledBase: boolean, allowAbsent = true) => {
    const fromControl = server?.source === 'control_import';
    const disabled = disabledBase || fromControl;
    const value = k in draft ? draft[k] : cellText(server);
    const absent = value === 'غ';
    return (
      <View key={k} className="gap-1.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-sm">{label}</Text>
          <Text variant="muted" className="text-xs">{`/ ${fmtMark(max)}`}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Input
            className={cn('flex-1 text-center', live.errors.has(k) && 'border-destructive')}
            keyboardType="decimal-pad"
            value={value}
            editable={!disabled}
            accessibilityLabel={`${label} / ${fmtMark(max)}`}
            onChangeText={(v) => setDraft((d) => ({ ...d, [k]: v }))}
          />
          {allowAbsent ? (
            <Pressable
              disabled={disabled}
              onPress={() => setDraft((d) => ({ ...d, [k]: absent ? '' : 'غ' }))}
              accessibilityRole="button"
              accessibilityLabel="غ"
              className={cn('size-12 items-center justify-center rounded-full border', absent ? 'bg-muted border-muted-foreground' : 'border-border', disabled && 'opacity-50')}>
              <Text className={cn('font-bold', absent ? 'text-foreground' : 'text-muted-foreground')}>غ</Text>
            </Pressable>
          ) : null}
        </View>
        {live.errors.has(k) ? <Text className="text-destructive text-xs">{t('grades.errMax', { max: fmtMark(max) })}</Text> : null}
        {fromControl ? <Text className="text-brand dark:text-brand-secondary text-xs">{t('grades.fromControl')}</Text> : null}
      </View>
    );
  };

  /** A computed value: Σ sub-items ÷ divisor (warning colour while partial) or the monthly mark with ▲▼●. */
  const derivedRow = (c: JgComponent, cell: JgEffectiveCell | undefined) => {
    const trendTone = cell?.trend === '▲' ? 'text-success' : cell?.trend === '▼' ? 'text-destructive' : 'text-muted-foreground';
    const body = (
      <View className="bg-muted/50 flex-row items-center justify-between gap-2 rounded-xl px-3 py-2.5">
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold">{c.name}</Text>
          <Text variant="muted" className="text-xs">
            {c.monthly_kind ? t('grades.fromMonths') : t('grades.fromSubItems')}
            {cell?.partial ? ` · ${t('grades.partialHint')}` : ''}
          </Text>
        </View>
        <Text className={cn('text-base font-bold', cell?.partial && 'text-warning')}>{`${cellText(cell) || '—'} / ${fmtMark(c.max_score)}`}</Text>
        {cell?.trend ? <Text className={cn('text-sm font-bold', trendTone)}>{cell.trend}</Text> : null}
        {c.monthly_kind ? <Icon as={CalendarRange} className="text-brand dark:text-brand-secondary size-4" /> : null}
      </View>
    );
    return c.monthly_kind ? (
      <Pressable key={c.id} onPress={() => openMonthly(c.stage)} accessibilityRole="button" accessibilityLabel={`${c.name} — ${t('grades.monthlyLog')}`} className="active:opacity-70">
        {body}
      </Pressable>
    ) : (
      <View key={c.id}>{body}</View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: g.subject.short_name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <HeroCard>
          <Text className="text-xs text-white opacity-80">{`${index + 1} / ${total} · ${g.rule.name} — ${g.section.name}`}</Text>
          <Text className="text-xl font-bold text-white" numberOfLines={2}>
            {row.student.name}
          </Text>
          <View className="flex-row flex-wrap items-end gap-3">
            <Text className="text-3xl font-bold text-white">{r.final === null ? '—' : fmtMark(r.final)}</Text>
            <Text className="pb-1 text-sm text-white opacity-80">{`/ ${fmtMark(g.subject.meta.subjectMax)} · ${fmtPct(r.pct) || '—'}${r.estimate ? ` · ${r.estimate}` : ''}`}</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {r.result ? <StatusChip label={JG_RESULT_LABELS[r.result]} tone={resultChipTone(r.result)} /> : null}
            {need && r.result === 'round2' ? <StatusChip label={need.text} tone={need.tone} /> : null}
          </View>
        </HeroCard>
        <Text variant="muted" className="text-xs">
          {t('grades.absentHint')}
        </Text>
        {!canEnter ? <Text className="bg-muted rounded-xl p-2.5 text-xs">{t('grades.viewOnlyHint')}</Text> : null}

        {stages.map((stage) => {
          const isLocked = locked.has(stage);
          const stageTotal = r.stageTotals[stage];
          return (
            <FormSection
              key={stage}
              title={g.rule.stage_names[stage - 1] ?? String(stage)}
              description={`${t('grades.stageTotal')}: ${stageTotal === null ? '—' : fmtMark(stageTotal)} / ${fmtMark(g.subject.meta.stageMax[stage])}`}
              action={isLocked ? <Icon as={Lock} className="text-warning size-4" /> : null}>
              {comps
                .filter((c) => c.stage === stage)
                .map((c) => {
                  const disabled = !canEnter || isLocked;
                  if (enterableComp(c)) {
                    return (
                      <View key={c.id} className="gap-1">
                        {c.is_exam ? <StatusChip label={t('grades.exam')} tone="info" className="self-start" /> : null}
                        {markInput(c.id, c.name, Number(c.max_score), row.cells[c.id], disabled)}
                      </View>
                    );
                  }
                  return (
                    <View key={c.id} className="gap-2">
                      {derivedRow(c, live.derived[c.id])}
                      {c.subitems.length && enterableSub(c) ? (
                        <View className="border-info-soft dark:border-border gap-3 border-s-2 ps-3">
                          {c.subitems.map((si) => markInput(subKey(si.id), si.name, Number(si.max_score), row.subitem_cells[si.id], disabled))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
            </FormSection>
          );
        })}

        {!g.rule.no_fail && referred ? (
          <FormSection title={t('grades.round2')} description={need ? need.text : undefined}>
            {r2Items.length ? (
              <>
                {r2Items.map((si) => markInput(subKey(si.id), si.name, Number(si.max_score), row.subitem_cells[si.id], !canEnter, false))}
                <Text className="text-sm font-semibold">{`${t('grades.round2')}: ${fmtMark(live.round2) || '—'} / ${fmtMark(g.subject.meta.examMax)}`}</Text>
              </>
            ) : (
              <>
                <Input
                  className={cn('text-center', live.errors.has('round2') && 'border-destructive')}
                  keyboardType="decimal-pad"
                  editable={canEnter}
                  value={'round2' in draft ? draft.round2 : fmtMark(row.round2)}
                  placeholder={`/ ${fmtMark(g.subject.meta.examMax)}`}
                  onChangeText={(v) => setDraft((d) => ({ ...d, round2: v }))}
                />
                {live.errors.has('round2') ? <Text className="text-destructive text-xs">{t('grades.errMax', { max: fmtMark(g.subject.meta.examMax) })}</Text> : null}
              </>
            )}
          </FormSection>
        ) : null}
      </ScrollView>
      <StickyActions>
        <Button variant="outline" size="icon" disabled={index === 0 || saving} onPress={() => (dirty ? save(() => go(index - 1)) : go(index - 1))} accessibilityLabel={t('grades.back')}>
          <Icon as={ChevronLeft} flipRtl className="text-foreground size-5" />
        </Button>
        <Button className="flex-1" disabled={!dirty || saving || !canEnter} onPress={() => save()}>
          <Text>{saving ? t('grades.saving') : t('grades.save')}</Text>
        </Button>
        <Button variant="outline" size="icon" disabled={index >= total - 1 || saving} onPress={() => (dirty ? save(() => go(index + 1)) : go(index + 1))} accessibilityLabel="›">
          <Icon as={ChevronRight} flipRtl className="text-foreground size-5" />
        </Button>
      </StickyActions>
    </>
  );
}
