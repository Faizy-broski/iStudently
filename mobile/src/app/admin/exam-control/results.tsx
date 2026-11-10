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
  const unmasked = !!ov.data?.rights.unmasked;
  const res = useApi(id && unmasked ? (['jc', 'results', id] as const) : null, ([, , s]) => jahbadhControl.results(s));
  const [pane, setPane] = useState<Pane>('results');
  const print = usePrintDoc(id);
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  // Before unmasking only the honor board (names hidden) is available; scores need unmasking.
  if (!o.rights.unmasked) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('examControl.tab_results'),
            headerRight: () => <PrintButton label={t('examControl.print')} onPress={() => print('honor_board')} />,
          }}
        />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
          <Note tone="warning" text={t('examControl.resultsAfterUnmask')} />
          <Honor id={id} o={o} onCertificates={() => print('certificates')} />
        </ScrollView>
      </>
    );
  }
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
          headerRight: () => <PrintButton label={t('examControl.print')} onPress={() => print(pane === 'honor' ? 'honor_board' : pane === 'second' ? 'second_round_list' : 'results')} />,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <FilterChips value={pane} onChange={setPane} options={panes} />
        {res.error && pane === 'results' ? (
          <Note tone="warning" text={res.error.message} />
        ) : !r && pane === 'results' ? (
          <LoadingList rows={4} />
        ) : pane === 'results' ? (
          <Sheet o={o} r={r!} />
        ) : pane === 'honor' ? (
          <Honor id={id} o={o} onCertificates={() => print('certificates')} />
        ) : pane === 'second' ? (
          <Second id={id} o={o} refresh={() => ov.mutate()} />
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
              return <Text key={sub.key} className={`text-xs ${low ? 'text-destructive' : 'text-muted-foreground'}`}>{`${sub.name} ${!v ? '—' : v.absent ? 'غ' : Number(v.score)}/${sub.max}`}</Text>;
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Honor({ id, o, onCertificates }: { id: string; o: JcOverview; onCertificates: () => void }) {
  const { t } = useTranslation();
  const board = useApi(['jc', 'honor', id] as const, ([, , s]) => jahbadhControl.honorBoard(s));
  if (board.error) return <Note tone="warning" text={board.error.message} />;
  if (!board.data) return <LoadingList rows={3} />;
  const b = board.data;
  const byGrade = new Map<string, typeof b.rows>();
  for (const x of b.rows) byGrade.set(x.grade_level_name, [...(byGrade.get(x.grade_level_name) ?? []), x]);
  return (
    <View className="gap-3">
      <Note text={`${t('examControl.topNHint', { n: o.session.settings.top_n })} · ${t('examControl.honorCompleteOnly')}`} />
      {b.unmasked ? (
        <Button variant="outline" onPress={onCertificates} disabled={!b.rows.length}>
          <Text>{t('examControl.doc_certificates')}</Text>
        </Button>
      ) : null}
      {!byGrade.size ? <Note text={t('examControl.noResultsYet')} /> : null}
      {[...byGrade.entries()].map(([grade, list]) => (
        <FormSection key={grade} title={grade} icon={Trophy}>
          {list.map((x, i) => (
            <View key={`${x.place}-${i}`} className="flex-row items-center gap-3">
              <View className={`size-7 items-center justify-center rounded-full ${x.place === 1 ? 'bg-warning/20' : 'bg-muted'}`}>
                <Text className="text-sm font-bold">{String(x.place)}</Text>
              </View>
              <Text className={`flex-1 text-sm font-medium ${b.unmasked ? '' : 'text-muted-foreground'}`}>{x.name}</Text>
              <Text className="text-sm">{pct(x.pct)}</Text>
            </View>
          ))}
        </FormSection>
      ))}
    </View>
  );
}

/** Second round (E3): from the grades module's decision (Art. 122 / 51); provisional = exam scores only. */
function Second({ id, o, refresh }: { id: string; o: JcOverview; refresh: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const { to } = useJcBase();
  const manage = o.rights.manage;
  const list = useApi(manage ? (['jc', 'round2', id] as const) : null, ([, , s]) => jahbadhControl.secondRoundList(s));
  const [creating, setCreating] = useState(false);
  const doCreate = async () => {
    if (!(await confirm({ title: t('examControl.secondRound'), body: t('examControl.confirmSecondRound') }))) return;
    setCreating(true);
    const res = await jahbadhControl.createSecondRound(id);
    setCreating(false);
    if (!res.success) {
      toast.error(res.code === 'round2_needs_grades' ? t('examControl.round2NeedsGrades') : res.error || t('app.error_title'));
      return;
    }
    toast.success(t('examControl.secondRoundCreated'));
    const next = res.data?.session_id ?? null;
    if (next) {
      refresh();
      router.push(to('session', next));
    }
  };
  if (!manage) return <Note text={t('examControl.secondRoundManageOnly')} />;
  if (list.error) return <Note tone="warning" text={list.error.message} />;
  if (!list.data) return <LoadingList rows={3} />;
  const d = list.data;
  const provisional = d.source === 'provisional';
  return (
    <View className="gap-3">
      <Note tone={provisional ? 'warning' : 'success'} text={`${provisional ? t('examControl.round2Provisional') : t('examControl.round2FromGrades')} — ${d.note}`} />
      {o.rights.chief && o.session.round === 'first' && d.students.length ? (
        <Button onPress={doCreate} disabled={creating || provisional}>
          <Text>{t('examControl.createSecondRound', { n: d.students.length })}</Text>
        </Button>
      ) : null}
      {provisional && o.rights.chief ? <Note tone="warning" text={t('examControl.round2NeedsGrades')} /> : null}
      {!d.students.length ? <Note text={t('examControl.noSecondRound')} /> : null}
      {d.students.map((c) => (
        <View key={c.id} className="border-border gap-0.5 border-b pb-2">
          <Text className="text-sm font-medium">{c.name}</Text>
          <Text variant="muted" className="text-xs">
            {[c.seat_number ? String(c.seat_number) : null, c.grade_level_name, c.section_name].filter(Boolean).join(' · ')}
          </Text>
          <Text className="text-xs">{c.subjects.join('، ')}</Text>
          <Text variant="muted" className="text-xs">
            {[c.decision, c.round2_seat ? `${t('examControl.round2Seat')}: ${c.round2_seat}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ))}
      {d.excluded_over_limit.length ? (
        <FormSection title={t('examControl.round2OverLimit')} description={t('examControl.round2OverLimitHint')}>
          {d.excluded_over_limit.map((x) => (
            <Text key={x.id} className="text-destructive text-xs">{`${x.name} · ${x.grade_level_name} · ${t('examControl.failedN', { n: x.failed })}`}</Text>
          ))}
        </FormSection>
      ) : null}
      {d.incomplete.length ? (
        <FormSection title={t('examControl.round2Incomplete')}>
          {d.incomplete.map((x) => (
            <Text key={x.id} className="text-xs">{`${x.name} · ${x.grade_level_name}${x.missing ? ` — ${x.missing}` : ''}`}</Text>
          ))}
        </FormSection>
      ) : null}
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
      <Text variant="muted" className="text-xs">
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
            <Text variant="muted" className="text-xs">
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
      <View className="flex-row flex-wrap gap-2">
        <MiniTile label={t('examControl.export_new')} value={data.summary.new} tone="success" />
        <MiniTile label={t('examControl.export_change')} value={data.summary.change} tone={data.summary.change ? 'warning' : 'muted'} />
        <MiniTile label={t('examControl.export_same')} value={data.summary.same} />
        <MiniTile label={t('examControl.export_from_attendance')} value={data.summary.from_attendance ?? 0} />
        <MiniTile label={t('examControl.export_skipped')} value={data.summary.skipped ?? 0} tone={data.summary.skipped ? 'destructive' : 'muted'} />
        <MiniTile label={t('examControl.export_no_national_id')} value={data.summary.no_national_id ?? 0} tone={data.summary.no_national_id ? 'warning' : 'muted'} />
      </View>
      {data.skipped?.length ? (
        <FormSection title={t('examControl.exportSkipped')}>
          {data.skipped.map((x, i) => (
            <Text key={i} className="text-xs">{`${x.name} · ${x.subject} — ${t(`examControl.skip_${x.reason}`)}`}</Text>
          ))}
        </FormSection>
      ) : null}
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
            <View key={i} className="gap-0.5">
              <Text className={`text-xs ${c.action === 'change' ? 'text-warning' : ''}`}>{`${c.name} · ${c.subject}: ${c.before ?? '—'} → ${c.after}${c.from_attendance ? ` (${t('examControl.fromAttendance')})` : ''}`}</Text>
              <Text variant="muted" className="text-2xs">{`${t('examControl.nationalId')}: ${c.national_id ?? t('examControl.noNationalId')} · ${t('examControl.exportTarget')}: ${c.target}`}</Text>
            </View>
          ))}
        </FormSection>
      ) : null}
    </View>
  );
}
