import type { JcExport, JcOverview, JcResults } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { MessageCircle, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { JcError, MiniTile, Note, PrintButton, pct, useJcBase, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Pane = 'results' | 'honor' | 'second' | 'messages' | 'export';

/** Results after unmasking (web: exam control › Results). */
export default function ExamControlResults() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const res = useApi(id ? (['jc', 'results', id] as const) : null, ([, , s]) => jahbadhControl.results(s));
  const [pane, setPane] = useState<Pane>('results');
  const print = usePrintDoc(id);
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  const panes: { value: Pane; label: string }[] = [
    { value: 'results', label: t('examControl.results') },
    { value: 'honor', label: t('examControl.honorBoard') },
    { value: 'second', label: t('examControl.secondRound') },
    ...(o.rights.manage ? [{ value: 'messages' as Pane, label: t('examControl.messages') }] : []),
    ...(o.rights.chief ? [{ value: 'export' as Pane, label: t('examControl.exportToGrades') }] : []),
  ];
  const r = res.data;
  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.tab_results'),
          headerRight: () => <PrintButton label={t('examControl.print')} onPress={() => print(pane === 'honor' ? 'honor_board' : 'results')} />,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <FilterChips value={pane} onChange={setPane} options={panes} />
        {res.error && pane !== 'export' ? (
          <Note tone="warning" text={res.error.message} />
        ) : !r && pane !== 'export' ? (
          <LoadingList rows={4} />
        ) : pane === 'results' ? (
          <Sheet o={o} r={r!} />
        ) : pane === 'honor' ? (
          <Honor o={o} r={r!} onCertificates={() => print('certificates')} />
        ) : pane === 'second' ? (
          <Second id={id} o={o} r={r!} refresh={() => ov.mutate()} />
        ) : pane === 'messages' ? (
          <Messages id={id} o={o} />
        ) : (
          <Export id={id} />
        )}
      </ScrollView>
    </>
  );
}

