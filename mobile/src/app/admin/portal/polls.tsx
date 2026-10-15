import type { PollQuestionType, PortalPoll, PortalPollResults } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BarChart3, Eye, Plus, Star, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { EMPTY_VISIBILITY, VisibilityPicker, visibilityOf, type VisibilityState } from '@/features/admin/visibility';
import { useCampus } from '@/features/campus/campus';
import { adminPortal } from '@/lib/api';
import { useApi } from '@/lib/data';

const TYPES: PollQuestionType[] = ['single_choice', 'multiple_choice', 'rating', 'text'];
interface QuestionRow {
  key: string;
  question_text: string;
  options: string;
  question_type: PollQuestionType;
}
interface PollRow {
  id?: string;
  key: string;
  title: string;
  questions: QuestionRow[];
  show_results: boolean;
  sort_order: string;
  visible_from: string;
  visible_until: string;
  visibility: VisibilityState;
}

let seq = 0;
const blankQ = (): QuestionRow => ({ key: `q-${seq++}`, question_text: '', options: '', question_type: 'single_choice' });
const blank = (sort: number): PollRow => ({ key: `new-${seq++}`, title: '', questions: [blankQ()], show_results: false, sort_order: String(sort), visible_from: '', visible_until: '', visibility: EMPTY_VISIBILITY });
const toDay = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDay = (d: string) => (d ? new Date(d).toISOString() : undefined);
const optionText = (o: string | { value: string; label: string }) => (typeof o === 'string' ? o : o.label || o.value);

const toRow = (p: PortalPoll): PollRow => ({
  id: p.id,
  key: p.id,
  title: p.title,
  questions: p.questions?.length ? p.questions.map((q) => ({ key: q.id, question_text: q.question_text, options: (q.options ?? []).map(optionText).join('\n'), question_type: q.question_type })) : [blankQ()],
  show_results: p.show_results,
  sort_order: String(p.sort_order ?? 0),
  visible_from: toDay(p.visible_from),
  visible_until: toDay(p.visible_until),
  visibility: visibilityOf(p),
});

