import { router, Stack, type Href } from 'expo-router';
import { Lock, MessageCircle, Plus, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { ListRow } from '@/components/app/list-row';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { personName, useFinaViewer, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type ThreadRole = 'admin' | 'parent' | 'teacher';

/**
 * Teacher–guardian conversations (web: ThreadList). Guardians start one by picking a child then a
 * teacher; teachers pick a student then a guardian; admins read only.
 */
export function ThreadListScreen({ role, detail }: { role: ThreadRole; detail: (id: string) => Href }) {
  const { f } = useFn('threads');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['portal', 'fina-threads', role, campusId ?? 'school'], () => fina.threads(role === 'admin' ? campusId : undefined));
  const [picker, setPicker] = useState(false);
  const wards = useApi(picker && role !== 'admin' ? ['portal', 'fina-thread-wards', role] : null, () => (role === 'teacher' ? fina.threadStudents() : fina.threadWards()));
  const [ward, setWard] = useState<string | null>(null);
  const contacts = useApi(ward ? ['portal', 'fina-thread-contacts', ward] : null, ([, , w]) => fina.threadContacts(w as string));
  const [busy, setBusy] = useState(false);
  const list = res.data ?? [];

  async function start(contactId: string) {
    if (!ward) return;
    setBusy(true);
    const r = await fina.openThread(role === 'teacher' ? { guardian_profile_id: contactId, student_id: ward } : { teacher_profile_id: contactId, student_id: ward });
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || 'Failed');
    setPicker(false);
    res.mutate();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: f('page_title'),
          headerRight:
            role === 'admin'
              ? undefined
              : () => (
                  <Pressable
                    onPress={() => {
                      setWard(null);
                      setPicker(true);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={f('new_button')}>
                    <Icon as={Plus} className="text-foreground size-6" />
                  </Pressable>
                ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={MessageCircle} title={f('empty')} />
        ) : (
          <Card>
            <CardContent className="py-1">
              {list.map((th) => {
                const counterpart = role === 'teacher' ? th.guardian : th.teacher;
                return (
                  <ListRow
                    key={th.id}
                    title={personName(counterpart) || '—'}
                    subtitle={role === 'admin' ? [personName(th.guardian), personName(th.student?.profile)].filter(Boolean).join(' · ') : personName(th.student?.profile)}
                    onPress={() => router.push(detail(th.id))}
                  />
                );
              })}
            </CardContent>
          </Card>
        )}
      </ScrollView>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{f('new_button')}</DialogTitle>
          </DialogHeader>
          <View className="gap-3">
            <Text className="text-muted-foreground text-xs">{role === 'teacher' ? f('pick_student') : f('pick_child')}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {(wards.data ?? []).map((w) => (
                <Pressable key={w.id} onPress={() => setWard(w.id)} accessibilityRole="radio" accessibilityState={{ checked: ward === w.id }} className={cn('rounded-full border px-3 py-1', ward === w.id ? 'border-brand bg-brand' : 'border-border')}>
                  <Text className={cn('text-xs', ward === w.id && 'text-white')}>{w.name}</Text>
                </Pressable>
              ))}
            </View>
            {ward ? (
              <>
                <Text className="text-muted-foreground text-xs">{role === 'teacher' ? f('pick_guardian') : f('pick_teacher')}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {(contacts.data ?? []).map((c) => (
                    <Pressable key={c.id} onPress={() => start(c.id)} disabled={busy} accessibilityRole="button" className="border-border rounded-full border px-3 py-1">
                      <Text className="text-xs">{c.name}</Text>
                    </Pressable>
                  ))}
                  {!contacts.isLoading && !(contacts.data ?? []).length ? <Text className="text-muted-foreground text-xs">{role === 'teacher' ? f('no_guardians') : f('no_teachers')}</Text> : null}
                </View>
              </>
            ) : null}
            <Button variant="outline" onPress={() => setPicker(false)}>
              <Text>{f('cancel_button')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}

/** One conversation (web: ThreadView); `canSend` false for admins. */
export function ThreadScreen({ id, canSend }: { id: string; canSend: boolean }) {
  const { f, lang } = useFn('threads');
  const toast = useToast();
  const { campusId } = useCampus();
  const { profileId } = useFinaViewer();
  const res = useApi(id ? ['portal', 'fina-thread', id] : null, ([, , th]) => fina.messages(th as string, canSend ? undefined : campusId));
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const r = await fina.sendMessage(id, body.trim());
    setSending(false);
    if (!r.success) return toast.error(r.error || '');
    setBody('');
    res.mutate();
  }

  return (
    <KeyboardAvoidingView className="bg-background flex-1" keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: f('page_title') }} />
      <View className="flex-row items-center gap-2 bg-warning-soft px-4 py-2 ">
        <Icon as={Lock} className="size-3.5 text-warning " />
        <Text className="flex-1 text-xs text-warning ">{f('archived_banner')}</Text>
      </View>
      <ScrollView contentContainerClassName="gap-2 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : (
          (res.data ?? []).map((m) => {
            const own = m.sender_id === profileId;
            return (
              <View key={m.id} className={cn('max-w-[85%] gap-0.5', own ? 'self-end' : 'self-start')}>
                <Text className={cn('text-muted-foreground text-[11px]', own && 'text-end')}>
                  {personName(m.sender)} · {new Date(m.created_at).toLocaleString(lang)}
                </Text>
                <View className={cn('rounded-2xl px-3 py-2', own ? 'bg-brand' : 'bg-muted')}>
                  <Text className={cn('text-sm', own && 'text-white')}>{m.body}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      {canSend ? (
        <View className="border-border flex-row items-center gap-2 border-t p-3">
          <Input className="flex-1" value={body} onChangeText={setBody} placeholder={f('write_placeholder')} onSubmitEditing={send} returnKeyType="send" />
          <Button size="icon" onPress={send} disabled={sending || !body.trim()} accessibilityLabel={f('write_placeholder')}>
            <Icon as={Send} className="text-primary-foreground size-4" />
          </Button>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