function Sheet({ o, r }: { o: JcOverview; r: JcResults }) {
  const { t } = useTranslation();
  const [gradePick, setGrade] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const g = r.grades.find((x) => x.grade_level_id === gradePick) ?? r.grades[0];
  if (!g) return <Note text={t('examControl.noGradesYet')} />;
  const pass = o.session.settings.exam_pass;
  const rows = r.students
    .filter((s) => s.grade_level_id === g.grade_level_id && (!search || s.name.includes(search) || String(s.seat_number).includes(search)))
    .sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0));
  return (
    <View className="gap-3">
      <Picker value={g.grade_level_id} onChange={setGrade} options={r.grades.map((x) => ({ value: x.grade_level_id, label: x.name }))} />
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('examControl.searchStudent')} />
      {rows.map((s) => (
        <View key={s.id} className="bg-card border-border gap-1.5 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="w-16 text-sm font-semibold">{String(s.seat_number ?? '')}</Text>
            <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
              {s.name}
            </Text>
            <Text className="text-sm font-bold">{pct(s.pct)}</Text>
          </View>
          <View className="flex-row flex-wrap gap-x-3 gap-y-1">
            {g.subjects.map((sub) => {
              const v = s.scores[sub.key];
              const low = !!v && (v.absent || (v.score !== null && v.score / sub.max + 1e-9 < pass));
              return <Text key={sub.key} className={`text-[11px] ${low ? 'text-destructive' : 'text-muted-foreground'}`}>{`${sub.name} ${!v ? '—' : v.absent ? 'غ' : Number(v.score)}/${sub.max}`}</Text>;
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Honor({ o, r, onCertificates }: { o: JcOverview; r: JcResults; onCertificates: () => void }) {
  const { t } = useTranslation();
  const byGrade = new Map<string, JcResults['honor_board']>();
  for (const b of r.honor_board) byGrade.set(b.grade_level_name, [...(byGrade.get(b.grade_level_name) ?? []), b]);
  return (
    <View className="gap-3">
      <Note text={t('examControl.topNHint', { n: o.session.settings.top_n })} />
      <Button variant="outline" onPress={onCertificates} disabled={!r.honor_board.length}>
        <Text>{t('examControl.doc_certificates')}</Text>
      </Button>
      {!byGrade.size ? <Note text={t('examControl.noResultsYet')} /> : null}
      {[...byGrade.entries()].map(([grade, list]) => (
        <FormSection key={grade} title={grade} icon={Trophy}>
          {list.map((b) => (
            <View key={b.id} className="flex-row items-center gap-3">
              <View className={`size-7 items-center justify-center rounded-full ${b.place === 1 ? 'bg-warning/20' : 'bg-muted'}`}>
                <Text className="text-sm font-bold">{String(b.place)}</Text>
              </View>
              <Text className="flex-1 text-sm font-medium">{b.name}</Text>
              <Text className="text-sm">{pct(b.pct)}</Text>
            </View>
          ))}
        </FormSection>
      ))}
    </View>
  );
}

function Second({ id, o, r, refresh }: { id: string; o: JcOverview; r: JcResults; refresh: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { to } = useJcBase();
  const create = useAction(jahbadhControl.createSecondRound, { success: t('examControl.secondRoundCreated') });
  const name = (k: string) => o.grades.flatMap((g) => g.subjects).find((s) => s.key === k)?.name ?? k;
  const list = r.second_round_candidates;
  const doCreate = async () => {
    if (!(await confirm({ title: t('examControl.secondRound'), body: t('examControl.confirmSecondRound') }))) return;
    const res = await create.run(id);
    const next = res.data?.session_id ?? null;
    if (res.ok && next) {
      refresh();
      router.push(to('session', next));
    }
  };
  return (
    <View className="gap-3">
      <Note text={t('examControl.secondRoundHint', { pass: Math.round(o.session.settings.exam_pass * 100) })} />
      {o.rights.chief && o.session.round === 'first' && list.length ? (
        <Button onPress={doCreate} disabled={create.running}>
          <Text>{t('examControl.createSecondRound', { n: list.length })}</Text>
        </Button>
      ) : null}
      {!list.length ? <Note text={t('examControl.noSecondRound')} /> : null}
      {list.map((c) => (
        <View key={c.id} className="border-border gap-0.5 border-b pb-2">
          <Text className="text-sm font-medium">{c.name}</Text>
          <Text variant="muted" className="text-[11px]">
            {c.subjects.map(name).join('، ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Messages({ id, o }: { id: string; o: JcOverview }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [applied, setApplied] = useState('');
  const list = useApi(['jc', 'messages', id, applied] as const, ([, , s, n]) => jahbadhControl.messages(s, n || undefined));
  const send = useAction(jahbadhControl.sendMessages, { success: t('examControl.sent') });
  const doSend = async () => {
    if (await confirm({ title: t('examControl.sendPush'), body: t('examControl.confirmSend', { n: list.data?.length ?? 0 }) })) send.run(id, applied || undefined);
  };
  const open = (url: string) => Linking.openURL(url).catch((e: Error) => toast.error(e.message));
  return (
    <View className="gap-3">
      <Note text={t('examControl.messagesHint')} />
      <Text variant="muted" className="text-[11px]">
        {o.session.settings.message_template}
      </Text>
      <Input value={note} onChangeText={setNote} placeholder={t('examControl.messageNote')} />
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={() => setApplied(note)}>
          <Text>{t('examControl.preview')}</Text>
        </Button>
        <Button className="flex-1" onPress={doSend} disabled={!list.data?.length || send.running}>
          <Text>{t('examControl.sendPush')}</Text>
        </Button>
      </View>
      {list.isLoading ? <LoadingList rows={3} /> : null}
      {list.data?.map((m) => (
        <View key={m.id} className="bg-card border-border gap-1.5 rounded-2xl border p-3">
          <Text className="text-sm font-semibold">{m.name}</Text>
          <Text className="text-xs">{m.text}</Text>
          {m.whatsapp ? (
            <Pressable onPress={() => open(m.whatsapp as string)} accessibilityRole="link" className="flex-row items-center gap-1.5 self-start">
              <Icon as={MessageCircle} className="text-success size-4" />
              <Text className="text-success text-xs font-semibold">{m.phone ?? ''}</Text>
            </Pressable>
          ) : (
            <Text variant="muted" className="text-[11px]">
              {t('examControl.noPhone')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Export({ id }: { id: string }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const preview = useApi(['jc', 'export', id] as const, ([, , s]) => jahbadhControl.exportPreview(s));
  const [done, setDone] = useState<JcExport | null>(null);
  const commit = useAction(jahbadhControl.exportCommit, { success: t('examControl.exported') });
  const data = done ?? preview.data;
  const doCommit = async () => {
    if (!(await confirm({ title: t('examControl.exportToGrades'), body: t('examControl.confirmExport') }))) return;
    const res = await commit.run(id);
    if (res.ok && res.data) setDone(res.data);
  };
  if (preview.error) return <Note tone="warning" text={preview.error.message} />;
  if (!data) return <LoadingList rows={3} />;
  return (
    <View className="gap-3">
      <Note text={t('examControl.exportHint')} />
      <View className="flex-row gap-2">
        <MiniTile label={t('examControl.export_new')} value={data.summary.new} tone="success" />
        <MiniTile label={t('examControl.export_change')} value={data.summary.change} tone={data.summary.change ? 'warning' : 'muted'} />
        <MiniTile label={t('examControl.export_same')} value={data.summary.same} />
      </View>
      {data.committed ? (
        <Note tone="success" text={t('examControl.exportDone')} />
      ) : (
        <Button onPress={doCommit} disabled={commit.running || (!data.summary.new && !data.summary.change)}>
          <Text>{t('examControl.commitExport')}</Text>
        </Button>
      )}
      {data.changes.length ? (
        <FormSection title={t('examControl.changesPreview')} description={t('examControl.changesPreviewHint')}>
          {data.changes.map((c, i) => (
            <Text key={i} className={`text-xs ${c.action === 'change' ? 'text-warning' : ''}`}>{`${c.name} · ${c.subject}: ${c.before ?? '—'} → ${c.after}`}</Text>
          ))}
        </FormSection>
      ) : null}
    </View>
  );
}
