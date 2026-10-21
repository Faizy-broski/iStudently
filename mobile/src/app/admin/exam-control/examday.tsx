import { JC_ACTION_AR, JC_VIOLATION_AR, type JcAttendanceState, type JcDayStudent, type JcEnvelope, type JcEnvelopeCheck } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { CheckCircle2, Copy, Lock, ScanLine, Trash2, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { ScanField, useScanError } from '@/features/exam-control/scan';
import { JcError, MiniTile, Note, PrintButton, pickDefaultDay, useDays, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Pane = 'dashboard' | 'attendance' | 'violations' | 'envelopes' | 'receipt' | 'minutes';
const STATES: JcAttendanceState[] = ['present', 'absent', 'late', 'exit'];
const ALL = '__all__';

/** Exam day (web: exam control › Exam day): live dashboard, attendance, violations, envelopes. */
export default function ExamControlDay() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const days = useDays(id);
  const [dayId, setDayId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('dashboard');
  const print = usePrintDoc(id);
  const day = dayId ?? (days.data ? pickDefaultDay(days.data) : null);
  const manage = ov.data?.rights.manage ?? false;
  const camera = ov.data?.session.settings.camera_scanning ?? true;

  if (ov.error) return <JcError error={ov.error} />;
  if (!days.data || !id) return <LoadingList />;
  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.tab_examday'),
          headerRight: manage && day ? () => <PrintButton label={t('examControl.doc_attendance_sheet')} onPress={() => print('attendance_sheet', { dayId: day })} /> : undefined,
        }}
      />
      {!day ? (
        <View className="bg-background flex-1 p-4">
          <EmptyState title={t('examControl.noDays')} />
        </View>
      ) : (
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
          <Picker value={day} onChange={setDayId} options={days.data.map((d) => ({ value: d.id, label: `${d.exam_date} — ${d.subject_name}` }))} />
          <FilterChips
            value={pane}
            onChange={setPane}
            options={[
              { value: 'dashboard', label: t('examControl.dayDashboard') },
              { value: 'attendance', label: t('examControl.attendance') },
              { value: 'violations', label: t('examControl.violations') },
              { value: 'envelopes', label: t('examControl.envelopes') },
              { value: 'receipt', label: t('examControl.envelopeReceipt') },
              { value: 'minutes', label: t('examControl.timerMinutes') },
            ]}
          />
          {pane === 'dashboard' ? (
            <Dashboard id={id} dayId={day} />
          ) : pane === 'attendance' ? (
            <Attendance key={day} id={id} dayId={day} camera={camera} />
          ) : pane === 'violations' ? (
            <Violations id={id} dayId={day} manage={manage} camera={camera} />
          ) : pane === 'envelopes' ? (
            <Envelopes key={day} id={id} dayId={day} />
          ) : pane === 'receipt' ? (
            <EnvelopeReceipt key={day} id={id} dayId={day} camera={camera} />
          ) : (
            <TimerMinutes id={id} dayId={day} />
          )}
          {manage && pane === 'envelopes' ? (
            <View className="flex-row gap-2">
              <Button variant="outline" size="sm" className="flex-1" onPress={() => print('envelope_mirror', { dayId: day })}>
                <Text>{t('examControl.doc_envelope_mirror')}</Text>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onPress={() => print('delivery_sheet', { dayId: day })}>
                <Text>{t('examControl.doc_delivery_sheet')}</Text>
              </Button>
            </View>
          ) : null}
        </ScrollView>
      )}
    </>
  );
}

function EnvelopeState({ e }: { e: Pick<JcEnvelope, 'booklet_count' | 'match' | 'sealed'> }) {
  const { t } = useTranslation();
  if (e.booklet_count === null) return <StatusChip label={t('examControl.notReceived')} tone="muted" />;
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={e.match ? CheckCircle2 : XCircle} className={e.match ? 'text-success size-4' : 'text-destructive size-4'} />
      <Text className={`text-xs font-semibold ${e.match ? 'text-success' : 'text-destructive'}`}>{`${e.booklet_count}${e.sealed ? ` · ${t('examControl.sealed')}` : ''}`}</Text>
    </View>
  );
}

