import type { JcStudent } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { JcError, Note, PrintButton, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const STATUSES: JcStudent['status'][] = ['participating', 'exempt', 'withdrawn', 'transferred'];
const SPECIAL = ['extra_time', 'reader', 'scribe', 'other'] as const;
const NONE = '__none__';

/** Students and numbers (web: exam control › Students & numbers). */
export default function ExamControlStudents() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const students = useApi(id ? (['jc', 'students', id] as const) : null, ([, , s]) => jahbadhControl.students(s));
  const [grade, setGrade] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<JcStudent | null>(null);
  const print = usePrintDoc(id);
  const pull = useAction(jahbadhControl.pullStudents);
  const numbers = useAction(jahbadhControl.generateNumbers);
  const update = useAction(jahbadhControl.updateStudents, { success: t('examControl.saved') });
  const locked = !!o?.session.committees_locked_at;
  const numbered = o?.counts.numbered ?? 0;

  const rows = useMemo(
    () => (students.data ?? []).filter((s) => (grade === 'all' || s.grade_level_id === grade) && (!search || s.name.includes(search) || String(s.seat_number ?? '').includes(search))),
    [students.data, grade, search],
  );

  const doPull = async () => {
    if (!id) return;
    const res = await pull.run(id);
    if (res.ok) {
      toast.success(t('examControl.pulled', { n: res.data?.added ?? 0 }));
      students.mutate();
      ov.mutate();
    }
  };
  const doNumbers = async () => {
    if (!id) return;
    if (numbered && !(await confirm({ title: t('examControl.generateNumbers'), body: t('examControl.confirmRenumber') }))) return;
    const res = await numbers.run(id);
    if (res.ok) {
      toast.success(t('examControl.numbersGenerated', { n: res.data?.generated ?? 0 }));
      students.mutate();
      ov.mutate();
    }
  };
  const save = async (row: Partial<JcStudent> & { id: string }) => {
    if (!id) return;
    const res = await update.run(id, [row]);
    if (res.ok) {
      students.mutate(res.data, { revalidate: false });
      ov.mutate();
      setEditing(null);
    }
  };

  if (ov.error) return <JcError error={ov.error} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.tab_students'),
          headerRight: o?.rights.secret ? () => <PrintButton label={t('examControl.doc_general_list')} onPress={() => print('general_list')} /> : undefined,
        }}
      />
      <DataList
        className="bg-background"
        header={
          <View className="gap-3 p-4">
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" className="flex-1" onPress={doPull} disabled={pull.running || locked || !o?.grades.length}>
                <Text>{t('examControl.pullStudents')}</Text>
              </Button>
              <Button size="sm" className="flex-1" onPress={doNumbers} disabled={numbers.running || locked || !o?.counts.participating}>
                <Text>{t('examControl.generateNumbers')}</Text>
              </Button>
            </View>
            {o ? <Note text={t('examControl.numbersHint', { mode: t(`examControl.opt_secret_mode_${o.session.settings.secret_mode}`) })} /> : null}
            {locked ? <Note tone="warning" text={t('examControl.lockedNote')} /> : null}
            <FilterChips value={grade} onChange={setGrade} options={[{ value: 'all', label: t('examControl.allGrades') }, ...(o?.grades ?? []).map((g) => ({ value: g.grade_level_id, label: g.grade_level_name }))]} />
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('examControl.searchStudent')} />
          </View>
        }
        items={students.data ? rows : undefined}
        error={students.error}
        isLoading={students.isLoading}
        isRefreshing={students.isValidating && !students.isLoading}
        onRefresh={() => students.mutate()}
        emptyTitle={o?.grades.length ? t('examControl.noStudentsPull') : t('examControl.noGradesYet')}
        keyExtractor={(s: JcStudent) => s.id}
        renderItem={(s: JcStudent) => (
          <Pressable onPress={() => setEditing(s)} accessibilityRole="button" className={`gap-1 px-4 py-3 active:opacity-70 ${s.status !== 'participating' ? 'opacity-60' : ''}`}>
            <View className="flex-row items-center gap-2">
              <Text className="w-16 text-sm font-semibold tabular-nums">{s.seat_number ? String(s.seat_number) : '—'}</Text>
              <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                {s.name}
              </Text>
              {s.status !== 'participating' ? <StatusChip label={t(`examControl.studentStatus_${s.status}`)} tone="muted" /> : null}
            </View>
            <Text variant="muted" className="text-[11px]">
              {[s.grade_level_name, s.section_name, s.committee_id ? `${t('examControl.committee')} ${s.seat_index ?? ''}${s.paper_model ? ` · ${s.paper_model}` : ''}` : null, s.special_case ? t(`examControl.special_${s.special_case}`) : null].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        )}
      />
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.name}>
        {editing ? <EditStudent key={editing.id} s={editing} locked={locked} busy={update.running} onSave={save} /> : null}
      </BottomSheet>
    </>
  );
}

function EditStudent({ s, locked, busy, onSave }: { s: JcStudent; locked: boolean; busy: boolean; onSave: (row: Partial<JcStudent> & { id: string }) => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(s.status);
  const [special, setSpecial] = useState<string>(s.special_case ?? NONE);
  const [minutes, setMinutes] = useState(s.extra_minutes === null ? '' : String(s.extra_minutes));
  const submit = () =>
    onSave({
      id: s.id,
      ...(status !== s.status ? { status: status as JcStudent['status'] } : {}),
      special_case: special === NONE ? null : (special as JcStudent['special_case']),
      extra_minutes: special === NONE || minutes === '' ? null : Number(minutes),
    });
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>{t('examControl.studentStatus')}</Label>
        <Picker value={status} onChange={setStatus} options={STATUSES.map((x) => ({ value: x, label: t(`examControl.studentStatus_${x}`), disabled: locked && x !== s.status }))} />
      </View>
      <View className="gap-1.5">
        <Label>{t('examControl.specialCase')}</Label>
        <Picker value={special} onChange={setSpecial} options={[{ value: NONE, label: '—' }, ...SPECIAL.map((x) => ({ value: x, label: t(`examControl.special_${x}`) }))]} />
      </View>
      {special !== NONE ? (
        <View className="gap-1.5">
          <Label>{t('examControl.extraMinutes')}</Label>
          <Input value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </View>
      ) : null}
      <Button onPress={submit} disabled={busy}>
        <Text>{t('examControl.save')}</Text>
      </Button>
    </View>
  );
}
