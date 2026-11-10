import type { JgGradeMapEntry, JgSettings, JgSubjectLinks, JgUpgradePreview } from '@studently/api-client';
import { JG_ACT_MODE_LABELS, JG_DEFAULT_MONTH_NAMES, JG_DISTRIBUTION, JG_NO_MONTH, type JgActMode } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { ArrowUpCircle, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useJg } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const NONE = '__none__';
type Tab = 'map' | 'links' | 'settings';

/** Admin setup (web: /admin/jahbadh-grades/setup): copy the memo, map grade levels, link subjects, settings. */
export default function JahbadhSetup() {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useJg();
  const rules = useApi(['jg', 'rules', campusId ?? 'own'], ([, , c]) => jahbadhGrades.rules(c === 'own' ? null : (c as string)));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('map');
  const ready = rules.data?.source === 'school';

  const init = async () => {
    setBusy(true);
    const res = await jahbadhGrades.setup(campusId);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.setupDone', { count: res.data?.grades ?? 0 }));
    rules.mutate();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('grades.setup') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">
          {t('grades.setupSubtitle')}
        </Text>
        <FormSection title={t('grades.step1Title')} description={t('grades.step1Body')}>
          {rules.isLoading ? (
            <Skeleton className="h-12 rounded-full" />
          ) : ready ? (
            <View className="flex-row items-center gap-2">
              <Icon as={CheckCircle2} className="text-success size-4" />
              <Text className="text-success text-sm">{t('grades.step1Done', { count: rules.data?.grades.length ?? 0 })}</Text>
            </View>
          ) : (
            <Button onPress={init} disabled={busy}>
              <Icon as={Sparkles} className="text-primary-foreground size-4" />
              <Text>{t('grades.initButton')}</Text>
            </Button>
          )}
        </FormSection>

        {ready ? <MemoUpgrade onDone={() => rules.mutate()} /> : null}

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="map"><Text>{t('grades.step2Title')}</Text></TabsTrigger>
            <TabsTrigger value="links"><Text>{t('grades.step3Title')}</Text></TabsTrigger>
            <TabsTrigger value="settings"><Text>{t('grades.settings')}</Text></TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'map' ? <GradeMap campusId={campusId} /> : tab === 'links' ? <SubjectLinks campusId={campusId} ready={ready} /> : <SettingsForm campusId={campusId} />}
      </ScrollView>
    </>
  );
}

