import { jitsiDomain, type JitsiPollType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { KeyRound, LogOut, StopCircle, Video } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { WebSessionView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLc } from '@/features/admin/jitsi';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Owner-side polls: launch one, watch live results, close it (web: PollLauncher). */
function Polls({ roomId }: { roomId: string }) {
  const l = useLc();
  const toast = useToast();
  const polls = useApi(['admin', 'jitsi-polls', roomId], ([, , r]) => jitsi.polls(r as string), { refreshInterval: 5000 });
  const open = (polls.data ?? []).find((p) => p.status === 'open') ?? null;
  const openId = open?.id ?? null;
  const results = useApi(openId ? ['admin', 'jitsi-poll-results', openId] : null, ([, , p]) => jitsi.pollResults(p as string), { refreshInterval: 4000 });
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<JitsiPollType>('single_choice');
  const [options, setOptions] = useState('');
  const [busy, setBusy] = useState(false);

  async function launch() {
    if (!question.trim()) return toast.error(l('toast_enter_question'));
    const opts = options.split('\n').map((o) => o.trim()).filter(Boolean);
    if ((type === 'single_choice' || type === 'multiple_choice') && opts.length < 2) return toast.error(l('toast_add_options'));
    setBusy(true);
    try {
      const r = await jitsi.launchPoll(roomId, { question_text: question.trim(), question_type: type, options: opts });
      if (!r.success) return toast.error(r.error || '');
      setQuestion('');
      setOptions('');
      polls.mutate();
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    if (!openId) return;
    setBusy(true);
    try {
      const r = await jitsi.closePoll(openId);
      if (!r.success) return toast.error(r.error || '');
      polls.mutate();
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <Card>
        <CardContent className="gap-3 pt-4">
          <Text className="font-semibold">{open.question_text}</Text>
          {(results.data?.tally ?? []).map((row) => (
            <View key={row.option} className="flex-row justify-between">
              <Text className="text-sm">{row.option}</Text>
              <Text className="text-sm font-semibold">{row.count}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground text-xs">{l('responses_count', { count: results.data?.total_responses ?? 0 })}</Text>
          <Button variant="destructive" onPress={close} disabled={busy}>
            <Text>{busy ? l('closing') : l('close_poll')}</Text>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="font-semibold">{l('launch_a_poll')}</Text>
        <View className="gap-1.5">
          <Label>{l('question_label')}</Label>
          <Input value={question} onChangeText={setQuestion} placeholder={l('question_placeholder')} />
        </View>
        <View className="gap-1.5">
          <Label>{l('type_label')}</Label>
          <Picker
            value={type}
            onChange={(v) => setType(v as JitsiPollType)}
            options={(['single_choice', 'multiple_choice', 'rating', 'text'] as const).map((ty) => ({ value: ty, label: l(`type_${ty}`) }))}
          />
        </View>
        {type === 'single_choice' || type === 'multiple_choice' ? (
          <View className="gap-1.5">
            <Label>{l('options_label')}</Label>
            <Input value={options} onChangeText={setOptions} multiline placeholder={'3\n4\n5'} className="min-h-24" textAlignVertical="top" />
          </View>
        ) : null}
        <Button onPress={launch} disabled={busy}>
          <Text>{busy ? l('launching') : l('launch_poll')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

/** A live class room: join the call, the shared whiteboard, polls; end a course session (web: /admin/jitsi-meet/rooms/[roomId], RoomView). */
/** Participant side of polls (web: PollResponder): answer the open poll, then see results once it closes. */
function PollResponder({ roomId }: { roomId: string }) {
  const l = useLc();
  const toast = useToast();
  const polls = useApi(['portal', 'jitsi-polls', roomId], ([, , r]) => jitsi.polls(r as string), { refreshInterval: 5000 });
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = polls.data ?? [];
  const open = list.find((p) => p.status === 'open') ?? null;
  const lastClosed = !open ? (list.find((p) => p.status === 'closed' && p.id === answeredId) ?? null) : null;
  const closedId = lastClosed?.id ?? null;
  const results = useApi(closedId ? ['portal', 'jitsi-poll-results', closedId] : null, ([, , p]) => jitsi.pollResults(p as string));
  const [shownFor, setShownFor] = useState<string | null>(null);
  const openId = open?.id ?? null;
  // A new poll opened: clear the previous answer.
  if (openId && openId !== shownFor && openId !== answeredId) {
    setShownFor(openId);
    setSelected([]);
    setText('');
    setRating(null);
  }

  if (!open) {
    if (!lastClosed) return null;
    return (
      <Card>
        <CardContent className="gap-2 pt-4">
          <Text className="font-semibold">{lastClosed.question_text}</Text>
          <Text className="text-muted-foreground text-xs">{l('poll_closed')}</Text>
          {(results.data?.tally ?? []).map((row) => (
            <View key={row.option} className="flex-row justify-between">
              <Text className="text-sm">{row.option}</Text>
              <Text className="text-muted-foreground text-sm">{String(row.count)}</Text>
            </View>
          ))}
          {results.data ? <Text className="text-muted-foreground text-xs">{l('responses_count', { count: results.data.total_responses })}</Text> : null}
        </CardContent>
      </Card>
    );
  }
  if (open.id === answeredId) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Text className="text-muted-foreground text-sm">{l('waiting_for_results')}</Text>
        </CardContent>
      </Card>
    );
  }
  const pollId = open.id;
  const toggle = (o: string) => setSelected((p) => (open.question_type === 'single_choice' ? [o] : p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  async function submit() {
    setBusy(true);
    const r = await jitsi.respondPoll(pollId, { selected_options: selected, answer_text: text || undefined, rating_value: rating ?? undefined });
    setBusy(false);
    if (!r.success) return toast.error(r.error || '');
    setAnsweredId(pollId);
    toast.success(l('toast_response_submitted'));
  }
  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <Text className="font-semibold">{open.question_text}</Text>
        {open.question_type === 'single_choice' || open.question_type === 'multiple_choice'
          ? (open.options as string[]).map((o) => (
              <Button key={o} variant={selected.includes(o) ? 'default' : 'outline'} className="justify-start" onPress={() => toggle(o)}>
                <Text>{o}</Text>
              </Button>
            ))
          : null}
        {open.question_type === 'rating' ? (
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} size="sm" variant={rating === n ? 'default' : 'outline'} onPress={() => setRating(n)}>
                <Text>{String(n)}</Text>
              </Button>
            ))}
          </View>
        ) : null}
        {open.question_type === 'text' ? <Input value={text} onChangeText={setText} placeholder={l('answer_placeholder')} /> : null}
        <Button onPress={submit} disabled={busy}>
          <Text>{busy ? l('submitting') : l('submit')}</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * A live-class room for any role (web: RoomView): join the call, the whiteboard (website view),
 * and polls: owners (and admins) launch them, everyone else answers. Owners can end an
 * online-class session.
 */
export function RoomScreen({ basePath }: { basePath: '/admin/jitsi-meet' | '/student/jitsi-meet' | '/teacher/jitsi-meet' | '/parent/jitsi-meet' }) {
  const l = useLc();
  const toast = useToast();
  const { campusId } = useCampus();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['admin', 'jitsi-room', id] : null, ([, , r]) => jitsi.room(r as string));
  const [tab, setTab] = useState<'video' | 'whiteboard' | 'polls'>('video');
  const [ending, setEnding] = useState(false);
  const room = res.data;
  const privileged = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isOwner = !!room && (privileged || room.owner_profile_id === profile?.id);

  if (res.isLoading) return <LoadingList rows={3} />;
  if (res.error || !room) return <ErrorState message={res.error?.message || l('room_not_found')} onRetry={() => res.mutate()} />;

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';
  const meetUrl = `https://${jitsiDomain(room.jitsi_domain)}/${encodeURIComponent(room.room_name)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}${room.start_audio_only ? '&config.startAudioOnly=true' : ''}`;
  const onlineClassId = room.online_class_id ?? null;

  async function endSession() {
    if (!onlineClassId) return;
    setEnding(true);
    try {
      const r = await jitsi.endSession(onlineClassId);
      if (!r.success) return toast.error(r.error || '');
      toast.success(l('session_ended'));
      router.back();
    } finally {
      setEnding(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: room.title || l('default_title') }} />
      <View className="gap-3 p-4 pb-2">
        {room.description ? <Text className="text-muted-foreground text-sm">{room.description}</Text> : null}
        <View className="flex-row gap-2">
          {isOwner && onlineClassId ? (
            <Button size="sm" variant="destructive" onPress={endSession} disabled={ending}>
              <Icon as={StopCircle} className="size-4 text-white" />
              <Text>{l('end_session')}</Text>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Icon as={LogOut} className="text-foreground size-4" />
            <Text>{l('leave')}</Text>
          </Button>
        </View>
        <FilterChips
          value={tab}
          onChange={setTab}
          options={[
            { value: 'video', label: l('tab_video') },
            { value: 'whiteboard', label: l('tab_whiteboard') },
            { value: 'polls', label: l('tab_polls') },
          ]}
        />
      </View>
      {tab === 'whiteboard' ? (
        // The Excalidraw whiteboard is the website's room page (switch to its Whiteboard tab).
        <WebSessionView path={`${basePath}/rooms/${room.id}`} campusId={campusId} />
      ) : (
        <KeyboardAvoidingView className="flex-1">
          <ScrollView contentContainerClassName="gap-3 p-4 pt-2 pb-10" keyboardShouldPersistTaps="handled">
            {tab === 'video' ? (
              <Card>
                <CardContent className="items-center gap-3 pt-6 pb-6">
                  <Icon as={Video} className="text-primary size-10" />
                  <Button onPress={() => openBrowserAsync(meetUrl)}>
                    <Text>{l('join')}</Text>
                  </Button>
                  {room.password ? (
                    <View className="flex-row items-center gap-1.5">
                      <Icon as={KeyRound} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-xs" selectable>
                        {l('room_password_label')}: {room.password}
                      </Text>
                    </View>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              isOwner ? <Polls roomId={room.id} /> : <PollResponder roomId={room.id} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