/** Portal polls: questions (single/multiple/rating/text), show results, dates, audience, results view (web: /admin/portal/polls). */
export default function PortalPolls() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.portal_polls.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(campusId ? ['admin', 'portal-polls', campusId] : null, ([, , c]) => adminPortal.polls(String(c)));
  const [rows, setRows] = useState<PollRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [resultsId, setResultsId] = useState<string | null>(null);

  useEffect(() => {
    if (!res.data) return;
    const list = res.data.map(toRow);
    setRows([...list, blank(list.length)]);
  }, [res.data]);

  const update = (key: string, patch: Partial<PollRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const updateQ = (key: string, qKey: string, patch: Partial<QuestionRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, questions: x.questions.map((q) => (q.key === qKey ? { ...q, ...patch } : q)) } : x)));
  const addQ = (key: string) => setRows((r) => r.map((x) => (x.key === key ? { ...x, questions: [...x.questions, blankQ()] } : x)));
  const removeQ = (key: string, qKey: string) =>
    setRows((r) =>
      r.map((x) => {
        if (x.key !== key) return x;
        const qs = x.questions.filter((q) => q.key !== qKey);
        return { ...x, questions: qs.length ? qs : [blankQ()] };
      }),
    );

  async function remove(row: PollRow) {
    if (row.id) {
      const r = await adminPortal.deletePoll(row.id);
      if (!r.success) return toast.error(r.error || t('common.error'));
      toast.success(p('success_deleted'));
    }
    setRows((prev) => {
      const next = prev.filter((x) => x.key !== row.key);
      return next.length && !next[next.length - 1].id ? next : [...next, blank(next.length)];
    });
  }

  async function save() {
    if (!campusId) return toast.error(t('common.err_select_campus'));
    setSaving(true);
    try {
      for (const row of rows) {
        const valid = row.questions.filter((q) => q.question_text.trim());
        if (!row.title.trim() && !valid.length) continue;
        const body = {
          title: row.title || t('common.label_untitled'),
          sort_order: parseInt(row.sort_order, 10) || 0,
          show_results: row.show_results,
          visible_from: fromDay(row.visible_from),
          visible_until: fromDay(row.visible_until),
          visible_to_roles: row.visibility.mode === 'roles' && row.visibility.roles.length ? row.visibility.roles : ['admin', 'teacher', 'student', 'parent'],
          visible_to_grade_ids: row.visibility.gradeIds,
          visible_to_user_ids: row.visibility.mode !== 'roles' ? row.visibility.userIds : [],
          campus_id: campusId,
          questions: valid.map((q, i) => ({ question_text: q.question_text, question_type: q.question_type, options: q.options.split('\n').filter((o) => o.trim()), sort_order: i })),
        };
        const r = row.id ? await adminPortal.updatePoll(row.id, body) : await adminPortal.createPoll(body);
        if (!r.success) throw new Error(r.error);
      }
      toast.success(p('success_saved'));
      res.mutate();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const saveBtn = (
    <Button onPress={save} disabled={saving} className="self-end">
      <Text>{saving ? p('btn_saving') : p('btn_save')}</Text>
    </Button>
  );
  const savedCount = rows.filter((r) => r.id).length;
  if (!campusId) return <EmptyState icon={BarChart3} title={t('common.select_campus')} body={p('prompt_select_campus_desc')} />;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: p('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {saveBtn}
        <Text className="text-muted-foreground text-sm italic">{savedCount ? p('polls_found', { count: savedCount }) : p('no_polls')}</Text>
        {res.isLoading && !res.data ? (
          <LoadingList />
        ) : (
          rows.map((row) => (
            <Card key={row.key}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center gap-2">
                  {row.id ? (
                    <Button size="icon" variant="ghost" onPress={() => remove(row)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  ) : (
                    <Icon as={Plus} className="text-muted-foreground size-5" />
                  )}
                  <View className="flex-1 gap-1">
                    <Label>{p('table_title')}</Label>
                    <Input value={row.title} onChangeText={(v) => update(row.key, { title: v })} />
                  </View>
                  <View className="w-20 gap-1">
                    <Label>{p('table_sort')}</Label>
                    <Input value={row.sort_order} keyboardType="number-pad" onChangeText={(v) => update(row.key, { sort_order: v.replace(/[^0-9-]/g, '') })} />
                  </View>
                </View>
                <Label>{p('table_poll')}</Label>
                {row.questions.map((q) => (
                  <View key={q.key} className="border-border gap-2 rounded-lg border p-3">
                    <View className="flex-row items-end gap-2">
                      <View className="flex-1 gap-1">
                        <Label className="text-xs">{p('label_question_title')}</Label>
                        <Input value={q.question_text} onChangeText={(v) => updateQ(row.key, q.key, { question_text: v })} />
                      </View>
                      {row.questions.length > 1 ? (
                        <Button size="icon" variant="ghost" onPress={() => removeQ(row.key, q.key)} accessibilityLabel={t('common.delete')}>
                          <Icon as={Trash2} className="text-destructive size-4" />
                        </Button>
                      ) : null}
                    </View>
                    <Label className="text-xs">{p('label_options_help')}</Label>
                    <Textarea value={q.options} onChangeText={(v) => updateQ(row.key, q.key, { options: v })} className="min-h-16" />
                    <Label className="text-xs">{p('label_data_type')}</Label>
                    <Picker value={q.question_type} onChange={(v) => updateQ(row.key, q.key, { question_type: v as PollQuestionType })} options={TYPES.map((x) => ({ value: x, label: p(`data_types.${x}`) }))} />
                  </View>
                ))}
                <Button size="sm" variant="ghost" className="self-start" onPress={() => addQ(row.key)}>
                  <Icon as={Plus} className="text-primary size-4" />
                  <Text className="text-primary">{p('btn_new_question')}</Text>
                </Button>
                <Label>{p('table_results')}</Label>
                <CheckRow checked={row.show_results} onPress={() => update(row.key, { show_results: !row.show_results })} label={p('label_show_to_users')} />
                {row.id ? (
                  <Button size="sm" variant="secondary" className="self-start" onPress={() => setResultsId(row.id ?? null)}>
                    <Icon as={Eye} className="text-foreground size-4" />
                    <Text>{p('btn_view_results')}</Text>
                  </Button>
                ) : null}
                <View className="gap-1">
                  <Label>{p('table_visible_between')}</Label>
                  <View className="flex-row gap-2">
                    <DateField className="flex-1" value={row.visible_from} onChange={(v) => update(row.key, { visible_from: v })} clearable />
                    <DateField className="flex-1" value={row.visible_until} onChange={(v) => update(row.key, { visible_until: v })} clearable />
                  </View>
                </View>
                <View className="gap-1">
                  <Label>{p('table_visible_to')}</Label>
                  <VisibilityPicker value={row.visibility} onChange={(vis) => update(row.key, { visibility: vis })} />
                </View>
              </CardContent>
            </Card>
          ))
        )}
        {saveBtn}
      </ScrollView>
      <ResultsDialog pollId={resultsId} onClose={() => setResultsId(null)} />
    </View>
  );
}

function ResultsDialog({ pollId, onClose }: { pollId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.portal_polls.${k}`, o);
  const res = useApi(pollId ? ['admin', 'poll-results', pollId] : null, ([, , id]) => adminPortal.pollResults(String(id)));
  const data: PortalPollResults | undefined = res.data;
  const pct = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
  return (
    <Dialog open={!!pollId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{p('results_title')}</DialogTitle>
        </DialogHeader>
        <ScrollView className="max-h-[480px]" contentContainerClassName="gap-4">
          {res.isLoading ? (
            <LoadingList rows={3} />
          ) : !data ? null : (
            <>
              <View>
                <Text className="font-semibold">{data.poll.title}</Text>
                <Text className="text-muted-foreground text-sm">{p('total_responses', { count: data.total_responses })}</Text>
              </View>
              {!data.questions.length ? (
                <Text className="text-muted-foreground py-4 text-center">{p('no_questions')}</Text>
              ) : (
                data.questions.map((q, i) => (
                  <View key={q.question_id} className="gap-2">
                    {i > 0 ? <Separator /> : null}
                    <Text className="font-medium">{q.question_text}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {p('total_responses_short', { count: q.total_responses })} • {TYPES.includes(q.question_type as PollQuestionType) ? p(`data_types.${q.question_type}`) : q.question_type}
                    </Text>
                    {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && q.options
                      ? q.options.map((o) => (
                          <View key={o.option} className="gap-1">
                            <View className="flex-row justify-between">
                              <Text className="flex-1 text-sm">{o.option}</Text>
                              <Text className="text-muted-foreground text-sm">
                                {o.count} ({pct(o.count, q.total_responses)}%)
                              </Text>
                            </View>
                            <Progress value={pct(o.count, q.total_responses)} />
                          </View>
                        ))
                      : null}
                    {q.question_type === 'rating' ? (
                      <View className="gap-2">
                        <View className="items-center">
                          <Text className="text-3xl font-bold">{q.average_rating?.toFixed(1) || '0.0'}</Text>
                          <Text className="text-muted-foreground text-xs">{p('label_average_rating')}</Text>
                        </View>
                        {[...(q.rating_distribution ?? [])]
                          .sort((a, b) => b.rating - a.rating)
                          .map((r) => (
                            <View key={r.rating} className="flex-row items-center gap-2">
                              <View className="w-20 flex-row">
                                {Array.from({ length: r.rating }).map((_, k) => (
                                  <Icon key={k} as={Star} size={12} color="#f59e0b" />
                                ))}
                              </View>
                              <View className="flex-1">
                                <Progress value={pct(r.count, q.total_responses)} />
                              </View>
                              <Text className="text-muted-foreground w-16 text-end text-xs">
                                {r.count} ({pct(r.count, q.total_responses)}%)
                              </Text>
                            </View>
                          ))}
                      </View>
                    ) : null}
                    {q.question_type === 'text' && q.text_responses ? (
                      q.text_responses.length === 0 ? (
                        <Text className="text-muted-foreground text-sm italic">{p('no_responses')}</Text>
                      ) : (
                        q.text_responses.map((r, k) => (
                          <View key={k} className="bg-muted/50 rounded-md p-2">
                            <Text className="text-sm">{r}</Text>
                          </View>
                        ))
                      )
                    ) : null}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
        <Button variant="outline" onPress={onClose}>
          <Text>{t('common.close')}</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