function GradeMap({ campusId }: { campusId: string | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const map = useApi(['jg', 'grade-map', campusId ?? 'own'], ([, , c]) => jahbadhGrades.gradeMap(c === 'own' ? null : (c as string)));
  const [values, setValues] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<unknown>(null);
  if (map.data && map.data !== seen) {
    setSeen(map.data);
    setValues(Object.fromEntries(map.data.map((m: JgGradeMapEntry) => [m.grade_level_id, String(m.grade_code ?? m.suggested_code ?? NONE)])));
  }
  const options = [{ value: NONE, label: t('grades.notFollowing') }, ...JG_DISTRIBUTION.map((g) => ({ value: String(g.code), label: `${g.code}. ${g.name}` }))];

  const save = async () => {
    const entries = (map.data ?? []).map((m) => ({ grade_level_id: m.grade_level_id, grade_code: values[m.grade_level_id] && values[m.grade_level_id] !== NONE ? Number(values[m.grade_level_id]) : null }));
    const res = await jahbadhGrades.saveGradeMap(entries, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    map.mutate(res.data, { revalidate: false });
  };

  return (
    <FormSection title={t('grades.step2Title')} description={t('grades.step2Body')}>
      {map.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : null}
      {map.data?.map((m) => (
        <View key={m.grade_level_id} className="gap-1">
          <Text className="text-sm font-medium">{m.grade_code === null && m.suggested_code ? `${m.name} (${t('grades.suggested')})` : m.name}</Text>
          <Picker value={values[m.grade_level_id] ?? NONE} onChange={(v) => setValues((s) => ({ ...s, [m.grade_level_id]: v }))} options={options} />
        </View>
      ))}
      {map.data && !map.data.length ? <Text variant="muted" className="text-sm">{t('grades.noGradeLevels')}</Text> : null}
      <Button onPress={save} disabled={!map.data?.length}>
        <Text>{t('grades.save')}</Text>
      </Button>
    </FormSection>
  );
}

function SubjectLinks({ campusId, ready }: { campusId: string | null; ready: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const map = useApi(['jg', 'grade-map', campusId ?? 'own'], ([, , c]) => jahbadhGrades.gradeMap(c === 'own' ? null : (c as string)));
  const mapped = (map.data ?? []).filter((m) => m.grade_code !== null);
  const [gradeLevelId, setGradeLevelId] = useState<string | null>(null);
  const links = useApi(ready && gradeLevelId ? ['jg', 'links', gradeLevelId, campusId ?? 'own'] : null, ([, , gl, c]) =>
    jahbadhGrades.subjectLinks(gl as string, c === 'own' ? null : (c as string)),
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<unknown>(null);
  if (links.data && links.data !== seen) {
    setSeen(links.data);
    setValues(Object.fromEntries(links.data.links.map((l: JgSubjectLinks['links'][number]) => [l.jg_subject_id, l.subject_id ?? l.suggested_subject_id ?? NONE])));
  }
  const platform = links.data?.platform_subjects ?? [];

  const save = async () => {
    const gl = gradeLevelId;
    if (!gl) return;
    const entries = (links.data?.links ?? []).map((l) => ({ jg_subject_id: l.jg_subject_id, subject_id: values[l.jg_subject_id] && values[l.jg_subject_id] !== NONE ? values[l.jg_subject_id] : null }));
    const res = await jahbadhGrades.saveSubjectLinks(gl, entries, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    links.mutate(res.data, { revalidate: false });
  };

  if (!ready) return <Text variant="muted" className="text-sm">{t('grades.runStep1First')}</Text>;
  return (
    <FormSection title={t('grades.step3Title')} description={t('grades.step3Body')}>
      <Picker value={gradeLevelId} onChange={setGradeLevelId} placeholder={t('grades.pickGradeLevel')} options={mapped.map((m) => ({ value: m.grade_level_id, label: m.name }))} />
      {links.error ? <Text className="text-destructive text-sm">{links.error.message}</Text> : null}
      {links.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : null}
      {links.data?.links.map((l) => (
        <View key={l.jg_subject_id} className="gap-1">
          <Text className="text-sm font-medium">{l.name}</Text>
          <Picker
            value={values[l.jg_subject_id] ?? NONE}
            onChange={(v) => setValues((s) => ({ ...s, [l.jg_subject_id]: v }))}
            options={[{ value: NONE, label: t('grades.notLinked') }, ...platform.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </View>
      ))}
      {links.data ? (
        <Button onPress={save}>
          <Text>{t('grades.save')}</Text>
        </Button>
      ) : null}
    </FormSection>
  );
}

const HEADER_FIELDS = ['school_name', 'education_office', 'sub_office', 'municipality', 'located_at', 'school_number', 'principal', 'homeroom_teacher', 'exams_coordinator', 'hijri_year', 'logo_url'] as const;

function SettingsForm({ campusId }: { campusId: string | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useApi(['jg', 'settings', campusId ?? 'own'], ([, , c]) => jahbadhGrades.settings(c === 'own' ? null : (c as string)));
  const [form, setForm] = useState<JgSettings | null>(null);
  const [seen, setSeen] = useState<unknown>(null);
  if (settings.data && settings.data !== seen) {
    setSeen(settings.data);
    setForm(withRuleDefaults(JSON.parse(JSON.stringify(settings.data)) as JgSettings));
  }
  if (!form) return <Skeleton className="h-64 rounded-2xl" />;

  const save = async () => {
    const res = await jahbadhGrades.saveSettings(form, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    settings.mutate(res.data, { revalidate: false });
  };
  const setStep = (i: number, p: Partial<JgSettings['grading_scale'][number]>) =>
    setForm({ ...form, grading_scale: form.grading_scale.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <View className="gap-4">
      <FormSection title={t('grades.settings')}>
        <View className="flex-row gap-2">
          {(['follow_rate', 'excel_rate'] as const).map((k) => (
            <View key={k} className="flex-1 gap-1">
              <Text variant="muted" className="text-xs">{t(k === 'follow_rate' ? 'grades.followRate' : 'grades.excelRate')}</Text>
              <Input keyboardType="number-pad" value={String(Math.round(form[k] * 100))} onChangeText={(v) => setForm({ ...form, [k]: Number(v) / 100 })} />
            </View>
          ))}
        </View>
      </FormSection>
      <FormSection title={t('grades.scale')} description={t('grades.scaleHint')}>
        {form.grading_scale.map((step, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <Input className="w-20 text-center" keyboardType="number-pad" accessibilityLabel={t('grades.scaleFrom')} value={String(step.from)} onChangeText={(v) => setStep(i, { from: Number(v) })} />
            <Input className="flex-1" accessibilityLabel={t('grades.scaleLabel')} value={step.label} onChangeText={(v) => setStep(i, { label: v })} />
            <Pressable
              disabled={form.grading_scale.length < 2}
              onPress={() => setForm({ ...form, grading_scale: form.grading_scale.filter((_, j) => j !== i) })}
              accessibilityRole="button"
              accessibilityLabel={t('grades.remove')}
              className="p-2">
              <Icon as={Trash2} className="text-destructive size-4" />
            </Pressable>
          </View>
        ))}
        <Button variant="outline" onPress={() => setForm({ ...form, grading_scale: [...form.grading_scale, { from: 100, label: '' }] })}>
          <Icon as={Plus} className="text-foreground size-4" />
          <Text>{t('grades.addStep')}</Text>
        </Button>
      </FormSection>
      <RuleSettings form={form} setForm={setForm} />
      <FormSection title={t('grades.reports')}>
        {HEADER_FIELDS.map((f) => (
          <View key={f} className="gap-1">
            <Text variant="muted" className="text-xs">{t(`grades.header_${f}`)}</Text>
            <Input value={form.header[f] ?? ''} autoCapitalize="none" onChangeText={(v) => setForm({ ...form, header: { ...form.header, [f]: v } })} />
          </View>
        ))}
      </FormSection>
      <Button onPress={save}>
        <Text>{t('grades.save')}</Text>
      </Button>
    </View>
  );
}

/** Settings saved before the 2026-27 keys existed get the workbook defaults. */
function withRuleDefaults(s: JgSettings): JgSettings {
  return {
    ...s,
    jabr_kasur: s.jabr_kasur ?? true,
    jabr_plus_one: s.jabr_plus_one ?? true,
    act_mode: s.act_mode ?? 'average',
    month_names: s.month_names?.length === 3 ? s.month_names : JG_DEFAULT_MONTH_NAMES.map((m) => [...m]),
    default_stage: s.default_stage ?? null,
  };
}

/** Art. 122 options, «حساب الأنشطة الشهرية», month names (4 per stage, «—» hides) and the grid's default stage. */
function RuleSettings({ form, setForm }: { form: JgSettings; setForm: (f: JgSettings) => void }) {
  const { t } = useTranslation();
  const setMonth = (stage: number, i: number, value: string) =>
    setForm({ ...form, month_names: form.month_names.map((row, s) => (s === stage ? row.map((m, j) => (j === i ? value : m)) : row)) });
  return (
    <>
      <FormSection title={t('grades.rulesTitle')}>
        {(['jabr_kasur', 'jabr_plus_one'] as const).map((k) => (
          <View key={k} className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm">{t(k === 'jabr_kasur' ? 'grades.jabrKasur' : 'grades.jabrPlusOne')}</Text>
            <Switch checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} accessibilityLabel={t(k === 'jabr_kasur' ? 'grades.jabrKasur' : 'grades.jabrPlusOne')} />
          </View>
        ))}
        <View className="gap-1">
          <Text variant="muted" className="text-xs">{t('grades.actMode')}</Text>
          <Picker
            value={form.act_mode}
            onChange={(v) => setForm({ ...form, act_mode: v as JgActMode })}
            options={(Object.keys(JG_ACT_MODE_LABELS) as JgActMode[]).map((m) => ({ value: m, label: JG_ACT_MODE_LABELS[m] }))}
          />
        </View>
        <View className="gap-1">
          <Text variant="muted" className="text-xs">{t('grades.defaultStage')}</Text>
          <FilterChips
            value={form.default_stage ? String(form.default_stage) : 'all'}
            onChange={(v) => setForm({ ...form, default_stage: v === 'all' ? null : Number(v) })}
            options={[{ value: 'all', label: t('grades.allStages') }, ...[1, 2, 3].map((n) => ({ value: String(n), label: t('grades.stageN', { n }) }))]}
          />
        </View>
      </FormSection>
      <FormSection title={t('grades.monthNames')} description={t('grades.monthNamesHint')}>
        {form.month_names.map((row, stage) => (
          <View key={stage} className="gap-1.5">
            <Text variant="muted" className="text-xs">{t('grades.stageN', { n: stage + 1 })}</Text>
            <View className="flex-row flex-wrap gap-2">
              {row.map((m, i) => (
                <Input
                  key={i}
                  className="min-w-[45%] flex-1"
                  accessibilityLabel={`${t('grades.stageN', { n: stage + 1 })} — ${i + 1}`}
                  value={m === JG_NO_MONTH ? '' : m}
                  placeholder={JG_NO_MONTH}
                  onChangeText={(v) => setMonth(stage, i, v.trim() === '' ? JG_NO_MONTH : v)}
                />
              ))}
            </View>
          </View>
        ))}
      </FormSection>
    </>
  );
}

const UPGRADE_TARGET = '2026-2027';

/** Moves the current academic year to the 2026-2027 memo: preview the differences, then apply. */
function MemoUpgrade({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [preview, setPreview] = useState<JgUpgradePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const explain = (code?: string, error?: string) =>
    code === 'same_version'
      ? t('grades.upgradeSame', { version: UPGRADE_TARGET })
      : code === 'not_seeded'
        ? t('grades.upgradeNotSeeded')
        : code === 'not_migrated'
          ? t('grades.notMigratedBody')
          : (error ?? t('app.error_title'));

  const load = async () => {
    setBusy(true);
    setMessage(null);
    const res = await jahbadhGrades.upgradePreview(UPGRADE_TARGET);
    setBusy(false);
    if (!res.success || !res.data) return setMessage(explain(res.code, res.error));
    setPreview(res.data);
  };
  const apply = async () => {
    const p = preview;
    if (!p) return;
    if (!(await confirm({ title: t('grades.upgradeApply'), body: t('grades.upgradeConfirm', { from: p.from, to: p.to }), confirmLabel: t('grades.upgradeApply') }))) return;
    setBusy(true);
    const res = await jahbadhGrades.upgrade(UPGRADE_TARGET, p.academic_year.id);
    setBusy(false);
    if (!res.success || !res.data) return toast.error(explain(res.code, res.error));
    toast.success(t('grades.upgradeDone', { moved: res.data.marks_moved, unmapped: res.data.marks_unmapped }));
    setPreview(null);
    setMessage(t('grades.upgradeSame', { version: res.data.to }));
    onDone();
  };

  return (
    <FormSection title={t('grades.upgradeTitle')} description={t('grades.upgradeBody')}>
      {message ? <Text variant="muted" className="text-sm">{message}</Text> : null}
      {!preview ? (
        <Button variant="outline" onPress={load} disabled={busy}>
          <Icon as={ArrowUpCircle} className="text-foreground size-4" />
          <Text>{t('grades.upgradePreview')}</Text>
        </Button>
      ) : (
        <>
          <Text className="text-sm">{t('grades.upgradeYear', { year: preview.academic_year.name ?? '', from: preview.from, to: preview.to })}</Text>
          {preview.grades.map((g) => (
            <View key={g.grade_code} className="border-info-soft dark:border-border gap-1 border-b pb-2">
              <Text className="text-sm font-semibold">{g.name}</Text>
              <Text variant="muted" className="text-xs">
                {`${t('grades.totalBefore')}: ${g.total_before ?? '—'} · ${t('grades.totalAfter')}: ${g.total_after} · ${t('grades.componentsChanged')}: ${g.components_changed.length}`}
              </Text>
              {g.subjects_added.length ? <Text className="text-success text-xs">{`${t('grades.subjectsAdded')}: ${g.subjects_added.join('، ')}`}</Text> : null}
              {g.subjects_removed.length ? <Text className="text-destructive text-xs">{`${t('grades.subjectsRemoved')}: ${g.subjects_removed.join('، ')}`}</Text> : null}
              <Text className={g.marks_unmapped ? 'text-destructive text-xs font-semibold' : 'text-muted-foreground text-xs'}>
                {`${t('grades.marksMoved')}: ${g.marks} · ${t('grades.marksUnmapped')}: ${g.marks_unmapped}`}
              </Text>
            </View>
          ))}
          <Text variant="muted" className="text-xs">{t('grades.upgradeHint')}</Text>
          <Button onPress={apply} disabled={busy}>
            <Icon as={ArrowUpCircle} className="text-primary-foreground size-4" />
            <Text>{t('grades.upgradeApply')}</Text>
          </Button>
          <Button variant="outline" onPress={() => setPreview(null)} disabled={busy}>
            <Text>{t('grades.cancel')}</Text>
          </Button>
        </>
      )}
    </FormSection>
  );
}
