import type { CoachingNoteType } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { GraduationCap, ListChecks, Plus, Sparkles, ThumbsUp, TrendingUp, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { PillPicker } from '@/features/inspector/ui';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

const NOTE_TYPES: { key: CoachingNoteType; icon: LucideIcon }[] = [
  { key: 'strength', icon: ThumbsUp },
  { key: 'area_for_growth', icon: TrendingUp },
  { key: 'action_item', icon: ListChecks },
];
const NONE = '__none__';

/** Coaching per evaluated teacher: strengths, areas for growth, action items, training prescriptions (web: /inspector/visits/[id]/coaching). */
export default function CoachingScreen() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.coaching.${key}`);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const visit = useApi(id ? ['inspector', 'visit', id] : null, ([, , v]) => inspector.visit(v as string));
  const evals = useApi(id ? ['inspector', 'visit-evaluations', id] : null, ([, , v]) => inspector.evaluationsForVisit(v as string));
  const schoolId = visit.data?.school_id ?? null;
  const sessions = useApi(schoolId ? ['inspector', 'training-sessions', schoolId] : null, ([, , s]) => inspector.trainingSessions(s as string));
  const [picked, setPicked] = useState<string | null>(null);
  const evalId = picked ?? evals.data?.[0]?.id ?? null;
  const detail = useApi(evalId ? ['inspector', 'coaching', evalId] : null, async ([, , e]) => {
    const [n, p] = await Promise.all([inspector.notes(e as string), inspector.prescriptions(e as string)]);
    return { success: true as const, data: { notes: n.data ?? [], prescriptions: p.data ?? [] } };
  });
  const [note, setNote] = useState<{ type: CoachingNoteType; content: string; date: string } | null>(null);
  const [rx, setRx] = useState<{ reason: string; session: string } | null>(null);
  const [assign, setAssign] = useState<{ id: string; session: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionOptions = [{ value: NONE, label: '—' }, ...(sessions.data ?? []).map((s) => ({ value: s.id, label: s.title }))];

  async function act(p: Promise<{ success: boolean; error?: string | null }>, ok: string, close?: () => void) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k(ok));
    close?.();
    detail.mutate();
  }

  if (visit.isLoading || evals.isLoading) return <LoadingList rows={4} />;
  const v = visit.data;
  if (!v) return <Text className="text-muted-foreground p-6 text-center">{k('visit_not_found')}</Text>;
  const notes = detail.data?.notes ?? [];
  const prescriptions = detail.data?.prescriptions ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => detail.mutate()} />}>
        <Text variant="muted">{`${v.school?.name ?? ''} · ${v.scheduled_date}`}</Text>
        {!(evals.data ?? []).length ? (
          <Card>
            <CardContent className="py-10">
              <Text className="text-muted-foreground text-center text-sm">{k('no_evaluations')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            {(evals.data ?? []).length > 1 ? (
              <PillPicker items={(evals.data ?? []).map((e) => ({ value: e.id, label: `${e.teacher.first_name} ${e.teacher.last_name}` }))} value={evalId} onChange={setPicked} />
            ) : null}
            {detail.isLoading ? (
              <LoadingList rows={3} />
            ) : (
              <>
                {NOTE_TYPES.map(({ key, icon }) => {
                  const list = notes.filter((n) => n.note_type === key);
                  return (
                    <Card key={key}>
                      <CardHeader className="flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center gap-2">
                          <Icon as={icon} className="size-4 text-[#022172] dark:text-blue-300" />
                          <CardTitle className="text-base">{k(`note_type_${key}`)}</CardTitle>
                        </View>
                        <Button size="sm" variant="outline" onPress={() => setNote({ type: key, content: '', date: '' })}>
                          <Icon as={Plus} className="size-3.5" />
                          <Text>{k('btn_add_note')}</Text>
                        </Button>
                      </CardHeader>
                      <CardContent className="gap-2">
                        {!list.length ? (
                          <Text className="text-muted-foreground text-sm">{k('no_notes')}</Text>
                        ) : (
                          list.map((n) => (
                            <View key={n.id} className="border-border flex-row items-start gap-2 rounded-md border p-2.5">
                              <View className="flex-1">
                                <Text className="text-sm">{n.content}</Text>
                                {n.target_date ? <Text className="text-muted-foreground text-xs">{`${k('target_date_label')}: ${n.target_date}`}</Text> : null}
                              </View>
                              <Pressable hitSlop={8} accessibilityLabel={t('common.delete')} onPress={() => act(inspector.deleteNote(n.id), 'msg_note_deleted')}>
                                <Icon as={X} className="text-destructive size-3.5" />
                              </Pressable>
                            </View>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Icon as={GraduationCap} className="size-4 text-[#022172] dark:text-blue-300" />
                        <CardTitle className="text-base">{k('prescriptions_title')}</CardTitle>
                      </View>
                      <CardDescription>{k('prescriptions_desc')}</CardDescription>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => setRx({ reason: '', session: '' })}>
                      <Icon as={Plus} className="size-3.5" />
                      <Text>{k('btn_add_prescription')}</Text>
                    </Button>
                  </CardHeader>
                  <CardContent className="gap-2">
                    {!prescriptions.length ? (
                      <Text className="text-muted-foreground text-sm">{k('no_prescriptions')}</Text>
                    ) : (
                      prescriptions.map((p) => (
                        <View key={p.id} className="border-border gap-1.5 rounded-md border p-2.5">
                          <View className="flex-row flex-wrap items-center gap-1.5">
                            {p.auto_suggested ? (
                              <Badge variant="outline" className="flex-row items-center gap-1">
                                <Icon as={Sparkles} className="size-2.5" />
                                <Text className="text-[10px]">{k('auto_suggested_badge')}</Text>
                              </Badge>
                            ) : null}
                            <Badge variant="secondary">
                              <Text className="text-[10px]">{k(`prescription_status_${p.status}`)}</Text>
                            </Badge>
                            {p.criterion ? <Text className="text-muted-foreground text-xs">{p.criterion.name}</Text> : null}
                          </View>
                          {p.reason ? <Text className="text-sm">{p.reason}</Text> : null}
                          {p.training_session ? <Text className="text-muted-foreground text-xs">{`${k('linked_session_label')}: ${p.training_session.title}`}</Text> : null}
                          {p.status === 'suggested' || p.status === 'assigned' ? (
                            <View className="flex-row gap-2">
                              <Button size="sm" variant="outline" onPress={() => setAssign({ id: p.id, session: p.training_session_id ?? '' })}>
                                <Text className="text-xs">{k('btn_assign')}</Text>
                              </Button>
                              <Button size="sm" variant="ghost" onPress={() => act(inspector.dismissPrescription(p.id), 'msg_dismissed')}>
                                <Text className="text-destructive text-xs">{k('btn_dismiss')}</Text>
                              </Button>
                            </View>
                          ) : null}
                        </View>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
      <Dialog open={!!note || !!rx || !!assign} onOpenChange={(o) => !o && (setNote(null), setRx(null), setAssign(null))}>
        <DialogContent className="w-[92vw] max-w-md">
          {note && evalId ? (
            <>
              <DialogHeader>
                <DialogTitle>{k(`dialog_add_${note.type}`)}</DialogTitle>
              </DialogHeader>
              <View className="gap-3">
                <Textarea value={note.content} onChangeText={(x) => setNote({ ...note, content: x })} placeholder={k('field_note_placeholder')} numberOfLines={3} />
                {note.type === 'action_item' ? <DateField label={k('field_target_date')} value={note.date || null} onChange={(d) => setNote({ ...note, date: d })} clearable /> : null}
              </View>
              <DialogFooter>
                <Button
                  disabled={busy || !note.content.trim()}
                  onPress={() =>
                    act(
                      inspector.addNote(evalId, { note_type: note.type, content: note.content.trim(), target_date: note.type === 'action_item' ? note.date || undefined : undefined }),
                      'msg_note_added',
                      () => setNote(null),
                    )
                  }>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{k('btn_save')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : rx && evalId ? (
            <>
              <DialogHeader>
                <DialogTitle>{k('dialog_add_prescription')}</DialogTitle>
              </DialogHeader>
              <View className="gap-3">
                <View className="gap-1.5">
                  <Label>{k('field_reason')}</Label>
                  <Textarea value={rx.reason} onChangeText={(x) => setRx({ ...rx, reason: x })} numberOfLines={2} />
                </View>
                <View className="gap-1.5">
                  <Label>{k('field_training_session_optional')}</Label>
                  <Picker value={rx.session || NONE} onChange={(x) => setRx({ ...rx, session: x === NONE ? '' : x })} placeholder={k('field_training_session_placeholder')} options={sessionOptions} />
                </View>
              </View>
              <DialogFooter>
                <Button
                  disabled={busy}
                  onPress={() => act(inspector.createPrescription(evalId, { reason: rx.reason.trim() || undefined, training_session_id: rx.session || undefined }), 'msg_prescription_added', () => setRx(null))}>
                  <Icon as={Plus} className="text-primary-foreground size-4" />
                  <Text>{k('btn_save')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : assign ? (
            <>
              <DialogHeader>
                <DialogTitle>{k('dialog_assign_title')}</DialogTitle>
              </DialogHeader>
              <View className="gap-1.5">
                <Label>{k('field_training_session_optional')}</Label>
                <Picker value={assign.session || NONE} onChange={(x) => setAssign({ ...assign, session: x === NONE ? '' : x })} placeholder={k('field_training_session_placeholder')} options={sessionOptions} />
              </View>
              <DialogFooter>
                <Button disabled={busy} onPress={() => act(inspector.assignPrescription(assign.id, assign.session || undefined), 'msg_assigned', () => setAssign(null))}>
                  <Text>{k('btn_confirm_assign')}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
