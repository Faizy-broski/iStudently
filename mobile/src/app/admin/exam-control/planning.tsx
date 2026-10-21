import type { JcDay, JcInvigilator, JcOverview } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Trash2, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { JcError, Note, PrintButton, useDays, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const NONE = '__none__';
type View3 = 'schedule' | 'invigilators' | 'rota';

/** Schedule and invigilation (web: exam control › Schedule & invigilation). */
export default function ExamControlPlanning() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const [view, setView] = useState<View3>('schedule');
  const print = usePrintDoc(id);
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.tab_planning'),
          headerRight: () => <PrintButton label={t('examControl.print')} onPress={() => print(view === 'schedule' ? 'timetable' : 'invigilation')} />,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'schedule', label: t('examControl.schedule') },
            { value: 'invigilators', label: t('examControl.invigilators') },
            { value: 'rota', label: t('examControl.invigilation') },
          ]}
        />
        {view === 'schedule' ? <Schedule id={id} o={o} /> : view === 'invigilators' ? <Invigilators id={id} o={o} /> : <Rota id={id} o={o} />}
      </ScrollView>
    </>
  );
}

function useSubjects(o: JcOverview) {
  return useMemo(() => {
    const map = new Map<string, { key: string; name: string; codes: number[] }>();
    for (const g of o.grades)
      for (const s of g.subjects) {
        const cur = map.get(s.key) ?? { key: s.key, name: s.name, codes: [] };
        cur.codes.push(g.grade_code);
        map.set(s.key, cur);
      }
    return [...map.values()];
  }, [o.grades]);
}

