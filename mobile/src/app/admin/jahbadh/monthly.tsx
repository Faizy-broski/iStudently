import { jgPdfPath, type JgMonthlyCellInput, type JgMonthlyKindFilter, type JgMonthlyLog } from '@studently/api-client';
import { fmtMark, learnerWord, type JgMonthlyKind } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarRange, FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, parseMark, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

/** Workbook colours of the monthly lists: the subject list, «المادة — التطبيقات الشهرية», grades 1–3 «سجل الرصد الشهري». */
const KIND_CLASS: Record<JgMonthlyKind, string> = {
  activity: 'bg-info-soft',
  applications: 'bg-warning-soft',
  items: 'bg-chart-2/15',
};

const cellText = (c?: { value: number | null; absent?: boolean } | null) => (!c ? '' : c.absent ? 'غ' : fmtMark(c.value));
const key = (studentId: string, colId: string) => `${studentId}|${colId}`;

/** «سجل الأنشطة الشهري» (web: /admin|teacher/jahbadh-grades/monthly): activities and branched applications entered month by month. */
export default function JahbadhMonthly() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const params = useLocalSearchParams<{ subject?: string; stage?: string; month?: string; kind?: string }>();
  const subjectId = params.subject ?? null;
  const stage = params.stage ? Number(params.stage) : undefined;
  const month = params.month ? Number(params.month) : undefined;
  const kind = (params.kind as JgMonthlyKindFilter | undefined) ?? undefined;

  const overview = useApi(sectionId ? (['jg', 'section-subjects', sectionId, campusId ?? 'own'] as const) : null, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, c === 'own' ? null : c));
  const log = useApi(
    sectionId && subjectId ? (['jg', 'monthly', sectionId, subjectId, stage ?? 0, month ?? -1, kind ?? '', campusId ?? 'own'] as const) : null,
    ([, , s, sub, st, m, k, c]) => jahbadhGrades.monthly(s, sub, { stage: st || undefined, month: m >= 0 ? m : undefined, kind: (k || undefined) as JgMonthlyKindFilter | undefined }, c === 'own' ? null : c),
  );
  const data = log.data;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const viewKey = data ? `${sectionId}|${subjectId}|${data.stage}|${data.month_idx}|${data.kind}` : '';
  const [seenKey, setSeenKey] = useState('');
  if (viewKey && viewKey !== seenKey) {
    setSeenKey(viewKey);
    setDraft({});
    setInvalid(new Set());
  }

  const editable = !!data && data.can_enter && !data.locked;
  const dirty = Object.keys(draft).length;

  const edit = (studentId: string, colId: string, max: number, text: string) => {
    const k = key(studentId, colId);
    setDraft((d) => ({ ...d, [k]: text }));
    const p = parseMark(text);
    const bad = !p.ok || (p.value !== null && (p.value < 0 || p.value > max));
    setInvalid((prev) => {
      const next = new Set(prev);
      if (bad) next.add(k);
      else next.delete(k);
      return next;
    });
  };

  const save = async () => {
    const sid = sectionId;
    const sub = subjectId;
    const d = data;
    if (!sid || !sub || !d) return;
    if (invalid.size) return toast.error(t('grades.fixInvalid'));
    const cells: JgMonthlyCellInput[] = Object.entries(draft).flatMap(([k, text]) => {
      const p = parseMark(text);
      if (!p.ok) return [];
      const [student_id, target_id] = k.split('|');
      return [{ student_id, target_id, value: p.value, absent: p.absent }];
    });
    if (!cells.length) return;
    setSaving(true);
    const res = await jahbadhGrades.saveMonthly(sid, sub, { stage: d.stage, month_idx: d.month_idx, kind: d.kind, cells }, campusId);
    setSaving(false);
    if (!res.success) {
      const details = ((res.errorData?.details as { student_id: string; target_id: string }[] | undefined) ?? []).map((x) => key(x.student_id, x.target_id));
      if (details.length) setInvalid(new Set(details));
      return toast.error(res.code === 'locked' ? t('grades.monthlyLocked') : res.code === 'not_migrated' ? t('grades.notMigratedBody') : (res.error ?? t('app.error_title')));
    }
    toast.success(t('grades.saved'));
    setDraft({});
    if (res.data) await log.mutate(res.data, { revalidate: false });
  };

  const print = async (blank: boolean) => {
    const sid = sectionId;
    const sub = subjectId;
    const d = data;
    if (!sid || !sub || !d) return;
    try {
      await shareApiFile(jgPdfPath.monthly(sid, sub, { stage: d.stage, month: d.month_idx, kind: d.kind, blank }, campusId), 'monthly-log.pdf', 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };

  const errCode = log.error?.code;
  const blockedText =
    errCode === 'no_monthly' ? t('grades.noMonthly') : errCode === 'month_unused' ? t('grades.monthUnused') : errCode === 'no_months' ? t('grades.noMonths') : null;
  const stageNames = overview.data?.rule.stage_names ?? [];

  return (
    <>
      <Stack.Screen options={{ title: t('grades.monthlyLog') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <Text variant="muted" className="text-xs">
          {t('grades.monthlyLogSubtitle')}
        </Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={(id) => { setSection(id); router.setParams({ subject: undefined, stage: undefined, month: undefined, kind: undefined }); }} isAdmin={isAdmin} />
        {sectionId ? (
          <Picker
            value={subjectId}
            onChange={(v) => router.setParams({ subject: v, month: undefined, kind: undefined })}
            placeholder={t('grades.pickSubject')}
            options={(overview.data?.subjects ?? []).map((s) => ({ value: s.id, label: s.short_name || s.name }))}
          />
        ) : null}
        {data ? (
          <>
            <FilterChips
              value={String(data.stage)}
              onChange={(v) => router.setParams({ stage: v, month: undefined })}
              options={[1, 2, 3].filter((n) => stageNames[n - 1]).map((n) => ({ value: String(n), label: stageNames[n - 1] ?? String(n) }))}
            />
            <FilterChips value={String(data.month_idx)} onChange={(v) => router.setParams({ month: v })} options={data.months.map((m) => ({ value: String(m.idx), label: m.name }))} />
            {data.kinds.length > 1 ? (
              <FilterChips
                value={data.kind}
                onChange={(v) => router.setParams({ kind: v })}
                options={(['all', ...data.kinds] as JgMonthlyKindFilter[]).map((k) => ({ value: k, label: t(`grades.monthlyKind_${k}`) }))}
              />
            ) : null}
          </>
        ) : null}

        {!subjectId ? (
          sectionId ? <EmptyState icon={CalendarRange} title={t('grades.pickSubject')} /> : null
        ) : log.error ? (
          blockedText ? <EmptyState icon={CalendarRange} title={blockedText} /> : <JgBlocked error={log.error} isAdmin={isAdmin} />
        ) : !data ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <MonthlyRows data={data} draft={draft} invalid={invalid} editable={editable} onEdit={edit} onPrint={print} />
        )}
      </ScrollView>
      {editable ? (
        <StickyActions>
          <Button className="flex-1" disabled={!dirty || saving} onPress={save}>
            <Text>{saving ? t('grades.saving') : t('grades.saveCount', { count: dirty })}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}

function MonthlyRows({
  data,
  draft,
  invalid,
  editable,
  onEdit,
  onPrint,
}: {
  data: JgMonthlyLog;
  draft: Record<string, string>;
  invalid: Set<string>;
  editable: boolean;
  onEdit: (studentId: string, colId: string, max: number, text: string) => void;
  onPrint: (blank: boolean) => void;
}) {
  const { t } = useTranslation();
  const shown = new Set(data.columns.map((c) => c.component_id));
  const monthMax = data.components.filter((c) => shown.has(c.id)).reduce((a, c) => a + Number(c.max), 0);
  return (
    <View className="gap-3">
      <Panel className="gap-2 p-4">
        <Text className="text-base font-bold">{`${data.subject.name} — ${data.stage_name} — ${data.month_name}`}</Text>
        <Text variant="muted" className="text-xs">
          {t('grades.monthlyActMode', { mode: data.act_mode === 'best_of_avg_last' ? t('grades.actBest') : t('grades.actAverage') })}
        </Text>
        {data.locked ? <Text className="bg-muted rounded-xl p-2.5 text-xs">{t('grades.monthlyLocked')}</Text> : !data.can_enter ? <Text className="bg-muted rounded-xl p-2.5 text-xs">{t('grades.viewOnlyHint')}</Text> : null}
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" onPress={() => onPrint(true)}>
            <Icon as={FileDown} className="text-foreground size-4" />
            <Text>{t('grades.printBlank')}</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => onPrint(false)}>
            <Icon as={Printer} className="text-foreground size-4" />
            <Text>{t('grades.printFilled')}</Text>
          </Button>
        </View>
        <Text variant="muted" className="text-xs">
          {t('grades.monthlyHint')}
        </Text>
      </Panel>
      <Text className="text-sm font-semibold">{t('grades.studentName', { word: learnerWord(data.grade_code) })}</Text>
      {data.rows.map((row, i) => (
        <Panel key={row.student.id} className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>{`${i + 1}. ${row.student.name}`}</Text>
            <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{`${t('grades.monthTotal')}: ${fmtMark(row.month_total) || '—'} / ${fmtMark(monthMax)}`}</Text>
          </View>
          {data.columns.map((c) => {
            const k = key(row.student.id, c.id);
            const value = k in draft ? draft[k] : cellText(row.values[c.id]);
            const absent = value === 'غ';
            const trend = row.trends[c.id];
            const trendTone = trend === '▲' ? 'text-success' : trend === '▼' ? 'text-destructive' : 'text-muted-foreground';
            const label = c.kind === 'subitem' ? `${c.component_name} — ${c.name}` : c.name;
            return (
              <View key={c.id} className={cn('gap-1.5 rounded-xl p-2.5', KIND_CLASS[c.monthly_kind])}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm">{label}</Text>
                  <Text variant="muted" className="text-xs">{`/ ${fmtMark(c.max)}`}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Input
                    className={cn('bg-card flex-1 text-center', invalid.has(k) && 'border-destructive')}
                    keyboardType="decimal-pad"
                    value={value}
                    editable={editable}
                    accessibilityLabel={`${row.student.name} — ${label}`}
                    onChangeText={(v) => onEdit(row.student.id, c.id, Number(c.max), v)}
                  />
                  <Button
                    variant={absent ? 'secondary' : 'outline'}
                    size="icon"
                    disabled={!editable}
                    onPress={() => onEdit(row.student.id, c.id, Number(c.max), absent ? '' : 'غ')}
                    accessibilityLabel="غ">
                    <Text className="font-bold">غ</Text>
                  </Button>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text variant="muted" className="text-xs">{`${t('grades.markSoFar')}: ${fmtMark(row.marks[c.id]) || '—'}`}</Text>
                  {trend ? <Text className={cn('text-xs font-bold', trendTone)}>{trend}</Text> : null}
                </View>
                {invalid.has(k) ? <Text className="text-destructive text-xs">{t('grades.errMax', { max: fmtMark(c.max) })}</Text> : null}
              </View>
            );
          })}
        </Panel>
      ))}
    </View>
  );
}
