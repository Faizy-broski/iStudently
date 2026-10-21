import type { JcCommittee, JcCommitteeStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Grid3x3, ListOrdered, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { JcError, Note, pct, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const NONE = '__none__';

/** Committees, distribution and lock (web: exam control › Committees). */
export default function ExamControlCommittees() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const committees = useApi(id ? (['jc', 'committees', id] as const) : null, ([, , s]) => jahbadhControl.committees(s));
  const status = useApi(id ? (['jc', 'committee-status', id] as const) : null, ([, , s]) => jahbadhControl.committeeStatus(s));
  const staff = useApi(id ? (['jc', 'staff', id] as const) : null, ([, , s]) => jahbadhControl.staff(s));
  const [editing, setEditing] = useState<Partial<JcCommittee> | null>(null);
  const print = usePrintDoc(id);
  const saveAll = useAction(jahbadhControl.saveCommittees, { success: t('examControl.saved') });
  const distribute = useAction(jahbadhControl.distribute);
  const lock = useAction(jahbadhControl.lock, { success: t('examControl.lockedToast') });
  const unlock = useAction(jahbadhControl.unlock, { success: t('examControl.unlockedToast') });
  const locked = !!o?.session.committees_locked_at;
  const c = o?.counts;

  const reload = () => {
    committees.mutate();
    status.mutate();
    ov.mutate();
  };
  const persist = async (list: Partial<JcCommittee>[]) => {
    if (!id) return;
    if ((await saveAll.run(id, list)).ok) {
      setEditing(null);
      reload();
    }
  };
  const saveOne = (row: Partial<JcCommittee>) => {
    const list = committees.data ?? [];
    persist(row.id ? list.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [...list, row]);
  };
  const removeOne = async (row: Partial<JcCommittee>) => {
    if (!(await confirm({ title: t('examControl.remove'), destructive: true }))) return;
    persist((committees.data ?? []).filter((x) => x.id !== row.id));
  };
  const doDistribute = async () => {
    if (!id) return;
    const res = await distribute.run(id);
    if (res.ok && res.data) {
      toast.success(res.data.unassigned ? t('examControl.distributedShort', { placed: res.data.placed, unassigned: res.data.unassigned }) : t('examControl.distributed', { placed: res.data.placed }));
      reload();
    }
  };
  const doLock = async (on: boolean) => {
    if (!id) return;
    if (!(await confirm({ title: on ? t('examControl.lockCommittees') : t('examControl.unlockCommittees'), body: on ? t('examControl.confirmLock') : t('examControl.confirmUnlock') }))) return;
    if ((await (on ? lock : unlock).run(id)).ok) reload();
  };

  if (ov.error) return <JcError error={ov.error} />;
  const capacity = (committees.data ?? []).reduce((a, x) => a + (x.capacity || 0), 0);
  const rows: JcCommitteeStatus[] | undefined = status.data;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.tab_committees'),
          headerRight: !locked
            ? () => (
                <Pressable onPress={() => setEditing({ name: t('examControl.committeeN', { n: (committees.data?.length ?? 0) + 1 }), capacity: 20, seat_columns: 4, is_special_needs: false })} accessibilityRole="button" accessibilityLabel={t('examControl.addCommittee')} className="p-2">
                  <Icon as={Plus} className="text-brand dark:text-brand-secondary size-5" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <DataList
        className="bg-background"
        header={
          <View className="gap-3 p-4">
            {c ? (
              <Text className={`text-sm ${capacity >= c.participating ? 'text-muted-foreground' : 'text-destructive'}`}>{t('examControl.capacityLine', { capacity, students: c.participating })}</Text>
            ) : null}
            {locked ? (
              <>
                <Note tone="warning" text={t('examControl.lockedNote')} />
                {o?.rights.chief ? (
                  <Button variant="outline" onPress={() => doLock(false)}>
                    <Text>{t('examControl.unlockCommittees')}</Text>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                {o ? <Note text={t('examControl.distributionHint', { mode: t(`examControl.opt_distribution_${o.session.settings.distribution}`) })} /> : null}
                <View className="flex-row gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onPress={doDistribute} disabled={distribute.running || !committees.data?.length || !c?.numbered}>
                    <Text>{t('examControl.distribute')}</Text>
                  </Button>
                  <Button size="sm" className="flex-1" onPress={() => doLock(true)} disabled={!c?.participating || (c?.placed ?? 0) < (c?.participating ?? 0)}>
                    <Text>{t('examControl.lockCommittees')}</Text>
                  </Button>
                </View>
              </>
            )}
          </View>
        }
        items={rows}
        error={status.error}
        isLoading={status.isLoading}
        isRefreshing={status.isValidating && !status.isLoading}
        onRefresh={reload}
        emptyTitle={t('examControl.noCommittees')}
        keyExtractor={(x: JcCommitteeStatus) => x.id}
        renderItem={(x: JcCommitteeStatus) => (
          <Pressable onPress={() => !locked && setEditing(committees.data?.find((k) => k.id === x.id) ?? x)} accessibilityRole="button" className="gap-1.5 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-semibold">{x.room_label ? `${x.name} · ${x.room_label}` : x.name}</Text>
              <Text className="text-sm tabular-nums">{`${x.count}/${x.capacity}`}</Text>
            </View>
            <Text variant="muted" className="text-[11px]">
              {[x.from_seat !== null ? `${x.from_seat} – ${x.to_seat}` : null, x.grades.join('، ') || null, `${t('examControl.occupancy')} ${pct(x.occupancy, 0)}`, x.special ? `${t('examControl.specialCount')} ${x.special}` : null].filter(Boolean).join(' · ')}
            </Text>
            {x.flags.length ? (
              <View className="flex-row flex-wrap gap-1">
                {x.flags.map((f) => (
                  <StatusChip key={f} label={t(`examControl.flag_${f}`)} tone="warning" />
                ))}
              </View>
            ) : null}
            {x.count ? (
              <View className="flex-row gap-2">
                <Button variant="outline" size="sm" onPress={() => print('seating_map', { committeeId: x.id })}>
                  <Icon as={Grid3x3} className="text-foreground size-4" />
                  <Text>{t('examControl.doc_seating_map')}</Text>
                </Button>
                <Button variant="outline" size="sm" onPress={() => print('committee_mirror', { committeeId: x.id })}>
                  <Icon as={ListOrdered} className="text-foreground size-4" />
                  <Text>{t('examControl.doc_committee_mirror')}</Text>
                </Button>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? t('examControl.addCommittee')}>
        {editing ? (
          <CommitteeForm
            key={editing.id ?? 'new'}
            value={editing}
            staff={(staff.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            busy={saveAll.running}
            onSave={saveOne}
            onRemove={editing.id ? () => removeOne(editing) : undefined}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}

function CommitteeForm({ value, staff, busy, onSave, onRemove }: { value: Partial<JcCommittee>; staff: { value: string; label: string }[]; busy: boolean; onSave: (v: Partial<JcCommittee>) => void; onRemove?: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState(value);
  const set = (patch: Partial<JcCommittee>) => setV((x) => ({ ...x, ...patch }));
  const people = [{ value: NONE, label: '—' }, ...staff];
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>{t('examControl.committeeName')}</Label>
        <Input value={v.name ?? ''} onChangeText={(x) => set({ name: x })} />
      </View>
      <View className="gap-1.5">
        <Label>{t('examControl.room')}</Label>
        <Input value={v.room_label ?? ''} onChangeText={(x) => set({ room_label: x })} />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <Label>{t('examControl.capacity')}</Label>
          <Input value={String(v.capacity ?? 0)} keyboardType="number-pad" onChangeText={(x) => set({ capacity: Number(x.replace(/\D/g, '') || 0) })} />
        </View>
        <View className="flex-1 gap-1.5">
          <Label>{t('examControl.columns')}</Label>
          <Input value={String(v.seat_columns ?? 4)} keyboardType="number-pad" onChangeText={(x) => set({ seat_columns: Number(x.replace(/\D/g, '') || 1) })} />
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm">{t('examControl.specialNeeds')}</Text>
        <Switch checked={!!v.is_special_needs} onCheckedChange={(x) => set({ is_special_needs: x })} />
      </View>
      <View className="gap-1.5">
        <Label>{t('examControl.invigilator1')}</Label>
        <Picker value={v.invigilator1_id ?? NONE} onChange={(x) => set({ invigilator1_id: x === NONE ? null : x })} options={people} />
      </View>
      <View className="gap-1.5">
        <Label>{t('examControl.invigilator2')}</Label>
        <Picker value={v.invigilator2_id ?? NONE} onChange={(x) => set({ invigilator2_id: x === NONE ? null : x })} options={people} />
      </View>
      <Button onPress={() => onSave(v)} disabled={busy || !v.name?.trim()}>
        <Text>{t('examControl.save')}</Text>
      </Button>
      {onRemove ? (
        <Button variant="outline" onPress={onRemove} disabled={busy}>
          <Text className="text-destructive">{t('examControl.remove')}</Text>
        </Button>
      ) : null}
    </View>
  );
}
