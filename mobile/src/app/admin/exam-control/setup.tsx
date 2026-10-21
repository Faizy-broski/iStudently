import type { JcOverview, JcRole, JcSettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { KeyRound, Plus, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { JcError, Note, useOverview, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const NONE = '__none__';

type Field =
  | { key: keyof JcSettings; kind: 'select'; options: string[] }
  | { key: keyof JcSettings; kind: 'number' }
  | { key: keyof JcSettings; kind: 'percent' }
  | { key: keyof JcSettings; kind: 'switch' }
  | { key: keyof JcSettings; kind: 'text' | 'textarea' };

const GROUPS: { key: string; fields: Field[] }[] = [
  {
    key: 'numbering',
    fields: [
      { key: 'secret_mode', kind: 'select', options: ['random', 'encrypted', 'simple'] },
      { key: 'order', kind: 'select', options: ['alphabetical', 'entry'] },
      { key: 'number_multiplier', kind: 'number' },
      { key: 'number_start', kind: 'number' },
      { key: 'number_prefix', kind: 'number' },
      { key: 'simple_add', kind: 'number' },
    ],
  },
  {
    key: 'seating',
    fields: [
      { key: 'distribution', kind: 'select', options: ['mixed', 'sequential'] },
      { key: 'paper_models', kind: 'switch' },
      { key: 'special_last', kind: 'switch' },
      { key: 'max_list', kind: 'number' },
      { key: 'q_count', kind: 'number' },
    ],
  },
  { key: 'invigilation', fields: [{ key: 'obs_per_committee', kind: 'number' }, { key: 'reserve_per_day', kind: 'number' }, { key: 'chief_name', kind: 'text' }] },
  {
    key: 'grading',
    fields: [
      { key: 'double_entry', kind: 'switch' },
      { key: 'exam_pass', kind: 'percent' },
      { key: 'weak_rate', kind: 'percent' },
      { key: 'audit_percent', kind: 'number' },
      { key: 'audit_seed', kind: 'text' },
      { key: 'top_n', kind: 'number' },
    ],
  },
  {
    key: 'qr',
    fields: [
      { key: 'qr_enabled', kind: 'switch' },
      { key: 'qr_on_covers', kind: 'switch' },
      { key: 'qr_on_stubs', kind: 'switch' },
      { key: 'qr_on_cards', kind: 'switch' },
      { key: 'qr_size_mm', kind: 'number' },
      { key: 'camera_scanning', kind: 'switch' },
    ],
  },
  { key: 'messages', fields: [{ key: 'message_template', kind: 'textarea' }] },
];

/** Session setup (web: exam control › Setup): details, grades, settings, encryption key, members. */
export default function ExamControlSetup() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  const r = o.rights;
  const refresh = () => void ov.mutate();
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_setup') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        {r.manage ? <Details id={id} o={o} refresh={refresh} /> : null}
        {r.manage ? <Grades id={id} o={o} refresh={refresh} /> : null}
        {r.manage ? <Settings id={id} o={o} refresh={refresh} /> : null}
        {(r.secret || r.chief) && o.session.settings.secret_mode === 'encrypted' ? <KeyForm id={id} o={o} refresh={refresh} /> : null}
        {r.chief ? <Members id={id} /> : null}
        {!r.manage && !(r.secret && o.session.settings.secret_mode === 'encrypted') ? <Note text={t('examControl.nothingToSetUp')} /> : null}
      </ScrollView>
    </>
  );
}

type P = { id: string; o: JcOverview; refresh: () => void };

function Details({ id, o, refresh }: P) {
  const { t } = useTranslation();
  const [name, setName] = useState(o.session.name);
  const [stage, setStage] = useState(String(o.session.stage) as '1' | '2' | '3');
  const [date, setDate] = useState(o.session.issue_date);
  const save = useAction(jahbadhControl.updateSession, { success: t('examControl.saved'), onSuccess: refresh });
  const confirm = useConfirm();
  const regen = useAction(jahbadhControl.regenerateCode, { success: t('examControl.codeRegenerated'), onSuccess: refresh });
  const regenerate = async () => {
    if (await confirm({ title: t('examControl.regenerateCode'), body: t('examControl.confirmRegenerateCode'), destructive: true })) regen.run(id);
  };
  return (
    <FormSection title={t('examControl.details')}>
      <View className="gap-1.5">
        <Label>{t('examControl.sessionName')}</Label>
        <Input value={name} onChangeText={setName} />
      </View>
      <Segmented value={stage} onChange={setStage} options={(['1', '2', '3'] as const).map((n) => ({ value: n, label: t('examControl.stageN', { n }) }))} />
      <DateField label={t('examControl.issueDate')} value={date} onChange={setDate} />
      <Button onPress={() => save.run(id, { name, stage: Number(stage), issue_date: date })} disabled={save.running}>
        <Text>{t('examControl.save')}</Text>
      </Button>
      {o.rights.chief ? (
        <View className="border-border gap-2 border-t pt-3">
          <Text className="text-sm">{`${t('examControl.sessionCode')}: ${o.session.session_code}`}</Text>
          <Button variant="outline" onPress={regenerate} disabled={regen.running}>
            <Text>{t('examControl.regenerateCode')}</Text>
          </Button>
          <Text variant="muted" className="text-[11px]">
            {t('examControl.regenerateCodeHint')}
          </Text>
        </View>
      ) : null}
    </FormSection>
  );
}

function Grades({ id, o, refresh }: P) {
  const { t } = useTranslation();
  const choices = useApi(['jc', 'grade-choices', id] as const, ([, , s]) => jahbadhControl.gradeChoices(s));
  const [picked, setPicked] = useState<string[]>(() => o.grades.map((g) => g.grade_level_id));
  const [codes, setCodes] = useState<Record<string, string>>(() => Object.fromEntries(o.grades.map((g) => [g.grade_level_id, String(g.number_code)])));
  const locked = !!o.session.committees_locked_at;
  const save = useAction(jahbadhControl.setGrades, { success: t('examControl.saved'), onSuccess: refresh });
  const submit = () =>
    save.run(
      id,
      picked,
      picked.filter((g) => codes[g]).map((g) => ({ grade_level_id: g, number_code: Number(codes[g]) })),
    );
  return (
    <FormSection title={t('examControl.gradesInSession')} description={t('examControl.gradesHint')}>
      {choices.isLoading ? <LoadingList rows={2} /> : null}
      {choices.data && !choices.data.length ? <Note tone="warning" text={t('examControl.noGradeChoices')} /> : null}
      {choices.data?.map((g) => {
        const on = picked.includes(g.grade_level_id);
        const mapped = g.grade_code !== null;
        return (
          <View key={g.grade_level_id} className="flex-row items-center gap-3">
            <Checkbox
              checked={on}
              disabled={!mapped || locked}
              onCheckedChange={(v) => setPicked((p) => (v ? [...p, g.grade_level_id] : p.filter((x) => x !== g.grade_level_id)))}
            />
            <View className="flex-1">
              <Text className="text-sm">{g.name}</Text>
              {!mapped ? <Text className="text-warning text-[11px]">{t('examControl.gradeNotMapped')}</Text> : null}
            </View>
            {on ? (
              <Input
                className="w-20"
                keyboardType="number-pad"
                placeholder={t('examControl.numberCode')}
                value={codes[g.grade_level_id] ?? ''}
                editable={!locked}
                onChangeText={(v) => setCodes((c) => ({ ...c, [g.grade_level_id]: v.replace(/\D/g, '') }))}
              />
            ) : null}
          </View>
        );
      })}
      {locked ? (
        <Note tone="warning" text={t('examControl.lockedNote')} />
      ) : (
        <Button onPress={submit} disabled={!picked.length || save.running}>
          <Text>{t('examControl.saveGrades')}</Text>
        </Button>
      )}
    </FormSection>
  );
}

function Settings({ id, o, refresh }: P) {
  const { t } = useTranslation();
  const [s, setS] = useState<JcSettings>(o.session.settings);
  const set = (k: keyof JcSettings, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const save = useAction(jahbadhControl.updateSession, { success: t('examControl.saved'), onSuccess: refresh });
  const submit = () => {
    // show_names is switched on the unmasking screen (chief only).
    const rest: Partial<JcSettings> = { ...s };
    delete rest.show_names;
    save.run(id, { settings: rest });
  };
  const field = (f: Field) => {
    const label = t(`examControl.set_${f.key}`);
    const v = s[f.key];
    if (f.kind === 'switch')
      return (
        <View key={f.key} className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm">{label}</Text>
          <Switch checked={!!v} onCheckedChange={(x) => set(f.key, x)} />
        </View>
      );
    if (f.kind === 'select')
      return (
        <View key={f.key} className="gap-1.5">
          <Label>{label}</Label>
          <Picker value={String(v)} onChange={(x) => set(f.key, x)} options={f.options.map((x) => ({ value: x, label: t(`examControl.opt_${f.key}_${x}`) }))} />
        </View>
      );
    if (f.kind === 'textarea')
      return (
        <View key={f.key} className="gap-1.5">
          <Label>{label}</Label>
          <Textarea value={String(v ?? '')} onChangeText={(x) => set(f.key, x)} />
          <Text variant="muted" className="text-[11px]">
            {t('examControl.templateHint')}
          </Text>
        </View>
      );
    return (
      <View key={f.key} className="gap-1.5">
        <Label>{label}</Label>
        <Input
          value={f.kind === 'percent' ? String(Math.round(Number(v) * 100)) : String(v ?? '')}
          keyboardType={f.kind === 'text' ? 'default' : 'number-pad'}
          onChangeText={(x) => set(f.key, f.kind === 'text' ? x : f.kind === 'percent' ? Number(x || 0) / 100 : Number(x || 0))}
        />
      </View>
    );
  };
  return (
    <FormSection title={t('examControl.settings')} description={t('examControl.settingsHint')}>
      {GROUPS.map((g) => (
        <View key={g.key} className="gap-3">
          <Text variant="muted" className="text-xs font-semibold">
            {t(`examControl.group_${g.key}`)}
          </Text>
          {g.fields.map(field)}
        </View>
      ))}
      <Button onPress={submit} disabled={save.running}>
        <Text>{t('examControl.saveSettings')}</Text>
      </Button>
    </FormSection>
  );
}

function KeyForm({ id, o, refresh }: P) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [offset, setOffset] = useState('');
  const valid = /^\d+$/.test(key) && Number(key) % 2 === 1 && !key.endsWith('5') && /^\d+$/.test(offset);
  const save = useAction(jahbadhControl.setKey, { success: t('examControl.keySaved') });
  const submit = async () => {
    if ((await save.run(id, Number(key), Number(offset))).ok) {
      setKey('');
      setOffset('');
      refresh();
    }
  };
  return (
    <FormSection title={t('examControl.encryptionKey')} description={t('examControl.encryptionKeyHint')} icon={KeyRound}>
      <Note tone={o.key_set ? 'success' : 'warning'} text={o.key_set ? t('examControl.keySet') : t('examControl.keyNotSet')} />
      <View className="gap-1.5">
        <Label>KEY</Label>
        <Input value={key} onChangeText={(v) => setKey(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry autoComplete="off" />
      </View>
      <View className="gap-1.5">
        <Label>OFFSET</Label>
        <Input value={offset} onChangeText={(v) => setOffset(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry autoComplete="off" />
      </View>
      {key && !valid ? <Text className="text-destructive text-xs">{t('examControl.keyRule')}</Text> : null}
      <Button onPress={submit} disabled={!valid || save.running || !!o.session.committees_locked_at}>
        <Text>{t('examControl.save')}</Text>
      </Button>
    </FormSection>
  );
}

const ROLES: JcRole[] = ['control', 'entry', 'invigilator', 'secret'];

function Members({ id }: { id: string }) {
  const { t } = useTranslation();
  const members = useApi(['jc', 'members', id] as const, ([, , s]) => jahbadhControl.members(s));
  const staff = useApi(['jc', 'staff', id] as const, ([, , s]) => jahbadhControl.staff(s));
  const [rows, setRows] = useState<{ profile_id: string; role: JcRole }[] | null>(null);
  const list = rows ?? members.data?.map((m) => ({ profile_id: m.profile_id, role: m.role })) ?? [];
  const people = (staff.data ?? []).filter((p) => p.profile_id).map((p) => ({ value: p.profile_id, label: p.name }));
  const save = useAction(jahbadhControl.setMembers, { success: t('examControl.saved') });
  const submit = async () => {
    if ((await save.run(id, list.filter((x) => x.profile_id))).ok) {
      setRows(null);
      members.mutate();
    }
  };
  return (
    <FormSection title={t('examControl.members')} description={t('examControl.membersHint')} icon={Users}>
      {members.isLoading || staff.isLoading ? <LoadingList rows={2} /> : null}
      {list.map((m, i) => (
        <View key={i} className="gap-2 border-border border-b pb-3">
          <Picker
            value={m.profile_id || NONE}
            placeholder={t('examControl.pickPerson')}
            onChange={(v) => setRows(list.map((x, j) => (j === i ? { ...x, profile_id: v === NONE ? '' : v } : x)))}
            options={[{ value: NONE, label: t('examControl.pickPerson') }, ...people]}
          />
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Picker value={m.role} onChange={(v) => setRows(list.map((x, j) => (j === i ? { ...x, role: v as JcRole } : x)))} options={ROLES.map((r) => ({ value: r, label: t(`examControl.role_${r}`) }))} />
            </View>
            <Pressable onPress={() => setRows(list.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('examControl.remove')} className="p-2">
              <Icon as={Trash2} className="text-destructive size-5" />
            </Pressable>
          </View>
        </View>
      ))}
      <Button variant="outline" onPress={() => setRows([...list, { profile_id: '', role: 'entry' }])}>
        <Icon as={Plus} className="text-foreground size-4" />
        <Text>{t('examControl.addMember')}</Text>
      </Button>
      <Button onPress={submit} disabled={!rows || save.running}>
        <Text>{t('examControl.save')}</Text>
      </Button>
      <Text variant="muted" className="text-[11px]">
        {t('examControl.rolesHelp')}
      </Text>
    </FormSection>
  );
}
