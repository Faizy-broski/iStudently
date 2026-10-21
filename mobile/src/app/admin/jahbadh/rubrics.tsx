import type { JgRubric, JgStudent } from '@studently/api-client';
import { fmtMark, JG_DEFAULT_RUBRIC, JG_RUBRIC_LEVELS_AR, rubricMark, type JgRubricCriterion } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Copy, FilePlus2, Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, IconTile, RowItem, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const NONE = '__none__';

interface Form {
  id: string | null;
  name: string;
  max: string;
  criteria: JgRubricCriterion[];
  levels: Record<string, (number | null)[]>;
}

const empty = (): Form => ({ id: null, name: '', max: '6', criteria: JG_DEFAULT_RUBRIC.map((c) => ({ ...c, levels: [...c.levels] as JgRubricCriterion['levels'] })), levels: {} });
const fromRubric = (x: JgRubric): Form => ({ id: x.id, name: x.name, max: String(x.max_score), criteria: x.criteria, levels: x.levels ?? {} });

/** Rubric builder (web: /admin/jahbadh-grades/rubrics): weighted criteria, levels 1–4 per student, mark, copy to a component. */
export default function JahbadhRubrics() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId: sel, setSection } = useJgSection(campusId);
  const sectionId = sel ?? '';
  const cid = campusId ?? 'own';
  const list = useApi(sel ? (['jg', 'rubrics', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.rubrics(s, c === 'own' ? null : c));
  const results = useApi(sel ? (['jg', 'results', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.results(s, c === 'own' ? null : c));
  const overview = useApi(sel ? (['jg', 'overview', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, c === 'own' ? null : c));
  const students: JgStudent[] = useMemo(() => results.data?.students.map((s) => s.student) ?? [], [results.data]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [applySubject, setApplySubject] = useState<string | null>(null);
  const [applyComponent, setApplyComponent] = useState<string | null>(null);
  const grid = useApi(applySubject ? (['jg', 'grid', sectionId, applySubject, cid] as const) : null, ([, , s, sub, c]) => jahbadhGrades.grid(s, sub, c === 'own' ? null : c));

  const open = async (id: string) => {
    const res = await jahbadhGrades.rubric(sectionId, id, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    if (res.data) setForm(fromRubric(res.data));
  };
  const save = async () => {
    if (!form) return;
    setSaving(true);
    const body = { name: form.name, max_score: Number(form.max), criteria: form.criteria, levels: form.levels };
    const res = form.id ? await jahbadhGrades.updateRubric(sectionId, form.id, body, campusId) : await jahbadhGrades.createRubric(sectionId, body, campusId);
    setSaving(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    if (res.data) setForm(fromRubric(res.data));
    list.mutate();
  };
  const remove = () => {
    const id = form?.id;
    if (!id) return;
    Alert.alert(t('grades.confirmDelete'), undefined, [
      { text: t('grades.cancel'), style: 'cancel' },
      {
        text: t('grades.remove'),
        style: 'destructive',
        onPress: async () => {
          const res = await jahbadhGrades.deleteRubric(sectionId, id, campusId);
          if (!res.success) return toast.error(res.error ?? t('app.error_title'));
          setForm(null);
          list.mutate(res.data, { revalidate: false });
        },
      },
    ]);
  };
  const apply = async () => {
    const id = form?.id;
    if (!id || !applySubject || !applyComponent) return;
    const res = await jahbadhGrades.applyRubric(sectionId, id, applySubject, applyComponent, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.rubricApplied', { count: res.data?.applied ?? 0, component: res.data?.component ?? '' }));
  };

  if (list.error) return <View className="bg-background flex-1 p-4"><JgBlocked error={list.error} isAdmin={isAdmin} /></View>;

  if (!form) {
    const items = list.data ?? [];
    return (
      <>
        <Stack.Screen options={{ title: t('grades.rubrics') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
          <SectionHeader sections={sections} sectionId={sel} onChange={setSection} isAdmin={isAdmin} />
          <Text variant="muted" className="text-sm">{t('grades.rubricHelp')}</Text>
          <Button onPress={() => setForm(empty())}>
            <Icon as={FilePlus2} className="text-primary-foreground size-4" />
            <Text>{t('grades.newRubric')}</Text>
          </Button>
          {!list.data ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : items.length ? (
            <Panel>
              {items.map((x, i) => (
                <RowItem key={x.id} title={x.name} meta={`/ ${fmtMark(Number(x.max_score))}`} leading={<IconTile icon={FilePlus2} />} onPress={() => open(x.id)} last={i === items.length - 1} />
              ))}
            </Panel>
          ) : (
            <Text variant="muted" className="text-sm">{t('grades.noRubrics')}</Text>
          )}
        </ScrollView>
      </>
    );
  }

  const weights = form.criteria.reduce((a, c) => a + Number(c.weight || 0), 0);
  const setC = (i: number, p: Partial<JgRubricCriterion>) => setForm({ ...form, criteria: form.criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const setLevel = (sid: string, i: number, v: number | null) => {
    const row = [...(form.levels[sid] ?? form.criteria.map(() => null))];
    row[i] = v;
    setForm({ ...form, levels: { ...form.levels, [sid]: row } });
  };
  const levelOptions = [{ value: NONE, label: '—' }, ...JG_RUBRIC_LEVELS_AR.map((l, k) => ({ value: String(k + 1), label: `${k + 1} ${l}` }))];
  const max = Number(form.max) || 0;
  const formId = form.id;
  const components = (grid.data?.subject.components ?? []).filter((c) => !(grid.data?.locked_stages ?? []).includes(c.stage));

  return (
    <>
      <Stack.Screen options={{ title: form.name || t('grades.newRubric') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <FormSection title={t('grades.taskName')}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Text variant="muted" className="text-xs">{t('grades.taskMax')}</Text>
          <Input keyboardType="decimal-pad" value={form.max} onChangeText={(v) => setForm({ ...form, max: v })} />
        </FormSection>

        {form.criteria.map((c, i) => (
          <FormSection
            key={i}
            title={c.name || `${t('grades.criterion')} ${i + 1}`}
            action={
              <Pressable
                disabled={form.criteria.length < 2}
                onPress={() => setForm({ ...form, criteria: form.criteria.filter((_, k) => k !== i), levels: Object.fromEntries(Object.entries(form.levels).map(([s, l]) => [s, l.filter((_, k) => k !== i)])) })}
                accessibilityRole="button"
                accessibilityLabel={t('grades.remove')}
                className="p-1">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            }>
            <Input value={c.name} placeholder={t('grades.criterion')} onChangeText={(v) => setC(i, { name: v })} />
            <Text variant="muted" className="text-xs">{t('grades.weight')}</Text>
            <Input keyboardType="number-pad" value={String(c.weight)} onChangeText={(v) => setC(i, { weight: Number(v) || 0 })} />
            {c.levels.map((d, j) => (
              <View key={j} className="gap-1">
                <Text variant="muted" className="text-xs">{`${j + 1} ${JG_RUBRIC_LEVELS_AR[j]}`}</Text>
                <Input value={d} onChangeText={(v) => setC(i, { levels: c.levels.map((x, k) => (k === j ? v : x)) as JgRubricCriterion['levels'] })} />
              </View>
            ))}
          </FormSection>
        ))}
        <View className="flex-row items-center justify-between">
          <StatusChip label={`${t('grades.weightsTotal')}: ${weights}%`} tone={weights === 100 ? 'success' : 'destructive'} />
          <Button variant="outline" disabled={form.criteria.length >= 8} onPress={() => setForm({ ...form, criteria: [...form.criteria, { name: '', weight: 0, levels: ['', '', '', ''] }] })}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{t('grades.addCriterion')}</Text>
          </Button>
        </View>

        {students.map((s, i) => {
          const lv = form.levels[s.id] ?? form.criteria.map(() => null);
          const r = rubricMark(form.criteria, lv, max);
          return (
            <FormSection key={s.id} title={`${i + 1}. ${s.name}`} action={r.mark !== null ? <StatusChip label={`${fmtMark(r.mark)} · ${r.level}`} tone="info" /> : null}>
              {form.criteria.map((c, j) => (
                <View key={j} className="gap-1">
                  <Text variant="muted" className="text-xs">{c.name || `${t('grades.criterion')} ${j + 1}`}</Text>
                  <Picker value={lv[j] ? String(lv[j]) : NONE} onChange={(v) => setLevel(s.id, j, v === NONE ? null : Number(v))} options={levelOptions} />
                </View>
              ))}
            </FormSection>
          );
        })}

        {formId ? (
          <FormSection title={t('grades.applyToComponent')}>
            <Picker
              value={applySubject}
              onChange={(v) => { setApplySubject(v); setApplyComponent(null); }}
              placeholder={t('grades.subject')}
              options={(overview.data?.subjects ?? []).filter((s) => s.can_enter).map((s) => ({ value: s.id, label: s.short_name }))}
            />
            <Picker
              value={applyComponent}
              onChange={setApplyComponent}
              placeholder={t('grades.component')}
              options={components.map((c) => ({ value: c.id, label: `${grid.data?.rule.stage_names[c.stage - 1] ?? ''} — ${c.name} (${fmtMark(c.max_score)})` }))}
            />
            <Button variant="outline" disabled={!applyComponent} onPress={apply}>
              <Icon as={Copy} className="text-foreground size-4" />
              <Text>{t('grades.apply')}</Text>
            </Button>
          </FormSection>
        ) : null}
      </ScrollView>
      <StickyActions>
        <Button variant="outline" size="icon" onPress={() => setForm(null)} accessibilityLabel={t('grades.back')}>
          <Text>×</Text>
        </Button>
        {formId ? (
          <Button variant="outline" size="icon" onPress={remove} accessibilityLabel={t('grades.remove')}>
            <Icon as={Trash2} className="text-destructive size-4" />
          </Button>
        ) : null}
        <Button className="flex-1" disabled={saving || !form.name.trim()} onPress={save}>
          <Text>{saving ? t('grades.saving') : t('grades.save')}</Text>
        </Button>
      </StickyActions>
    </>
  );
}
