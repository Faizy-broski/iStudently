import { JG_DISTRIBUTION, fmtMark, fmtPct } from '@studently/shared-utils';
import type { JgGrade } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { JgBlocked, useJg } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Official distribution (web: /admin/jahbadh-grades/distribution): read-only, editable by admins on the school copy. */
export default function JahbadhDistribution() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const rules = useApi(['jg', 'rules', campusId ?? 'own'], ([, , c]) => jahbadhGrades.rules(c === 'own' ? null : (c as string)));
  const [code, setCode] = useState(1);
  const [edit, setEdit] = useState<JgGrade | null>(null);
  const [saving, setSaving] = useState(false);
  const grade = rules.data?.grades.find((g) => g.rule.grade_code === code);
  const view = edit ?? grade;
  const editable = isAdmin && rules.data?.source === 'school';

  const patchRule = (p: Partial<JgGrade['rule']>) => setEdit((e) => (e ? { ...e, rule: { ...e.rule, ...p } } : e));
  const patchComp = (sid: string, cid: string, p: Record<string, unknown>) =>
    setEdit((e) => e && { ...e, subjects: e.subjects.map((s) => (s.id !== sid ? s : { ...s, components: s.components.map((c) => (c.id === cid ? { ...c, ...p } : c)) })) });

  const save = async () => {
    const e = edit;
    if (!e) return;
    setSaving(true);
    const res = await jahbadhGrades.updateRule(
      code,
      {
        system_name: e.rule.system_name,
        total_min: Number(e.rule.total_min),
        exam_min: Number(e.rule.exam_min),
        rule_text: e.rule.rule_text,
        subjects: e.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          weekly_periods: Number(s.weekly_periods),
          components: s.components.map(({ id, stage, sort_order, name, max_score, is_exam }) => ({ id, stage, sort_order, name, max_score: Number(max_score), is_exam })),
        })),
      },
      campusId,
    );
    setSaving(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    setEdit(null);
    rules.mutate();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('grades.distribution') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Picker
          value={String(code)}
          onChange={(v) => {
            setCode(Number(v));
            setEdit(null);
          }}
          options={(rules.data?.grades.map((g) => g.rule) ?? JG_DISTRIBUTION.map((g) => ({ grade_code: g.code, name: g.name }))).map((g) => ({ value: String(g.grade_code), label: `${g.grade_code}. ${g.name}` }))}
        />
        {rules.data?.source === 'template' ? <Text className="bg-muted rounded-xl p-3 text-xs">{t('grades.templateNote')}</Text> : null}
        {editable && grade && !edit ? (
          <Button variant="outline" onPress={() => setEdit(JSON.parse(JSON.stringify(grade)) as JgGrade)}>
            <Text>{t('grades.edit')}</Text>
          </Button>
        ) : null}

        {rules.error ? (
          <JgBlocked error={rules.error} isAdmin={isAdmin} />
        ) : !view ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : (
          <>
            <Panel className="gap-3 p-4">
              <Text className="font-semibold">{view.rule.system_name}</Text>
              <View className="flex-row flex-wrap gap-2">
                <StatusChip label={`${t('grades.totalMin')}: ${view.rule.no_fail ? t('grades.noFailShort') : fmtPct(view.rule.total_min)}`} tone="info" />
                {view.rule.exam_min ? <StatusChip label={`${t('grades.examMin')}: ${fmtPct(view.rule.exam_min)}`} tone="info" /> : null}
              </View>
              {edit && !view.rule.no_fail ? (
                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Text variant="muted" className="text-xs">{`${t('grades.totalMin')} (%)`}</Text>
                    <Input keyboardType="decimal-pad" value={String(Math.round(view.rule.total_min * 100))} onChangeText={(v) => patchRule({ total_min: Number(v) / 100 })} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text variant="muted" className="text-xs">{`${t('grades.examMin')} (%)`}</Text>
                    <Input keyboardType="decimal-pad" value={String(Math.round(view.rule.exam_min * 100))} onChangeText={(v) => patchRule({ exam_min: Number(v) / 100 })} />
                  </View>
                </View>
              ) : null}
              <Text variant="muted" className="text-xs">{t('grades.ruleText')}</Text>
              {edit ? (
                <Input multiline value={view.rule.rule_text} onChangeText={(v) => patchRule({ rule_text: v })} />
              ) : (
                <Text className="bg-muted rounded-xl p-3 text-xs leading-5">{view.rule.rule_text}</Text>
              )}
            </Panel>

            {view.subjects.map((s) => (
              <FormSection
                key={s.id}
                title={s.name}
                description={t('grades.subjectMeta', { max: fmtMark(s.components.reduce((a, c) => a + Number(c.max_score), 0)), periods: s.weekly_periods })}>
                {[1, 2, 3].map((stage) => {
                  const comps = s.components.filter((c) => c.stage === stage);
                  if (!comps.length) return null;
                  return (
                    <View key={stage} className="gap-2">
                      <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{view.rule.stage_names[stage - 1]}</Text>
                      {comps.map((c) =>
                        edit ? (
                          <View key={c.id} className="gap-1.5">
                            <Input value={c.name} onChangeText={(v) => patchComp(s.id, c.id, { name: v })} />
                            <View className="flex-row items-center gap-2">
                              <Input className="flex-1 text-center" keyboardType="decimal-pad" value={String(c.max_score)} onChangeText={(v) => patchComp(s.id, c.id, { max_score: v })} />
                              <Text className="text-xs">{t('grades.exam')}</Text>
                              <Switch checked={c.is_exam} onCheckedChange={(v) => patchComp(s.id, c.id, { is_exam: v })} />
                            </View>
                          </View>
                        ) : (
                          <View key={c.id} className="flex-row items-center justify-between gap-2">
                            <Text className="flex-1 text-sm">{c.name}</Text>
                            {c.is_exam ? <StatusChip label={`★ ${t('grades.exam')}`} tone="info" /> : null}
                            <Text className="w-10 text-end text-sm font-semibold">{fmtMark(c.max_score)}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  );
                })}
              </FormSection>
            ))}
          </>
        )}
      </ScrollView>
      {edit ? (
        <StickyActions>
          <Button variant="outline" className="flex-1" onPress={() => setEdit(null)}>
            <Text>{t('grades.cancel')}</Text>
          </Button>
          <Button className="flex-1" disabled={saving} onPress={save}>
            <Text>{saving ? t('grades.saving') : t('grades.save')}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}