function Dashboard({ id, dayId }: { id: string; dayId: string }) {
  const { t } = useTranslation();
  // Live view of the exam day (C6.6): refreshes every 10 s while open.
  const d = useApi(['jc', 'day-dashboard', id, dayId] as const, ([, , s, day]) => jahbadhControl.dayDashboard(s, day), { refreshInterval: 10_000 });
  if (d.error) return <Note tone="destructive" text={d.error.message} />;
  if (!d.data) return <LoadingList rows={3} />;
  const x = d.data.tiles;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <MiniTile label={t('examControl.count_students')} value={x.students} />
        <MiniTile label={t('examControl.present')} value={x.present} tone="success" />
        <MiniTile label={t('examControl.absent')} value={x.absent} tone={x.absent ? 'destructive' : 'muted'} />
        <MiniTile label={t('examControl.late')} value={x.late} tone={x.late ? 'warning' : 'muted'} />
        <MiniTile label={t('examControl.envelopesReceived')} value={`${x.envelopes}/${x.envelopes_total}`} tone={x.envelopes === x.envelopes_total ? 'success' : 'warning'} />
        <MiniTile label={t('examControl.violations')} value={x.violations} tone={x.violations ? 'destructive' : 'muted'} />
      </View>
      {d.data.committees.map((c) => (
        <View key={c.committee_id} className="bg-card border-border gap-1 rounded-2xl border p-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold">{c.committee_name}</Text>
            <EnvelopeState e={c} />
          </View>
          <Text variant="muted" className="text-[11px]">
            {`${t('examControl.count_students')} ${c.students} · ${t('examControl.present')} ${c.present} · ${t('examControl.absent')} ${c.absent} · ${t('examControl.late')} ${c.late} · ${t('examControl.violations')} ${c.violations}`}
          </Text>
        </View>
      ))}
      <Text variant="muted" className="text-[11px]">
        {t('examControl.liveHint')}
      </Text>
    </View>
  );
}

