import type { AppealStatus } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowUpCircle, Check, Lock, MessageSquare, Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

import { APPEAL_STATUS_CLS } from '../appeals';

const OPEN: AppealStatus[] = ['submitted', 'under_review', 'escalated'];

/** One appeal: review, uphold/deny, escalate, withdraw, comments (web: /admin/inspections/appeals/[id]). */
export default function AppealThread() {
  const { t, i18n } = useTranslation();
  const p = (k: string) => t(`inspections.appeals.${k}`);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const myId = profile?.id ?? null;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const res = useApi(['admin', 'inspection-appeal', id], ([, , aid]) => adminInspections.appeal(aid as string));
  const schoolId = res.data?.school_id ?? null;
  const targets = useApi(isAdmin && schoolId ? ['admin', 'appeal-targets', schoolId] : null, ([, , sid]) => adminInspections.escalationTargets(sid as string));
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [acting, setActing] = useState(false);
  const [resolve, setResolve] = useState<'upheld' | 'denied' | null>(null);
  const [note, setNote] = useState('');
  const [escalate, setEscalate] = useState(false);
  const [targetId, setTargetId] = useState('');

  if (res.isLoading) return <LoadingList rows={3} />;
  const ap = res.data;
  if (!ap) return <ErrorState message={p('appeal_not_found')} onRetry={() => res.mutate()} />;
  const isOwner = myId === ap.teacher_profile_id;
  const isOpen = OPEN.includes(ap.status);
  const [bg, fg] = APPEAL_STATUS_CLS[ap.status];
  const when = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  async function act(promise: Promise<{ success: boolean; error?: string }>, okKey: string | null, after?: () => void) {
    setActing(true);
    try {
      const r = await promise;
      if (!r.success) return toast.error(r.error || t('app.error_title'));
      if (okKey) toast.success(p(okKey));
      after?.();
      res.mutate();
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: p('list_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader className="flex-row items-start gap-2">
            <View className="flex-1">
              <CardTitle>{ap.teacher ? `${ap.teacher.first_name} ${ap.teacher.last_name}` : ''}</CardTitle>
              <CardDescription>{when(ap.created_at)}</CardDescription>
            </View>
            <View className={cn('rounded-full px-2 py-0.5', bg)}>
              <Text className={cn('text-xs', fg)}>{p(`status_${ap.status}`)}</Text>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <View>
              <Text className="text-muted-foreground text-xs">{p('field_reason')}</Text>
              <Text className="mt-1 text-sm">{ap.reason}</Text>
            </View>
            {ap.resolution_note ? (
              <View className="bg-muted rounded-md p-3">
                <Text className="text-muted-foreground text-xs">{p('field_resolution_note')}</Text>
                <Text className="mt-1 text-sm">{ap.resolution_note}</Text>
              </View>
            ) : null}
            {ap.assigned_to ? <Text className="text-muted-foreground text-xs">{`${p('assigned_to_label')}: ${ap.assigned_to.first_name} ${ap.assigned_to.last_name}`}</Text> : null}
            <View className="flex-row flex-wrap gap-2">
              {isAdmin && ap.status === 'submitted' ? (
                <Button size="sm" variant="outline" disabled={acting} onPress={() => act(adminInspections.updateAppealStatus(id, 'under_review'), 'msg_status_updated')}>
                  <Text>{p('btn_start_review')}</Text>
                </Button>
              ) : null}
              {isAdmin && isOpen ? (
                <>
                  <Button size="sm" variant="outline" onPress={() => setResolve('upheld')}>
                    <Icon as={Check} className="size-4 text-green-700" />
                    <Text className="text-green-700">{p('btn_uphold')}</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={() => setResolve('denied')}>
                    <Icon as={X} className="text-destructive size-4" />
                    <Text className="text-destructive">{p('btn_deny')}</Text>
                  </Button>
                  <Button size="sm" variant="outline" onPress={() => setEscalate(true)}>
                    <Icon as={ArrowUpCircle} className="text-foreground size-4" />
                    <Text>{p('btn_escalate')}</Text>
                  </Button>
                </>
              ) : null}
              {isOwner && isOpen ? (
                <Button size="sm" variant="ghost" disabled={acting} onPress={() => act(adminInspections.withdrawAppeal(id), 'msg_withdrawn')}>
                  <Text className="text-destructive">{p('btn_withdraw')}</Text>
                </Button>
              ) : null}
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={MessageSquare} className="size-4 text-[#022172]" />
            <CardTitle>{p('comments_title')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {!ap.comments.length ? <Text variant="muted" className="text-sm">{p('no_comments')}</Text> : null}
            {ap.comments.map((c) => (
              <View key={c.id} className={cn('gap-1 rounded-md border p-2.5', c.is_internal_note ? 'border-amber-200 bg-amber-50' : 'border-border')}>
                <View className="flex-row items-center gap-2">
                  {c.is_internal_note ? (
                    <Badge variant="outline">
                      <Icon as={Lock} className="text-foreground size-2.5" />
                      <Text className="text-[10px]">{p('internal_note_badge')}</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-muted-foreground text-xs">{when(c.created_at)}</Text>
                </View>
                <Text className="text-sm">{c.body}</Text>
              </View>
            ))}
            {isOpen ? (
              <View className="gap-2 pt-2">
                <Textarea value={comment} onChangeText={setComment} placeholder={p('field_comment_placeholder')} className="min-h-16" />
                <View className="flex-row items-center justify-between">
                  {isAdmin ? <CheckRow checked={internal} onPress={() => setInternal((v) => !v)} label={p('field_internal_note')} /> : <View />}
                  <Button
                    size="sm"
                    disabled={acting || !comment.trim()}
                    onPress={() =>
                      act(adminInspections.addAppealComment(id, comment.trim(), internal), null, () => {
                        setComment('');
                        setInternal(false);
                      })
                    }>
                    <Icon as={Send} className="text-primary-foreground size-4" />
                    <Text>{p('btn_post_comment')}</Text>
                  </Button>
                </View>
              </View>
            ) : null}
          </CardContent>
        </Card>
      </ScrollView>

      <Dialog open={!!resolve} onOpenChange={(o) => !o && setResolve(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{resolve === 'upheld' ? p('dialog_uphold_title') : p('dialog_deny_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{p('field_resolution_note')}</Label>
            <Textarea value={note} onChangeText={setNote} className="min-h-20" />
          </View>
          <DialogFooter>
            <Button
              disabled={acting}
              onPress={() =>
                resolve &&
                act(adminInspections.updateAppealStatus(id, resolve, note.trim() || undefined), 'msg_resolved', () => {
                  setResolve(null);
                  setNote('');
                })
              }>
              <Text>{p('btn_confirm')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={escalate} onOpenChange={setEscalate}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('dialog_escalate_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{p('field_escalate_to')}</Label>
            <Picker value={targetId} onChange={setTargetId} placeholder={p('field_escalate_placeholder')} options={(targets.data ?? []).map((x) => ({ value: x.id, label: `${x.first_name} ${x.last_name} (${x.role})` }))} />
          </View>
          <DialogFooter>
            <Button
              disabled={acting || !targetId}
              onPress={() =>
                act(adminInspections.escalateAppeal(id, targetId), 'msg_escalated', () => {
                  setEscalate(false);
                  setTargetId('');
                })
              }>
              <Icon as={ArrowUpCircle} className="text-primary-foreground size-4" />
              <Text>{p('btn_confirm_escalate')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
