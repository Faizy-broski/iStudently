import type { JgActivities, JgActivityLevel } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, StickyActions } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { JgBlocked, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const NONE = '__none__';
type Row = { art: string; music: string; pe: string; excused: string; unexcused: string; note: string };

/** Activities & behaviour (web: /admin/jahbadh-grades/activities): levels, absence days, notes, school days per stage. */
export default function JahbadhActivities() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const [stage, setStage] = useState(1);
  const data = useApi(sectionId ? (['jg', 'activities', sectionId, stage, campusId ?? 'own'] as const) : null, ([, , s, st, c]) =>
    jahbadhGrades.activities(s, st, c === 'own' ? null : c),
  );
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [days, setDays] = useState('');
  const [seen, setSeen] = useState<JgActivities | null>(null);
  const [saving, setSaving] = useState(false);
  if (data.data && data.data !== seen) {
    setSeen(data.data);
    setDays(data.data.school_days === null ? '' : String(data.data.school_days));
    setRows(
      Object.fromEntries(
        data.data.rows.map((r) => [
          r.student.id,
          { art: r.art ?? NONE, music: r.music ?? NONE, pe: r.pe ?? NONE, excused: r.excused_days === null ? '' : String(r.excused_days), unexcused: r.unexcused_days === null ? '' : String(r.unexcused_days), note: r.teacher_note ?? '' },
        ]),
      ),
    );
  }
  const d = data.data;
  const levels = [{ value: NONE, label: '—' }, ...(d?.levels ?? []).map((l) => ({ value: l, label: l }))];
  const patch = (id: string, p: Partial<Row>) => setRows((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const lvl = (v: string) => (v === NONE ? null : (v as JgActivityLevel));

  const save = async () => {
    const sid = sectionId;
    if (!sid) return;
    setSaving(true);
    const res = await jahbadhGrades.saveActivities(
      sid,
      stage,
      {
        school_days: num(days),
        entries: Object.entries(rows).map(([student_id, r]) => ({
          student_id, art: lvl(r.art), music: lvl(r.music), pe: lvl(r.pe), excused_days: num(r.excused), unexcused_days: num(r.unexcused), teacher_note: r.note || null,
        })),
      },
      campusId,
    );
    setSaving(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    data.mutate(res.data, { revalidate: false });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('grades.activities') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <Text variant="muted" className="text-sm">
          {t('grades.activitiesSubtitle')}
        </Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {data.error ? (
          <JgBlocked error={data.error} isAdmin={isAdmin} />
        ) : !d ? (
          sectionId ? <Skeleton className="h-64 rounded-2xl" /> : null
        ) : (
          <>
            <Tabs value={String(stage)} onValueChange={(v) => setStage(Number(v))}>
              <TabsList>
                {d.stages.map((s) => (
                  <TabsTrigger key={s} value={String(s)}>
                    <Text>{d.stage_names[s - 1]}</Text>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <View className="gap-1">
              <Text variant="muted" className="text-xs">{t('grades.schoolDays')}</Text>
              <Input keyboardType="number-pad" value={days} onChangeText={setDays} />
            </View>
            {d.rows.map((r, i) => {
              const row = rows[r.student.id];
              if (!row) return null;
              return (
                <FormSection key={r.student.id} title={`${i + 1}. ${r.student.name}`}>
                  {(['art', 'music', 'pe'] as const).map((k, j) => (
                    <View key={k} className="gap-1">
                      <Text variant="muted" className="text-xs">{d.activity_subjects[j]}</Text>
                      <Picker value={row[k]} onChange={(v) => patch(r.student.id, { [k]: v })} options={levels} />
                    </View>
                  ))}
                  <View className="flex-row gap-2">
                    <View className="flex-1 gap-1">
                      <Text variant="muted" className="text-xs">{t('grades.excusedDays')}</Text>
                      <Input keyboardType="number-pad" value={row.excused} onChangeText={(v) => patch(r.student.id, { excused: v })} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text variant="muted" className="text-xs">{t('grades.unexcusedDays')}</Text>
                      <Input keyboardType="number-pad" value={row.unexcused} onChangeText={(v) => patch(r.student.id, { unexcused: v })} />
                    </View>
                  </View>
                  <View className="gap-1">
                    <Text variant="muted" className="text-xs">{t('grades.teacherNote')}</Text>
                    <Input multiline maxLength={500} value={row.note} onChangeText={(v) => patch(r.student.id, { note: v })} />
                  </View>
                </FormSection>
              );
            })}
          </>
        )}
      </ScrollView>
      {d ? (
        <StickyActions>
          <Button className="flex-1" disabled={saving} onPress={save}>
            <Text>{saving ? t('grades.saving') : t('grades.save')}</Text>
          </Button>
        </StickyActions>
      ) : null}
    </>
  );
}