function Schedule({ id, o }: { id: string; o: JcOverview }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const days = useDays(id);
  const [editing, setEditing] = useState<{ index: number; day: Partial<JcDay> } | null>(null);
  const save = useAction(jahbadhControl.saveSchedule, { success: t('examControl.saved') });
  const list = days.data ?? [];
  const persist = async (next: Partial<JcDay>[]) => {
    const res = await save.run(id, next);
    if (res.ok) {
      days.mutate(res.data, { revalidate: false });
      setEditing(null);
    }
  };
  const submit = (d: Partial<JcDay>) => {
    if (!editing) return;
    persist(editing.index < 0 ? [...list, d] : list.map((x, i) => (i === editing.index ? { ...x, ...d } : x)));
  };
  const remove = async (i: number) => {
    if (await confirm({ title: t('examControl.remove'), destructive: true })) persist(list.filter((_, j) => j !== i));
  };
  return (
    <FormSection
      title={t('examControl.schedule')}
      description={t('examControl.scheduleHint')}
      action={
        <Pressable onPress={() => setEditing({ index: -1, day: { exam_date: list.at(-1)?.exam_date ?? o.session.issue_date, grade_codes: [] } })} accessibilityRole="button" accessibilityLabel={t('examControl.addDay')} className="p-1">
          <Icon as={Plus} className="text-brand dark:text-brand-secondary size-5" />
        </Pressable>
      }>
      {days.isLoading ? <LoadingList rows={2} /> : null}
      {days.data && !list.length ? <Note text={t('examControl.noDays')} /> : null}
      {list.map((d, i) => (
        <Pressable key={d.id} onPress={() => setEditing({ index: i, day: d })} accessibilityRole="button" className="border-border flex-row items-center gap-2 border-b pb-2">
          <View className="flex-1">
            <Text className="text-sm font-medium">{`${d.exam_date} — ${d.subject_name}`}</Text>
            <Text variant="muted" className="text-[11px]">
              {[d.start_time && d.end_time ? `${d.start_time.slice(0, 5)} – ${d.end_time.slice(0, 5)}` : null, o.grades.filter((g) => d.grade_codes.includes(g.grade_code)).map((g) => g.grade_level_name).join('، ')].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable onPress={() => remove(i)} accessibilityRole="button" accessibilityLabel={t('examControl.remove')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
            <Icon as={Trash2} className="text-destructive size-4" />
          </Pressable>
        </Pressable>
      ))}
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={t('examControl.addDay')}>
        {editing ? <DayForm key={editing.index} o={o} value={editing.day} busy={save.running} onSave={submit} /> : null}
      </BottomSheet>
    </FormSection>
  );
}

function DayForm({ o, value, busy, onSave }: { o: JcOverview; value: Partial<JcDay>; busy: boolean; onSave: (d: Partial<JcDay>) => void }) {
  const { t } = useTranslation();
  const subjects = useSubjects(o);
  const [d, setD] = useState(value);
  const subj = subjects.find((s) => s.key === d.subject_key);
  return (
    <View className="gap-3">
      <DateField label={t('examControl.date')} value={d.exam_date} onChange={(x) => setD((v) => ({ ...v, exam_date: x }))} />
      <View className="gap-1.5">
        <Label>{t('examControl.subject')}</Label>
        <Picker
          value={d.subject_key ?? null}
          placeholder={t('examControl.pickSubject')}
          onChange={(k) => {
            const s = subjects.find((x) => x.key === k);
            setD((v) => ({ ...v, subject_key: k, subject_name: s?.name, grade_codes: s?.codes ?? [] }));
          }}
          options={subjects.map((s) => ({ value: s.key, label: s.name }))}
        />
      </View>
      {subj
        ? o.grades
            .filter((g) => subj.codes.includes(g.grade_code))
            .map((g) => (
              <View key={g.grade_level_id} className="flex-row items-center gap-3">
                <Checkbox
                  checked={(d.grade_codes ?? []).includes(g.grade_code)}
                  onCheckedChange={(on) => setD((v) => ({ ...v, grade_codes: on ? [...new Set([...(v.grade_codes ?? []), g.grade_code])] : (v.grade_codes ?? []).filter((c) => c !== g.grade_code) }))}
                />
                <Text className="text-sm">{g.grade_level_name}</Text>
              </View>
            ))
        : null}
      <View className="flex-row gap-3">
        <TimeField className="flex-1" label={t('examControl.startTime')} value={d.start_time?.slice(0, 5) ?? ''} onChange={(x) => setD((v) => ({ ...v, start_time: x }))} />
        <TimeField className="flex-1" label={t('examControl.endTime')} value={d.end_time?.slice(0, 5) ?? ''} onChange={(x) => setD((v) => ({ ...v, end_time: x }))} />
      </View>
      <Button onPress={() => onSave(d)} disabled={busy || !d.subject_key || !d.exam_date || !(d.grade_codes ?? []).length}>
        <Text>{t('examControl.save')}</Text>
      </Button>
    </View>
  );
}

function Invigilators({ id, o }: { id: string; o: JcOverview }) {
  const { t } = useTranslation();
  const invs = useApi(['jc', 'invigilators', id] as const, ([, , s]) => jahbadhControl.invigilators(s));
  const staff = useApi(['jc', 'staff', id] as const, ([, , s]) => jahbadhControl.staff(s));
  const days = useDays(id);
  const subjects = useSubjects(o);
  const [draft, setDraft] = useState<Partial<JcInvigilator>[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const save = useAction(jahbadhControl.saveInvigilators, { success: t('examControl.saved') });
  const list = draft ?? invs.data ?? [];
  const specs = [...new Set(subjects.map((s) => s.key.split('#')[0]))].map((k) => ({ value: k, label: subjects.find((s) => s.key.split('#')[0] === k)?.name.replace(/\s*\(.*\)$/, '') ?? k }));
  const add = (ids: string[]) => {
    const have = new Set(list.map((x) => x.staff_id));
    const extra = ids.filter((x) => !have.has(x)).map((x) => ({ staff_id: x, name: staff.data?.find((s) => s.id === x)?.name ?? '', specialization: null, available: true, unavailable_days: [] }));
    if (extra.length) setDraft([...list, ...extra]);
  };
  const submit = async () => {
    const res = await save.run(id, list);
    if (res.ok) {
      setDraft(null);
      invs.mutate(res.data, { revalidate: false });
    }
  };
  const editRow = editing === null ? null : list[editing];
  const patch = (p: Partial<JcInvigilator>) => setDraft(list.map((x, j) => (j === editing ? { ...x, ...p } : x)));
  return (
    <FormSection title={t('examControl.invigilators')} description={t('examControl.invigilatorsHint')}>
      <Picker
        value={NONE}
        onChange={(v) => v !== NONE && add([v])}
        options={[{ value: NONE, label: t('examControl.addInvigilator') }, ...(staff.data ?? []).filter((s) => !list.some((x) => x.staff_id === s.id)).map((s) => ({ value: s.id, label: s.name }))]}
      />
      <Button variant="outline" onPress={() => add((staff.data ?? []).filter((s) => s.role === 'teacher').map((s) => s.id))}>
        <Icon as={UserPlus} className="text-foreground size-4" />
        <Text>{t('examControl.addAllTeachers')}</Text>
      </Button>
      {invs.isLoading ? <LoadingList rows={2} /> : null}
      {invs.data && !list.length ? <Note text={t('examControl.noInvigilators')} /> : null}
      {list.map((x, i) => (
        <Pressable key={x.staff_id} onPress={() => setEditing(i)} accessibilityRole="button" className="border-border flex-row items-center gap-2 border-b pb-2">
          <View className="flex-1">
            <Text className={`text-sm font-medium ${x.available === false ? 'opacity-50' : ''}`}>{x.name}</Text>
            <Text variant="muted" className="text-[11px]">
              {[specs.find((s) => s.value === x.specialization)?.label, (x.unavailable_days ?? []).length ? `${t('examControl.unavailableDays')}: ${(x.unavailable_days ?? []).length}` : null].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <Pressable onPress={() => setDraft(list.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('examControl.remove')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
            <Icon as={Trash2} className="text-destructive size-4" />
          </Pressable>
        </Pressable>
      ))}
      <Button onPress={submit} disabled={!draft || save.running}>
        <Text>{t('examControl.save')}</Text>
      </Button>
      <BottomSheet open={!!editRow} onClose={() => setEditing(null)} title={editRow?.name}>
        {editRow ? (
          <View className="gap-3">
            <View className="gap-1.5">
              <Label>{t('examControl.specialization')}</Label>
              <Picker value={editRow.specialization ?? NONE} onChange={(v) => patch({ specialization: v === NONE ? null : v })} options={[{ value: NONE, label: '—' }, ...specs]} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm">{t('examControl.available')}</Text>
              <Switch checked={editRow.available !== false} onCheckedChange={(v) => patch({ available: v })} />
            </View>
            <Label>{t('examControl.unavailableDays')}</Label>
            {(days.data ?? []).map((d) => (
              <View key={d.id} className="flex-row items-center gap-3">
                <Checkbox
                  checked={(editRow.unavailable_days ?? []).includes(d.id)}
                  onCheckedChange={(v) => patch({ unavailable_days: v ? [...(editRow.unavailable_days ?? []), d.id] : (editRow.unavailable_days ?? []).filter((x) => x !== d.id) })}
                />
                <Text className="text-sm">{`${d.exam_date} — ${d.subject_name}`}</Text>
              </View>
            ))}
            <Button onPress={() => setEditing(null)}>
              <Text>{t('examControl.save')}</Text>
            </Button>
          </View>
        ) : null}
      </BottomSheet>
    </FormSection>
  );
}

function Rota({ id, o }: { id: string; o: JcOverview }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const duties = useApi(['jc', 'duties', id] as const, ([, , s]) => jahbadhControl.invigilation(s));
  const days = useDays(id);
  const committees = useApi(['jc', 'committee-status', id] as const, ([, , s]) => jahbadhControl.committeeStatus(s));
  const invs = useApi(['jc', 'invigilators', id] as const, ([, , s]) => jahbadhControl.invigilators(s));
  const [short, setShort] = useState<{ dayId: string; needed: number; eligible: number }[]>([]);
  const generate = useAction(jahbadhControl.generateInvigilation, { success: t('examControl.generated') });
  const setDuty = useAction(jahbadhControl.setDuty);
  const slots = o.session.settings.obs_per_committee;
  const reserves = o.session.settings.reserve_per_day;
  const used = (committees.data ?? []).filter((c) => c.count > 0);
  const people = [{ value: NONE, label: '—' }, ...(invs.data ?? []).filter((x) => x.available).map((x) => ({ value: x.staff_id, label: x.name }))];

  const doGenerate = async () => {
    if (duties.data?.some((d) => !d.is_manual) && !(await confirm({ title: t('examControl.generateInvigilation'), body: t('examControl.confirmRegenerate') }))) return;
    const res = await generate.run(id);
    if (res.ok && res.data) {
      duties.mutate(res.data.duties, { revalidate: false });
      setShort(res.data.short_days);
    }
  };
  const change = async (dayId: string, committeeId: string | null, slot: number, isReserve: boolean, staffId: string) => {
    const res = await setDuty.run(id, { exam_day_id: dayId, committee_id: committeeId, slot, is_reserve: isReserve, staff_id: staffId === NONE ? null : staffId });
    if (res.ok) duties.mutate(res.data, { revalidate: false });
  };
  const valueOf = (dayId: string, committeeId: string | null, slot: number, isReserve: boolean) =>
    duties.data?.find((x) => x.exam_day_id === dayId && x.committee_id === committeeId && x.slot === slot && x.is_reserve === isReserve)?.staff_id ?? NONE;
  const loads = useMemo(() => {
    const m = new Map<string, { duties: number; reserves: number }>();
    for (const d of duties.data ?? []) {
      const cur = m.get(d.staff_id) ?? { duties: 0, reserves: 0 };
      if (d.is_reserve) cur.reserves++;
      else cur.duties++;
      m.set(d.staff_id, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].duties - a[1].duties);
  }, [duties.data]);

  if (!duties.data || !days.data || !committees.data) return <LoadingList rows={3} />;
  return (
    <View className="gap-4">
      <Note text={t('examControl.invigilationHint')} />
      <Button onPress={doGenerate} disabled={generate.running || !days.data.length || !invs.data?.length || !used.length}>
        <Text>{t('examControl.generateInvigilation')}</Text>
      </Button>
      {short.length ? (
        <Note tone="destructive" text={short.map((s) => t('examControl.shortDay', { date: days.data?.find((d) => d.id === s.dayId)?.exam_date ?? '', needed: s.needed, eligible: s.eligible })).join(' · ')} />
      ) : null}
      {!days.data.length || !used.length ? <Note text={t('examControl.invigilationNeeds')} /> : null}
      {days.data.map((d) => (
        <FormSection key={d.id} title={`${d.exam_date} — ${d.subject_name}`}>
          {used.map((c) => (
            <View key={c.id} className="gap-1.5">
              <Label>{c.name}</Label>
              {Array.from({ length: slots }, (_, k) => (
                <Picker key={k} value={valueOf(d.id, c.id, k + 1, false)} onChange={(v) => change(d.id, c.id, k + 1, false, v)} options={people} />
              ))}
            </View>
          ))}
          {reserves ? (
            <View className="gap-1.5">
              <Label>{t('examControl.reserve')}</Label>
              {Array.from({ length: reserves }, (_, k) => (
                <Picker key={k} value={valueOf(d.id, null, k + 1, true)} onChange={(v) => change(d.id, null, k + 1, true, v)} options={people} />
              ))}
            </View>
          ) : null}
        </FormSection>
      ))}
      {loads.length ? (
        <FormSection title={t('examControl.fairnessNote')}>
          {loads.map(([sid, l]) => (
            <Text key={sid} className="text-sm">{`${invs.data?.find((x) => x.staff_id === sid)?.name ?? '?'}: ${t('examControl.loadLine', { duties: l.duties, reserves: l.reserves })}`}</Text>
          ))}
        </FormSection>
      ) : null}
    </View>
  );
}