function Attendance({ id, dayId, camera }: { id: string; dayId: string; camera: boolean }) {
  const { t } = useTranslation();
  const committees = useApi(['jc', 'committees', id] as const, ([, , s]) => jahbadhControl.committees(s));
  const [committee, setCommittee] = useState(ALL);
  const data = useApi(['jc', 'attendance', id, dayId, committee] as const, ([, , s, day, c]) => jahbadhControl.attendance(s, day, c === ALL ? null : c));
  const [changes, setChanges] = useState<Record<string, { state: JcAttendanceState; minutes_late: number | null }>>({});
  const save = useAction(jahbadhControl.saveAttendance, { success: t('examControl.saved') });
  const rows = data.data?.rows ?? [];
  const dirty = Object.keys(changes).length;
  const submit = async () => {
    const res = await save.run(id, dayId, Object.entries(changes).map(([sid, v]) => ({ id: sid, ...v })));
    if (res.ok) {
      setChanges({});
      data.mutate();
    }
  };
  const confirm = useConfirm();
  const scanError = useScanError();
  const [door, setDoor] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const onCard = async (digits: string) => {
    const res = await jahbadhControl.scan(id, digits, 'card', dayId);
    const st = res.success ? res.data?.student : null;
    if (!st) return { ok: false, message: scanError(res.code, res.error) };
    if (committee !== ALL && st.committee_id !== committee) return { ok: false, message: t('examControl.scanOtherCommittee', { committee: st.committee_name ?? '—' }) };
    if (scanned.includes(st.id)) return { ok: false, message: t('examControl.scanAlready', { name: st.name }) };
    setScanned((x) => [...x, st.id]);
    setChanges((c) => ({ ...c, [st.id]: { state: 'present', minutes_late: null } }));
    return { ok: true, message: `${st.seat_number} · ${st.name}` };
  };
  const finishDoor = async () => {
    const rest = rows.filter((r) => !scanned.includes(r.id));
    if (!(await confirm({ title: t('examControl.doorFinish'), body: t('examControl.confirmDoorFinish', { n: rest.length }) }))) return;
    const entries = [
      ...rows.filter((r) => scanned.includes(r.id)).map((r) => ({ id: r.id, state: 'present' as JcAttendanceState, minutes_late: null })),
      ...rest.map((r) => ({ id: r.id, state: 'absent' as JcAttendanceState, minutes_late: null })),
    ];
    const res = await save.run(id, dayId, entries);
    if (res.ok) {
      setChanges({});
      setScanned([]);
      setDoor(false);
      data.mutate();
    }
  };
  return (
    <View className="gap-3">
      {door ? (
        <FormSection title={t('examControl.doorScan')} description={t('examControl.doorScanHint')}>
          <ScanField expect="card" camera={camera} onScan={onCard} />
          <Text className="text-sm">{t('examControl.doorScanCount', { scanned: scanned.length, total: rows.length })}</Text>
          <Button onPress={finishDoor} disabled={!rows.length || save.running}>
            <Text>{t('examControl.doorFinish')}</Text>
          </Button>
          <Button variant="outline" onPress={() => { setDoor(false); setScanned([]); }}>
            <Text>{t('examControl.cancel')}</Text>
          </Button>
        </FormSection>
      ) : (
        <Button variant="outline" onPress={() => setDoor(true)}>
          <Icon as={ScanLine} className="text-foreground size-4" />
          <Text>{t('examControl.doorScan')}</Text>
        </Button>
      )}
      <Picker
        value={committee}
        onChange={(v) => {
          setCommittee(v);
          setChanges({});
          setScanned([]);
        }}
        options={[{ value: ALL, label: t('examControl.allCommittees') }, ...(committees.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
      />
      <Note text={t('examControl.attendanceHint')} />
      <Button onPress={submit} disabled={!dirty || save.running}>
        <Text>{dirty ? t('examControl.saveN', { n: dirty }) : t('examControl.save')}</Text>
      </Button>
      {data.isLoading ? <LoadingList rows={4} /> : null}
      {data.data && !rows.length ? <Note text={t('examControl.noStudentsToday')} /> : null}
      {rows.map((r) => {
        const st = changes[r.id]?.state ?? r.state;
        const late = changes[r.id] ? changes[r.id].minutes_late : r.minutes_late;
        const set = (state: JcAttendanceState, minutes: number | null = late) => setChanges((c) => ({ ...c, [r.id]: { state, minutes_late: state === 'late' ? minutes : null } }));
        return (
          <View key={r.id} className={`border-border gap-2 border-b pb-3 ${changes[r.id] ? 'bg-brand/5' : ''}`}>
            <View className="flex-row items-center gap-2">
              <Text className="w-16 text-sm font-semibold">{String(r.seat_number ?? '')}</Text>
              <Text className="flex-1 text-sm" numberOfLines={1}>
                {r.name}
              </Text>
              {r.special_case ? <StatusChip label={t(`examControl.special_${r.special_case}`)} tone="warning" /> : null}
            </View>
            <Segmented value={st} onChange={(v) => set(v)} options={STATES.map((s) => ({ value: s, label: t(`examControl.state_${s}`) }))} />
            {st === 'late' ? (
              <Input placeholder={t('examControl.minutesLate')} keyboardType="number-pad" value={late === null ? '' : String(late)} onChangeText={(v) => set('late', v === '' ? null : Number(v.replace(/\D/g, '')))} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const VIO = Object.keys(JC_VIOLATION_AR) as (keyof typeof JC_VIOLATION_AR)[];
const ACT = Object.keys(JC_ACTION_AR) as (keyof typeof JC_ACTION_AR)[];

function Violations({ id, dayId, manage, camera }: { id: string; dayId: string; manage: boolean; camera: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const list = useApi(['jc', 'violations', id, dayId] as const, ([, , s, day]) => jahbadhControl.violations(s, day));
  const [seat, setSeat] = useState('');
  const [found, setFound] = useState<{ seat: string; student: (JcDayStudent & { committee_name: string | null }) | null } | null>(null);
  const [type, setType] = useState<string>('cheating');
  const [action, setAction] = useState<string>('warning');
  const [notes, setNotes] = useState('');
  const add = useAction(jahbadhControl.addViolation, { success: t('examControl.violationAdded') });
  const del = useAction(jahbadhControl.deleteViolation);
  const who = found?.seat === seat ? found.student : null;

  useEffect(() => {
    if (!/^\d+$/.test(seat)) return;
    const h = setTimeout(async () => {
      const res = await jahbadhControl.bySeat(id, Number(seat));
      setFound({ seat, student: res.success && res.data ? res.data : null });
    }, 350);
    return () => clearTimeout(h);
  }, [seat, id]);

  const scanError = useScanError();
  const onCard = async (digits: string) => {
    const res = await jahbadhControl.scan(id, digits, 'card', dayId);
    const st = res.success ? res.data?.student : null;
    if (!st) return { ok: false, message: scanError(res.code, res.error) };
    setSeat(String(st.seat_number ?? ''));
    return { ok: true, message: `${st.seat_number} · ${st.name}` };
  };
  const submit = async () => {
    const res = await add.run(id, {
      exam_day_id: dayId,
      seat_number: Number(seat),
      type: JC_VIOLATION_AR[type as keyof typeof JC_VIOLATION_AR],
      action_taken: JC_ACTION_AR[action as keyof typeof JC_ACTION_AR],
      notes,
    });
    if (res.ok) {
      list.mutate(res.data, { revalidate: false });
      setSeat('');
      setNotes('');
    }
  };
  const remove = async (vid: string) => {
    if (!(await confirm({ title: t('examControl.confirmDeleteViolation'), destructive: true }))) return;
    if ((await del.run(id, vid)).ok) list.mutate();
  };
  const label = (map: Record<string, string>, prefix: string, ar: string | null) => {
    const k = Object.keys(map).find((x) => map[x] === ar);
    return k ? t(`examControl.${prefix}_${k}`) : (ar ?? '—');
  };

  return (
    <View className="gap-4">
      <FormSection title={t('examControl.addViolation')}>
        <ScanField expect="card" camera={camera} placeholder={t('examControl.scanCardHint')} onScan={onCard} />
        <View className="gap-1.5">
          <Label>{t('examControl.seatNumber')}</Label>
          <Input value={seat} onChangeText={(v) => setSeat(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </View>
        {seat && found?.seat === seat ? (
          who ? <Note tone="success" text={`${who.name} · ${who.grade_level_name} · ${who.committee_name ?? '—'}`} /> : <Note tone="warning" text={t('examControl.seatNotFound')} />
        ) : null}
        <View className="gap-1.5">
          <Label>{t('examControl.violationType')}</Label>
          <Picker value={type} onChange={setType} options={VIO.map((k) => ({ value: k, label: t(`examControl.vio_${k}`) }))} />
        </View>
        <View className="gap-1.5">
          <Label>{t('examControl.actionTaken')}</Label>
          <Picker value={action} onChange={setAction} options={ACT.map((k) => ({ value: k, label: t(`examControl.act_${k}`) }))} />
        </View>
        <View className="gap-1.5">
          <Label>{t('examControl.notes')}</Label>
          <Textarea value={notes} onChangeText={setNotes} />
        </View>
        <Button onPress={submit} disabled={!who || add.running}>
          <Text>{t('examControl.record')}</Text>
        </Button>
      </FormSection>
      {list.isLoading ? <LoadingList rows={2} /> : null}
      {list.data && !list.data.length ? <Note text={t('examControl.noViolations')} /> : null}
      {list.data?.map((v) => (
        <View key={v.id} className="bg-card border-border gap-1 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm font-semibold">{`${v.seat_number ?? ''} · ${v.name}`}</Text>
            {v.repeat ? <StatusChip label={t('examControl.repeat')} tone="destructive" /> : null}
            {manage ? (
              <Pressable onPress={() => remove(v.id)} accessibilityRole="button" accessibilityLabel={t('examControl.remove')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            ) : null}
          </View>
          <Text variant="muted" className="text-[11px]">
            {`${new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${label(JC_VIOLATION_AR, 'vio', v.type)} · ${label(JC_ACTION_AR, 'act', v.action_taken)}`}
          </Text>
          {v.notes ? <Text className="text-xs">{v.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Envelopes({ id, dayId }: { id: string; dayId: string }) {
  const { t } = useTranslation();
  const list = useApi(['jc', 'envelopes', id, dayId] as const, ([, , s, day]) => jahbadhControl.envelopes(s, day));
  const [counts, setCounts] = useState<Record<string, string>>({});
  const save = useAction(jahbadhControl.saveEnvelope);
  const print = usePrintDoc(id);
  const submit = async (committeeId: string, count: number | null, sealed: boolean) => {
    const res = await save.run(id, dayId, { committee_id: committeeId, booklet_count: count, sealed });
    if (res.ok) {
      list.mutate(res.data, { revalidate: false });
      setCounts((c) => {
        const n = { ...c };
        delete n[committeeId];
        return n;
      });
    }
  };
  if (!list.data) return <LoadingList rows={3} />;
  if (!list.data.length) return <Note text={t('examControl.noStudentsToday')} />;
  return (
    <View className="gap-3">
      <Note text={t('examControl.envelopesHint')} />
      {list.data.map((e) => {
        const draft = counts[e.committee_id];
        return (
          <View key={e.committee_id} className="bg-card border-border gap-2 rounded-2xl border p-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{e.committee_name}</Text>
              <EnvelopeState e={{ ...e, sealed: false }} />
            </View>
            <Text variant="muted" className="text-[11px]">{`${t('examControl.count_students')} ${e.students} · ${t('examControl.present')} ${e.present}`}</Text>
            <View className="flex-row items-center gap-2">
              <Input
                className="flex-1"
                placeholder={t('examControl.bookletCount')}
                keyboardType="number-pad"
                value={draft ?? (e.booklet_count === null ? '' : String(e.booklet_count))}
                onChangeText={(v) => setCounts((c) => ({ ...c, [e.committee_id]: v.replace(/\D/g, '') }))}
              />
              {draft !== undefined ? (
                <Button size="sm" onPress={() => submit(e.committee_id, draft === '' ? null : Number(draft), e.sealed)} disabled={save.running}>
                  <Text>{t('examControl.save')}</Text>
                </Button>
              ) : null}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm">{t('examControl.sealed')}</Text>
              <Switch checked={e.sealed} disabled={e.booklet_count === null} onCheckedChange={(v) => submit(e.committee_id, e.booklet_count, v)} />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={() => print('minutes_seal', { committeeId: e.committee_id, dayId })}>
                <Text>{t('examControl.sealMinutes')}</Text>
              </Button>
              {e.match === false ? (
                <Button variant="outline" size="sm" onPress={() => print('minutes_absence', { committeeId: e.committee_id, dayId })}>
                  <Text>{t('examControl.absenceMinutes')}</Text>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onPress={() => print('minutes_incident', { committeeId: e.committee_id, dayId })}>
                <Text>{t('examControl.minutes')}</Text>
              </Button>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Envelope receipt by scan (C7.4 #2): scan every booklet; received / missing / duplicate / misplaced; then seal. */
function EnvelopeReceipt({ id, dayId, camera }: { id: string; dayId: string; camera: boolean }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const scanError = useScanError();
  const list = useApi(['jc', 'envelopes', id, dayId] as const, ([, , s, day]) => jahbadhControl.envelopes(s, day));
  const [committee, setCommittee] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<string[]>([]);
  const [check, setCheck] = useState<JcEnvelopeCheck | null>(null);
  const seal = useAction(jahbadhControl.saveEnvelope, { success: t('examControl.envelopeSealed') });
  const cid = committee ?? list.data?.[0]?.committee_id ?? null;

  const onScan = async (digits: string) => {
    if (!cid) return { ok: false, message: t('examControl.pickCommittee') };
    const next = [...payloads, digits];
    const res = await jahbadhControl.envelopeCheck(id, dayId, cid, next);
    if (!res.success || !res.data) return { ok: false, message: scanError(res.code, res.error) };
    const r = res.data;
    const bad = r.invalid.find((x) => x.index === next.length - 1);
    if (bad) return { ok: false, message: scanError(bad.reason) };
    setPayloads(next);
    setCheck(r);
    const secret = Number(digits.slice(6, 13));
    if (r.duplicates.includes(secret) && payloads.some((p) => Number(p.slice(6, 13)) === secret)) return { ok: false, message: t('examControl.env_duplicate_one', { secret }) };
    const wrong = r.wrongCommittee.find((x) => x.secret === secret);
    if (wrong) return { ok: false, message: t('examControl.env_wrong_one', { secret, committee: wrong.committee ?? '—' }) };
    if (r.absent.includes(secret)) return { ok: false, message: t('examControl.env_absent_one', { secret }) };
    if (r.notToday.includes(secret)) return { ok: false, message: t('examControl.env_notToday_one', { secret }) };
    if (r.unknown.includes(secret)) return { ok: false, message: t('examControl.scanErr_unknown_secret') };
    return { ok: true, message: t('examControl.env_ok_one', { secret, n: r.received.length, expected: r.expected }) };
  };
  const doSeal = async () => {
    if (!cid || !check) return;
    if (check.missing.length && !(await confirm({ title: t('examControl.sealEnvelope'), body: t('examControl.confirmSealMissing', { n: check.missing.length }) }))) return;
    const res = await seal.run(id, dayId, { committee_id: cid, booklet_count: check.received.length, sealed: true, scanned: check.received });
    if (res.ok) {
      list.mutate(res.data, { revalidate: false });
      setPayloads([]);
      setCheck(null);
    }
  };
  const clear = async () => {
    if (await confirm({ title: t('examControl.clearScans'), body: t('examControl.confirmClearScans') })) {
      setPayloads([]);
      setCheck(null);
    }
  };
  if (!list.data) return <LoadingList rows={3} />;
  if (!list.data.length || !cid) return <Note text={t('examControl.noStudentsToday')} />;
  const current = list.data.find((c) => c.committee_id === cid);
  const group = (label: string, items: (string | number)[], tone: string) =>
    items.length ? (
      <View className="gap-1">
        <Text className={`text-sm font-semibold ${tone}`}>{`${label} (${items.length})`}</Text>
        <Text className="font-mono text-xs">{items.join('  ')}</Text>
      </View>
    ) : null;
  return (
    <View className="gap-3">
      <Picker
        value={cid}
        onChange={(v) => {
          setCommittee(v);
          setPayloads([]);
          setCheck(null);
        }}
        options={list.data.map((c) => ({ value: c.committee_id, label: c.committee_name }))}
      />
      {current?.sealed ? (
        <View className="flex-row items-center gap-1">
          <Icon as={Lock} className="text-success size-4" />
          <Text className="text-success text-sm">{`${t('examControl.sealed')} · ${current.booklet_count ?? ''}`}</Text>
        </View>
      ) : null}
      <Note text={t('examControl.envelopeReceiptHint')} />
      <ScanField expect="booklet" camera={camera} onScan={onScan} />
      {check ? (
        <FormSection title={t('examControl.envelopeReceipt')}>
          <View className="flex-row flex-wrap gap-2">
            <MiniTile label={t('examControl.env_received')} value={`${check.received.length}/${check.expected}`} tone={check.received.length === check.expected ? 'success' : 'warning'} />
            <MiniTile label={t('examControl.env_missing')} value={check.missing.length} tone={check.missing.length ? 'destructive' : 'muted'} />
            <MiniTile label={t('examControl.env_duplicates')} value={check.duplicates.length} tone={check.duplicates.length ? 'warning' : 'muted'} />
          </View>
          {group(`✔ ${t('examControl.env_received')}`, check.received, 'text-success')}
          {group(`✖ ${t('examControl.env_missing')}`, check.missing, 'text-destructive')}
          {group(`⚠ ${t('examControl.env_duplicates')}`, check.duplicates, 'text-warning')}
          {group(`⚠ ${t('examControl.env_wrong')}`, check.wrongCommittee.map((x) => `${x.secret}→${x.committee ?? '—'}`), 'text-destructive')}
          {group(`⚠ ${t('examControl.env_absent')}`, check.absent, 'text-destructive')}
          {group(`⚠ ${t('examControl.env_notToday')}`, check.notToday, 'text-destructive')}
          {group(`⚠ ${t('examControl.env_unknown')}`, check.unknown, 'text-destructive')}
          <Button onPress={doSeal} disabled={!check.received.length || seal.running}>
            <Text>{t('examControl.sealEnvelope')}</Text>
          </Button>
          <Button variant="outline" onPress={clear}>
            <Text>{t('examControl.clearScans')}</Text>
          </Button>
        </FormSection>
      ) : null}
    </View>
  );
}

/** Timer minutes attached to this exam day by the room timers. */
function TimerMinutes({ id, dayId }: { id: string; dayId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const list = useApi(['jc', 'timer-minutes', id, dayId] as const, ([, , s, day]) => jahbadhControl.timerMinutes(s, day));
  if (!list.data) return <LoadingList rows={2} />;
  if (!list.data.length) return <Note text={t('examControl.noTimerMinutes')} />;
  return (
    <View className="gap-3">
      {list.data.map((m) => (
        <View key={m.id} className="bg-card border-border gap-2 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm font-semibold">{`${m.committee_name ?? t('examControl.allCommittees')} · ${new Date(m.created_at).toLocaleString(locale)}`}</Text>
            <Pressable
              onPress={() => Clipboard.setStringAsync(m.text).then(() => toast.success(t('examControl.copy')))}
              accessibilityRole="button"
              accessibilityLabel={t('examControl.copy')}
              className="p-1">
              <Icon as={Copy} className="text-foreground size-4" />
            </Pressable>
          </View>
          <Text className="text-xs leading-5">{m.text}</Text>
        </View>
      ))}
    </View>
  );
}
