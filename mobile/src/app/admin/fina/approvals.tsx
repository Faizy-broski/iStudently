import type { FinaPost } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, ShieldCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { GatedImage, NotificationBell, personName, POST_TYPE_META, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

const PRESETS = ['reject_reason_preset_1', 'reject_reason_preset_2', 'reject_reason_preset_3', 'reject_reason_preset_4'];

/** Principal approval queue: approve, or reject with a reason (web: /admin/fina/approvals). */
export default function FinaApprovals() {
  const { f, t } = useFn('moderation');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-approvals', campusId ?? 'school'], () => fina.approvalQueue(campusId));
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<FinaPost | null>(null);
  const [reason, setReason] = useState('');

  async function approve(p: FinaPost) {
    setBusy(p.id);
    try {
      const r = await fina.approvePost(p.id, campusId);
      if (!r.success) return toast.error(r.error || '');
      toast.success(f('action_success'));
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  async function reject() {
    if (!rejecting || !reason.trim()) return;
    setBusy(rejecting.id);
    try {
      const r = await fina.rejectApproval(rejecting.id, reason.trim(), campusId);
      if (!r.success) return toast.error(r.error || '');
      toast.success(f('action_success'));
      setRejecting(null);
      res.mutate();
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('approval_queue_title'), headerRight: () => <NotificationBell /> }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Card>
            <CardContent className="pt-4">
              <Text className="text-muted-foreground text-sm">{f('approval_queue_empty')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((p) => {
            const meta = POST_TYPE_META[p.type];
            return (
              <Card key={p.id}>
                <CardContent className="gap-2 pt-4">
                  <View className="flex-row items-center gap-2">
                    <View className="size-7 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
                      <Icon as={meta.icon} className="size-3.5" color={meta.color} />
                    </View>
                    <Text className="text-xs font-medium" style={{ color: meta.color }}>
                      {t(`fina.posts.type_${p.type}`)}
                    </Text>
                    <Text className="text-muted-foreground flex-1 text-end text-xs">{personName(p.author)}</Text>
                  </View>
                  {p.title ? <Text className="font-semibold">{p.title}</Text> : null}
                  {p.body ? <Text className="text-sm">{p.body}</Text> : null}
                  {p.media.length ? (
                    <View className="flex-row gap-1">
                      {p.media.slice(0, 4).map((m) => (
                        <GatedImage key={m.id} mediaId={m.id} raw thumb className="size-16 rounded" />
                      ))}
                    </View>
                  ) : null}
                  <View className="flex-row items-center gap-1">
                    <Icon as={ShieldCheck} className="size-3.5 text-amber-600" />
                    <Text className="text-xs text-amber-700 dark:text-amber-300">{f('approval_badge')}</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Button size="sm" className="flex-1" onPress={() => approve(p)} disabled={busy === p.id}>
                      <Icon as={Check} className="text-primary-foreground size-4" />
                      <Text>{f('approve_button')}</Text>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onPress={() => {
                        setRejecting(p);
                        setReason('');
                      }}
                      disabled={busy === p.id}>
                      <Icon as={X} className="text-foreground size-4" />
                      <Text>{f('reject_button')}</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="gap-3">
              <DialogHeader>
                <DialogTitle>{f('reject_dialog_title')}</DialogTitle>
              </DialogHeader>
              <View className="flex-row flex-wrap gap-1.5">
                {PRESETS.map((k) => (
                  <Pressable key={k} onPress={() => setReason(f(k))} className="border-border rounded-full border px-3 py-1">
                    <Text className="text-xs">{f(k)}</Text>
                  </Pressable>
                ))}
              </View>
              <Input value={reason} onChangeText={setReason} placeholder={f('reject_reason_placeholder')} multiline numberOfLines={3} className="min-h-20" textAlignVertical="top" />
              <Button onPress={reject} disabled={!reason.trim() || busy === rejecting?.id}>
                <Text>{f('reject_confirm')}</Text>
              </Button>
            </View>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
