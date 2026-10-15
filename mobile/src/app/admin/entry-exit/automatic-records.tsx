import type { AutomaticRecord, AutomaticRecordException, PersonType, RecordType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Save, ShieldCheck, Trash2, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { PersonPicker, useCheckpoints, type PickedPerson } from '@/features/admin/entry-exit';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEYS: Record<number, string> = { 1: 'day_monday', 2: 'day_tuesday', 3: 'day_wednesday', 4: 'day_thursday', 5: 'day_friday', 6: 'day_saturday', 0: 'day_sunday' };
const NONE = '__none__';

interface RuleRow {
  uid: string;
  existingIds: Record<number, string>;
  checkpoint_id: string;
  record_type: RecordType;
  days: Set<number>;
  scheduled_time: string;
  user_profiles: string;
  grade_levels: string;
  is_active: boolean;
  isDirty: boolean;
}

const groupKey = (r: AutomaticRecord) => `${r.checkpoint_id}|${r.record_type}|${r.scheduled_time}|${r.target_type}|${r.target_value ?? ''}`;

function toRows(rules: AutomaticRecord[]): RuleRow[] {
  const map = new Map<string, RuleRow>();
  for (const r of rules) {
    const k = groupKey(r);
    const row = map.get(k);
    if (row) {
      row.days.add(r.day_of_week);
      row.existingIds[r.day_of_week] = r.id;
    } else {
      map.set(k, {
        uid: `loaded-${r.id}`,
        existingIds: { [r.day_of_week]: r.id },
        checkpoint_id: r.checkpoint_id,
        record_type: r.record_type,
        days: new Set([r.day_of_week]),
        scheduled_time: r.scheduled_time?.slice(0, 5) ?? '',
        user_profiles: r.target_type === 'staff_profile' ? (r.target_value ?? '') : '',
        grade_levels: r.target_type === 'grade_level' ? (r.target_value ?? '') : '',
        is_active: r.is_active,
        isDirty: false,
      });
    }
  }
  return [...map.values()];
}

let uidSeq = 0;
const emptyRow = (cp = ''): RuleRow => ({ uid: `new-${++uidSeq}`, existingIds: {}, checkpoint_id: cp, record_type: 'ENTRY', days: new Set([1, 2, 3, 4, 5]), scheduled_time: '', user_profiles: '', grade_levels: '', is_active: true, isDirty: true });

function ExceptionsPanel({ ruleId, schoolId, userName }: { ruleId: string | undefined; schoolId: string; userName: string }) {
  const { t } = useTranslation();
  const a = (k: string) => t(`school.entry_exit.automatic_records.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const list = useApi(ruleId ? ['admin', 'ee-rule-exceptions', ruleId] : null, ([, , id]) => adminEntryExit.ruleExceptions(id as string));
  const [adding, setAdding] = useState(false);
  const [personType, setPersonType] = useState<PersonType>('STUDENT');
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!ruleId) return <Text className="text-muted-foreground p-3 text-xs italic">{a('msg_save_first_exceptions')}</Text>;
  const rid = ruleId;

  async function add() {
    if (!person || !from || !to) return toast.error(t('common.fill_required_fields'));
    setSaving(true);
    try {
      const res = await adminEntryExit.createRuleException({ school_id: schoolId, automatic_record_id: rid, person_id: person.id, person_type: personType, from_date: from, to_date: to, reason, created_by: userName });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      setAdding(false);
      setPerson(null);
      setFrom('');
      setTo('');
      setReason('');
      toast.success(a('msg_success_added_exception'));
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function remove(ex: AutomaticRecordException) {
    if (!(await confirm({ title: a('dialog_remove_exception_desc'), destructive: true, confirmLabel: a('btn_remove') }))) return;
    const res = await adminEntryExit.deleteRuleException(rid, ex.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(a('msg_success_deleted_exception'));
    list.mutate();
  }

  return (
    <View className="bg-muted/30 gap-3 rounded-md p-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Icon as={ShieldCheck} className="text-muted-foreground size-3.5" />
          <Text className="text-muted-foreground text-sm font-medium">{a('exceptions_panel_title')}</Text>
        </View>
        <Button size="sm" variant="outline" onPress={() => setAdding((v) => !v)}>
          <Icon as={Plus} className="text-foreground size-3" />
          <Text className="text-xs">{a('btn_add_exception')}</Text>
        </Button>
      </View>
      {adding ? (
        <View className="gap-2">
          <Picker
            value={personType}
            onChange={(v) => {
              setPersonType(v as PersonType);
              setPerson(null);
            }}
            options={[
              { value: 'STUDENT', label: a('option_student') },
              { value: 'STAFF', label: a('option_staff') },
            ]}
          />
          <PersonPicker type={personType} value={person} onChange={setPerson} />
          <View className="flex-row gap-2">
            <DateField className="flex-1" value={from} onChange={setFrom} placeholder={a('label_from')} />
            <DateField className="flex-1" value={to} onChange={setTo} min={from || undefined} placeholder={a('label_to')} />
          </View>
          <Input value={reason} onChangeText={setReason} placeholder={a('placeholder_reason')} />
          <Button size="sm" onPress={add} disabled={saving}>
            <Text>{a('btn_save_exception')}</Text>
          </Button>
        </View>
      ) : null}
      {list.isLoading ? (
        <Text className="text-muted-foreground text-xs">{a('msg_loading_exceptions')}</Text>
      ) : !(list.data ?? []).length ? (
        <Text className="text-muted-foreground text-xs italic">{a('msg_no_exceptions')}</Text>
      ) : (
        (list.data ?? []).map((ex) => (
          <View key={ex.id} className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-sm font-medium">{ex.person_name || `${ex.person_id.slice(0, 12)}…`}</Text>
              <Text className="text-muted-foreground text-xs">{`${ex.from_date} → ${ex.to_date}${ex.reason ? ` · ${ex.reason}` : ''}`}</Text>
            </View>
            <Pressable onPress={() => remove(ex)} hitSlop={8}>
              <Icon as={Trash2} className="text-muted-foreground size-3.5" />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

/** Scheduled automatic entry/exit rules with per-rule exceptions (web: /admin/entry-exit/automatic-records). */
export default function AutomaticRecords() {
  const { t } = useTranslation();
  const a = (k: string) => t(`school.entry_exit.automatic_records.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { schoolId } = useAttendanceScope();
  const { me } = useSession();
  const userName = me.status === 'ready' ? [me.me.profile.first_name, me.me.profile.last_name].filter(Boolean).join(' ') : '';
  const { campusId } = useCampus();
  const checkpoints = useCheckpoints(schoolId);
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const rules = useApi(schoolId ? ['admin', 'ee-rules', schoolId] : null, () => adminEntryExit.automaticRecords(schoolId));
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rules.data) setRows(toRows(rules.data));
  }, [rules.data]);

  const update = (uid: string, patch: Partial<RuleRow>) => setRows((p) => p.map((r) => (r.uid === uid ? { ...r, ...patch, isDirty: true } : r)));
  const toggleDay = (uid: string, d: number) =>
    setRows((p) =>
      p.map((r) => {
        if (r.uid !== uid) return r;
        const days = new Set(r.days);
        if (days.has(d)) days.delete(d);
        else days.add(d);
        return { ...r, days, isDirty: true };
      }),
    );
  const addRow = () => setRows((p) => [...p, emptyRow(checkpoints.data?.[0]?.id ?? '')]);

  async function remove(row: RuleRow) {
    if (!(await confirm({ title: a('dialog_delete_title'), body: a('dialog_delete_desc'), confirmLabel: a('btn_confirm_delete'), destructive: true }))) return;
    const ids = Object.values(row.existingIds);
    const results = await Promise.all(ids.map((id) => adminEntryExit.deleteAutomaticRecord(id)));
    const failed = results.find((x) => !x.success);
    if (failed) return toast.error(failed.error || a('msg_error_delete'));
    setRows((p) => p.filter((r) => r.uid !== row.uid));
    toast.success(a('msg_success_deleted'));
  }

  async function save() {
    const dirty = rows.filter((r) => r.isDirty);
    if (!dirty.length) return toast.info(a('msg_no_changes'));
    for (const r of dirty) {
      if (!r.checkpoint_id) return toast.error(a('msg_error_checkpoint'));
      if (!r.scheduled_time) return toast.error(a('msg_error_time'));
      if (!r.days.size) return toast.error(a('msg_error_days'));
    }
    setSaving(true);
    try {
      const next = rows.map((r) => ({ ...r, existingIds: { ...r.existingIds } }));
      for (const row of next.filter((r) => r.isDirty)) {
        const target_type = row.grade_levels ? 'grade_level' : row.user_profiles ? 'staff_profile' : 'all_students';
        const target_value = row.grade_levels || row.user_profiles || null;
        for (const day of Object.keys(row.existingIds).map(Number)) {
          if (!row.days.has(day)) {
            const res = await adminEntryExit.deleteAutomaticRecord(row.existingIds[day]);
            if (!res.success) throw new Error(res.error);
            delete row.existingIds[day];
          }
        }
        for (const day of row.days) {
          const body = { checkpoint_id: row.checkpoint_id, record_type: row.record_type, day_of_week: day, scheduled_time: row.scheduled_time, target_type, target_value, is_active: row.is_active };
          const existingId = row.existingIds[day];
          const res = existingId ? await adminEntryExit.updateAutomaticRecord(existingId, body) : await adminEntryExit.createAutomaticRecord({ ...body, school_id: schoolId, created_by: userName });
          if (!res.success || !res.data) throw new Error(res.error);
          row.existingIds[day] = res.data.id;
        }
        row.isDirty = false;
      }
      setRows(next);
      toast.success(a('msg_save_success'));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : a('msg_error_save'));
    } finally {
      setSaving(false);
    }
  }

  const visible = filter === 'all' ? rows : rows.filter((r) => r.checkpoint_id === filter);
  const dirtyCount = rows.filter((r) => r.isDirty).length;

  return (
    <>
      <Stack.Screen options={{ title: a('page_title') }} />
      <View className="bg-background flex-1">
        {rules.isLoading && !rows.length ? (
          <LoadingList />
        ) : (
          <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
            <Text variant="muted">{a('page_subtitle')}</Text>
            <View className="flex-row items-end gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{a('label_checkpoint_filter')}</Label>
                <Picker value={filter} onChange={setFilter} options={[{ value: 'all', label: t('common.all') }, ...(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              </View>
              <Button variant="outline" onPress={addRow}>
                <Icon as={Plus} className="text-foreground size-4" />
                <Text>{a('btn_add_rule')}</Text>
              </Button>
            </View>
            {!visible.length ? (
              <View className="items-center gap-3 py-10">
                <Text className="text-muted-foreground font-medium">{a('msg_no_data')}</Text>
                <Button size="sm" variant="outline" onPress={addRow}>
                  <Icon as={Plus} className="text-foreground size-3.5" />
                  <Text>{a('btn_add_first_rule')}</Text>
                </Button>
              </View>
            ) : (
              visible.map((row) => (
                <Card key={row.uid}>
                  <CardContent className="gap-3 pt-4">
                    <View className="flex-row items-center justify-between">
                      {row.isDirty ? (
                        <Badge variant="outline" className="border-amber-400">
                          <Text className="text-[10px] text-amber-600">{a('badge_unsaved')}</Text>
                        </Badge>
                      ) : (
                        <View />
                      )}
                      <View className="flex-row gap-4">
                        <Pressable onPress={() => setExpanded(expanded === row.uid ? null : row.uid)} hitSlop={8} accessibilityLabel={a('tooltip_exceptions')} className={cn('rounded border p-1', expanded === row.uid ? 'border-blue-400 bg-blue-100' : 'border-border')}>
                          <Icon as={Users} className={cn('size-4', expanded === row.uid ? 'text-blue-700' : 'text-muted-foreground')} />
                        </Pressable>
                        <Pressable onPress={() => remove(row)} hitSlop={8} className="p-1">
                          <Icon as={Trash2} className="text-destructive size-4" />
                        </Pressable>
                      </View>
                    </View>
                    <View className="gap-1.5">
                      <Label>{a('table_header_checkpoint')}</Label>
                      <View className="flex-row gap-2">
                        <Picker className="flex-1" value={row.checkpoint_id} onChange={(v) => update(row.uid, { checkpoint_id: v })} placeholder={a('placeholder_na')} options={(checkpoints.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                        <Picker
                          className="w-28"
                          value={row.record_type}
                          onChange={(v) => update(row.uid, { record_type: v as RecordType })}
                          options={[
                            { value: 'ENTRY', label: a('type_entry') },
                            { value: 'EXIT', label: a('type_exit') },
                          ]}
                        />
                      </View>
                    </View>
                    <View className="gap-1">
                      <Label>{a('table_header_days')}</Label>
                      <View className="flex-row flex-wrap gap-x-3">
                        {DAY_ORDER.map((d) => (
                          <CheckRow key={d} checked={row.days.has(d)} onPress={() => toggleDay(row.uid, d)} label={a(DAY_KEYS[d])} />
                        ))}
                      </View>
                    </View>
                    <TimeField label={a('table_header_time')} value={row.scheduled_time || '07:00'} onChange={(v) => update(row.uid, { scheduled_time: v })} />
                    <View className="gap-1.5">
                      <Label>{a('table_header_limit_to')}</Label>
                      <Input value={row.user_profiles} onChangeText={(v) => update(row.uid, { user_profiles: v, grade_levels: '' })} placeholder={a('placeholder_user_profile')} />
                      <Text className="text-muted-foreground text-[10px]">{a('label_user_profiles')}</Text>
                      <Picker
                        value={row.grade_levels || NONE}
                        onChange={(v) => update(row.uid, { grade_levels: v === NONE ? '' : v, user_profiles: '' })}
                        options={[{ value: NONE, label: a('option_none') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
                      />
                      <Text className="text-muted-foreground text-[10px]">{a('label_grade_levels')}</Text>
                    </View>
                    {expanded === row.uid ? <ExceptionsPanel ruleId={Object.values(row.existingIds)[0]} schoolId={schoolId} userName={userName} /> : null}
                  </CardContent>
                </Card>
              ))
            )}
            {visible.length ? (
              <Button variant="ghost" className="self-start" onPress={addRow}>
                <Icon as={Plus} className="text-primary size-3.5" />
                <Text className="text-primary">{a('btn_add_another')}</Text>
              </Button>
            ) : null}
          </ScrollView>
        )}
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={save} disabled={saving || !dirtyCount}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{`${a('btn_save')}${dirtyCount ? ` (${dirtyCount})` : ''}`}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
