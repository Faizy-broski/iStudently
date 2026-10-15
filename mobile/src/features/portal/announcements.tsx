import type { PollResponseInput, PortalFeedPoll } from '@studently/api-client';
import * as WebBrowser from 'expo-web-browser';
import { BarChart3, Calendar, CheckCircle2, CheckSquare, Circle, CircleDot, Download, ExternalLink, FileText, Pin, Square } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The user's own campus, as the web's portal pages send it (profile.campus_id). */
function useOwnCampusId() {
  const { me } = useSession();
  return me.status === 'ready' ? (me.me.profile.campus_id ?? null) : null;
}

function Loading({ rows, height }: { rows: number; height: string }) {
  return (
    <View className="bg-background flex-1 gap-4 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-xl', height)} />
      ))}
    </View>
  );
}

/** Announcements for this user's role; tap to expand, open the attachment or link (web: /<role>/portal/notes). */
export function PortalNotesScreen({ campusId: forCampus }: { campusId?: string | null } = {}) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pn_${key}`);
  const own = useOwnCampusId();
  const campusId = forCampus !== undefined ? forCampus : own;
  const notes = useApi(['portal', 'notes', campusId ?? 'own'], ([, , c]) => portal.notes(c === 'own' ? undefined : c));
  const [expanded, setExpanded] = useState<string | null>(null);

  if (notes.isLoading) return <Loading rows={3} height="h-32" />;
  const list = notes.data ?? [];
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => notes.mutate()} />}>
      <Text variant="muted">{k('subtitle')}</Text>
      {list.length === 0 ? (
        <EmptyState icon={FileText} title={k('empty')} body={k('empty_body')} />
      ) : (
        list.map((n) => {
          const open = expanded === n.id;
          return (
            <Pressable key={n.id} onPress={() => setExpanded(open ? null : n.id)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
              <Card className={cn('gap-2 py-4', n.is_pinned && 'border-2 border-[#022172]')}>
                <CardHeader className="flex-row items-start justify-between gap-2 px-4">
                  <View className="flex-1 flex-row items-start gap-2">
                    {n.is_pinned ? <Icon as={Pin} className="mt-0.5 size-5 text-[#022172] dark:text-blue-400" /> : null}
                    <View className="flex-1">
                      <CardTitle className="text-lg">{n.title}</CardTitle>
                      <View className="mt-1 flex-row flex-wrap items-center gap-x-3">
                        <View className="flex-row items-center gap-1">
                          <Icon as={Calendar} className="text-muted-foreground size-3" />
                          <Text className="text-muted-foreground text-sm">{formatDate(n.created_at)}</Text>
                        </View>
                        <Text className="text-muted-foreground text-sm">{formatRelative(n.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                  {n.is_pinned ? (
                    <Badge className="bg-[#022172]">
                      <Text className="text-white">{k('pinned')}</Text>
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="px-4">
                  <Text className="text-sm" numberOfLines={open ? undefined : 3}>
                    {n.content}
                  </Text>
                  {open && (n.file_url || n.embed_link) ? (
                    <View className="border-border mt-3 gap-3 border-t pt-3">
                      {n.file_url ? (
                        <Pressable onPress={() => WebBrowser.openBrowserAsync(n.file_url as string)} className="flex-row items-center gap-2" accessibilityRole="link">
                          <Icon as={Download} className="size-4 text-[#022172] dark:text-blue-400" />
                          <Text className="text-sm text-[#022172] dark:text-blue-400">{n.file_name || k('download')}</Text>
                        </Pressable>
                      ) : null}
                      {n.embed_link ? (
                        <Pressable onPress={() => WebBrowser.openBrowserAsync(n.embed_link as string)} className="flex-row items-center gap-2" accessibilityRole="link">
                          <Icon as={ExternalLink} className="size-4 text-[#022172] dark:text-blue-400" />
                          <Text className="text-sm text-[#022172] dark:text-blue-400">{k('view_link')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {!open && n.content.length > 200 ? <Text className="mt-2 text-sm text-[#022172] dark:text-blue-400">{k('read_more')}</Text> : null}
                </CardContent>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

type Answer = string | string[] | number;

/** Polls for this user's role: answer single/multiple choice, text and 1-5 rating questions once (web: /<role>/portal/polls). */
export function PortalPollsScreen({ campusId: forCampus }: { campusId?: string | null } = {}) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pp_${key}`);
  const toast = useToast();
  const own = useOwnCampusId();
  const campusId = forCampus !== undefined ? forCampus : own;
  const polls = useApi(['portal', 'polls', campusId ?? 'own'], ([, , c]) => portal.polls(c === 'own' ? undefined : c));
  const [answers, setAnswers] = useState<Record<string, Record<string, Answer>>>({});
  const [voted, setVoted] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const set = (pollId: string, qId: string, v: Answer) => setAnswers((a) => ({ ...a, [pollId]: { ...a[pollId], [qId]: v } }));

  async function submit(poll: PortalFeedPoll) {
    const qs = poll.questions ?? [];
    if (!qs.length) return;
    const mine = answers[poll.id] ?? {};
    const has = (v: Answer | undefined) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
    if (qs.some((q) => q.is_required && !has(mine[q.id]))) return toast.error(k('required'));
    const body: PollResponseInput[] = qs
      .filter((q) => has(mine[q.id]))
      .map((q) => {
        const a = mine[q.id];
        return {
          question_id: q.id,
          answer_text: q.question_type === 'text' ? String(a) : undefined,
          selected_options: q.question_type === 'single_choice' || q.question_type === 'multiple_choice' ? (Array.isArray(a) ? a : [String(a)]) : undefined,
          rating_value: q.question_type === 'rating' ? Number(a) : undefined,
        };
      });
    setSubmitting(poll.id);
    const r = await portal.respondPoll(poll.id, body);
    setSubmitting(null);
    if (!r.success) return toast.error(r.error || k('failed'));
    toast.success(k('success'));
    setVoted((v) => [...v, poll.id]);
  }

  if (polls.isLoading) return <Loading rows={2} height="h-64" />;
  const list = polls.data ?? [];
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => polls.mutate()} />}>
      <Text variant="muted">{k('subtitle')}</Text>
      {list.length === 0 ? (
        <EmptyState icon={BarChart3} title={k('empty')} body={k('empty_body')} />
      ) : (
        list.map((poll) => {
          const done = !!poll.has_voted || voted.includes(poll.id);
          const mine = answers[poll.id] ?? {};
          return (
            <Card key={poll.id} className="gap-3 py-4">
              <CardHeader className="flex-row items-start justify-between gap-2 px-4">
                <View className="flex-1">
                  <CardTitle className="text-xl">{poll.title}</CardTitle>
                  {poll.description ? <CardDescription className="mt-1">{poll.description}</CardDescription> : null}
                  <View className="mt-2 flex-row items-center gap-1">
                    <Icon as={Calendar} className="text-muted-foreground size-3" />
                    <Text className="text-muted-foreground text-sm">{formatDate(poll.created_at)}</Text>
                  </View>
                </View>
                {done ? (
                  <Badge className="bg-green-500">
                    <Icon as={CheckCircle2} className="size-3 text-white" />
                    <Text className="text-white">{k('voted')}</Text>
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="gap-5 px-4">
                {done ? (
                  <View className="items-center py-6">
                    <Icon as={CheckCircle2} className="mb-3 size-12 text-green-500" />
                    <Text className="text-muted-foreground">{k('thanks')}</Text>
                    {poll.show_results ? <Text className="text-muted-foreground mt-2 text-sm">{k('results_later')}</Text> : null}
                  </View>
                ) : (
                  <>
                    {(poll.questions ?? []).map((q, qi) => {
                      const opts = (q.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
                      const v = mine[q.id];
                      return (
                        <View key={q.id} className="gap-2">
                          <Text className="text-base font-medium">
                            {`${qi + 1}. ${q.question_text}`}
                            {q.is_required ? <Text className="text-red-500"> *</Text> : null}
                          </Text>
                          {q.question_type === 'single_choice'
                            ? opts.map((o) => (
                                <Pressable key={o.value} onPress={() => set(poll.id, q.id, o.value)} className="flex-row items-center gap-2 py-1" accessibilityRole="radio" accessibilityState={{ checked: v === o.value }}>
                                  <Icon as={v === o.value ? CircleDot : Circle} className={cn('size-5', v === o.value ? 'text-primary' : 'text-muted-foreground')} />
                                  <Text>{o.label}</Text>
                                </Pressable>
                              ))
                            : null}
                          {q.question_type === 'multiple_choice'
                            ? opts.map((o) => {
                                const sel = Array.isArray(v) ? v : [];
                                const on = sel.includes(o.value);
                                return (
                                  <Pressable
                                    key={o.value}
                                    onPress={() => set(poll.id, q.id, on ? sel.filter((x) => x !== o.value) : [...sel, o.value])}
                                    className="flex-row items-center gap-2 py-1"
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}>
                                    <Icon as={on ? CheckSquare : Square} className={cn('size-5', on ? 'text-primary' : 'text-muted-foreground')} />
                                    <Text>{o.label}</Text>
                                  </Pressable>
                                );
                              })
                            : null}
                          {q.question_type === 'text' ? <Textarea placeholder={k('placeholder')} value={typeof v === 'string' ? v : ''} onChangeText={(x) => set(poll.id, q.id, x)} /> : null}
                          {q.question_type === 'rating' ? (
                            <View className="flex-row gap-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Button key={n} variant={v === n ? 'default' : 'outline'} className="size-10 px-0" onPress={() => set(poll.id, q.id, n)}>
                                  <Text>{String(n)}</Text>
                                </Button>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    <Button className="bg-[#022172]" onPress={() => submit(poll)} disabled={submitting === poll.id}>
                      <Text className="text-white">{submitting === poll.id ? k('submitting') : k('submit')}</Text>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
