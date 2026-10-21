import type { JgCellInput, JgGrid } from '@studently/api-client';
import { computeSubject, fmtMark, fmtPct, JG_RESULT_LABELS, round2Need, type JgCell } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
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

const cellText = (c?: { value: number | null; absent?: boolean }) => (!c ? '' : c.absent ? 'غ' : fmtMark(c.value));

/** One student's marks in one subject: every component per stage (max shown), absent, second round; live result. */
export default function JahbadhStudentEntry() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId, href } = useJg();
  const params = useLocalSearchParams<{ section: string; subject: string; index: string }>();
  const sectionId = params.section ?? null;
  const subjectId = params.subject ?? null;
  const index = Number(params.index ?? 0);
  const grid = useJgGrid(sectionId, subjectId, campusId);
  const g = grid.data;
  const row = g?.rows[index];
  const studentId = row?.student.id ?? null;

  // Drafts per student (keyed by component id; "round2" for the second-round mark), reset when the student changes.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftFor, setDraftFor] = useState<string | null>(null);
  if (studentId !== draftFor) {
    setDraftFor(studentId);
    setDraft({});
  }
  const [saving, setSaving] = useState(false);

  const comps = useMemo(() => g?.subject.components ?? [], [g]);
  const stages = useMemo(() => [...new Set(comps.map((c) => c.stage))].sort((a, b) => a - b), [comps]);
  const locked = new Set(g?.locked_stages ?? []);

  const live = useMemo(() => {
    if (!g || !row) return null;
    const rule = { noFail: g.rule.no_fail, totalMin: Number(g.rule.total_min), examMin: Number(g.rule.exam_min) };
    const cells: Record<string, JgCell> = {};
    const errors = new Set<string>();
    for (const c of comps) {
      if (c.id in draft) {
        const p = parseMark(draft[c.id]);
        if (!p.ok || (p.value !== null && (p.value < 0 || p.value > c.max_score))) {
          errors.add(c.id);
        } else if (p.value !== null || p.absent) {
          cells[c.id] = { value: p.value, absent: p.absent };
        }
        continue;
      }
      const server = row.cells[c.id];
      if (server) cells[c.id] = { value: server.value, absent: server.absent };
    }
    let round2 = row.round2;
    if ('round2' in draft) {
      const p = parseMark(draft.round2);
      if (!p.ok || p.absent || (p.value !== null && (p.value < 0 || p.value > g.subject.meta.examMax))) errors.add('round2');
      else round2 = p.value;
    }
    const comp = g.subject.components.map((c) => ({ id: c.id, stage: c.stage, max: Number(c.max_score), isExam: c.is_exam }));
    const result = computeSubject(comp, cells, round2, rule, g.settings.grading_scale);
    return { result, need: round2Need(comp, result, rule), errors };
  }, [g, row, comps, draft]);

  const dirty = Object.keys(draft).length > 0;
  const go = (i: number) => router.replace(href('/jahbadh/student', { section: sectionId ?? '', subject: subjectId ?? '', index: String(i) }));

  const save = async (then?: () => void) => {
    const sid = sectionId;
    const sub = subjectId;
    const stu = studentId;
    if (!sid || !sub || !stu || !live) return;
    if (live.errors.size) {
      const bad = [...live.errors][0];
      const max = bad === 'round2' ? (g?.subject.meta.examMax ?? 0) : (comps.find((c) => c.id === bad)?.max_score ?? 0);
      return toast.error(t('grades.errNumber', { max: fmtMark(max) }));
    }
    setSaving(true);
    let latest: JgGrid | undefined;
    const cells: JgCellInput[] = [];
    for (const [component_id, text] of Object.entries(draft)) {
      if (component_id === 'round2') continue;
      const p = parseMark(text);
      if (p.ok) cells.push({ student_id: stu, component_id, value: p.value, absent: p.absent });
    }
    if (cells.length) {
      const res = await jahbadhGrades.saveMarks(sid, sub, cells, campusId);
      if (!res.success) {
        setSaving(false);
        return toast.error(res.error ?? t('app.error_title'));
      }
      latest = res.data;
    }
    if ('round2' in draft) {
      const p = parseMark(draft.round2);
      const res = await jahbadhGrades.saveRound2(sid, sub, [{ student_id: stu, value: p.ok ? p.value : null }], campusId);
      if (!res.success) {
        setSaving(false);
        return toast.error(res.error ?? t('app.error_title'));
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
                  const server = row.cells[c.id];
                  const fromControl = server?.source === 'control_import';
                  const disabled = !canEnter || isLocked || fromControl;
                  const value = c.id in draft ? draft[c.id] : cellText(server);
                  const absent = value === 'غ';
                  return (
                    <View key={c.id} className="gap-1.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="flex-1 text-sm">{c.name}</Text>
                        {c.is_exam ? <StatusChip label={t('grades.exam')} tone="info" /> : null}
                        <Text variant="muted" className="text-xs">{`/ ${fmtMark(c.max_score)}`}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <Input
                          className={cn('flex-1 text-center', live.errors.has(c.id) && 'border-destructive')}
                          keyboardType="decimal-pad"
                          value={value}
                          editable={!disabled}
                          accessibilityLabel={`${c.name} / ${fmtMark(c.max_score)}`}
                          onChangeText={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
                        />
                        <Pressable
                          disabled={disabled}
                          onPress={() => setDraft((d) => ({ ...d, [c.id]: absent ? '' : 'غ' }))}
                          accessibilityRole="button"
                          accessibilityLabel="غ"
                          className={cn('size-12 items-center justify-center rounded-full border', absent ? 'bg-muted border-muted-foreground' : 'border-border', disabled && 'opacity-50')}>
                          <Text className={cn('font-bold', absent ? 'text-foreground' : 'text-muted-foreground')}>غ</Text>
                        </Pressable>
                      </View>
                      {live.errors.has(c.id) ? <Text className="text-destructive text-xs">{t('grades.errMax', { max: fmtMark(c.max_score) })}</Text> : null}
                      {fromControl ? <Text className="text-brand dark:text-brand-secondary text-xs">{t('grades.fromControl')}</Text> : null}
                    </View>
                  );
                })}
            </FormSection>
          );
        })}

        {!g.rule.no_fail && referred ? (
          <FormSection title={t('grades.round2')} description={need ? need.text : undefined}>
            <Input
              className={cn('text-center', live.errors.has('round2') && 'border-destructive')}
              keyboardType="decimal-pad"
              editable={canEnter}
              value={'round2' in draft ? draft.round2 : fmtMark(row.round2)}
              placeholder={`/ ${fmtMark(g.subject.meta.examMax)}`}
              onChangeText={(v) => setDraft((d) => ({ ...d, round2: v }))}
            />
            {live.errors.has('round2') ? <Text className="text-destructive text-xs">{t('grades.errMax', { max: fmtMark(g.subject.meta.examMax) })}</Text> : null}
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
