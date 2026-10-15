import type { GrievanceAttachment, GrievanceStatus } from '@studently/api-client';
import { Clock, Paperclip, Send, ShieldAlert, Star, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow } from '@/features/admin/attendance';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { isOverdue, OutlinePill, OverduePill, PriorityPill, StatusPill } from '@/features/grievances/ui';
import { complaints, messaging } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: GrievanceStatus[] = ['pending_review', 'assigned', 'under_investigation', 'awaiting_info', 'resolved', 'closed', 'rejected'];

function Attachments({ grievanceId, items }: { grievanceId: string; items: GrievanceAttachment[] }) {
  const toast = useToast();
  const { t } = useTranslation();
  async function open(a: GrievanceAttachment) {
    const res = await complaints.getAttachmentUrl(grievanceId, a.id);
    if (!res.success || !res.data) return toast.error(res.error || t('app.error_title'));
    Linking.openURL(res.data.url);
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((a) => (
        <Pressable key={a.id} onPress={() => open(a)} className="bg-muted flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5">
          <Icon as={Paperclip} className="text-muted-foreground size-3.5" />
          <Text className="max-w-48 text-xs" numberOfLines={1}>
            {a.file_name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** One complaint: details, management actions, conversation and reply (web: GrievanceThread). */
export function GrievanceThreadScreen({ grievanceId }: { grievanceId: string }) {
  const { t, i18n } = useTranslation();
  const th = (k: string, o?: Record<string, unknown>) => t(`grievances.thread.${k}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const myId = profile?.id ?? null;
  const isAdminRole = profile?.role === 'admin' || profile?.role === 'super_admin';
  const { campusId } = useCampus();
  const detail = useApi(['grievance', grievanceId], ([, id]) => complaints.get(id as string));
  const staff = useApi(isAdminRole ? ['grievance-staff', campusId ?? 'school'] : null, () => messaging.listRecipients('staff', { campusId }));
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [posting, setPosting] = useState(false);
  const [rating, setRating] = useState(0);
  const [assignee, setAssignee] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [assigning, setAssigning] = useState(false);

  if (detail.isLoading) return <LoadingList rows={4} />;
  const g = detail.data;
  if (!g) return <ErrorState message={detail.error?.message ?? th('not_found')} onRetry={() => detail.mutate()} />;

  const date = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
  const isOwner = g.submitter_profile_id === myId;
  const reload = () => detail.mutate();

  async function act(promise: Promise<{ success: boolean; error?: string }>, okKey: string, errKey: string) {
    const res = await promise;
    if (!res.success) return toast.error(res.error || th(errKey));
    toast.success(th(okKey));
    reload();
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setPosting(true);
    try {
      const res = await complaints.addComment(grievanceId, reply, internal);
      if (!res.success || !res.data) return toast.error(res.error || th('err_reply_failed'));
      for (const f of files) {
        const up = await complaints.uploadAttachmentFile(grievanceId, f, res.data.id);
        if (!up.success) toast.error(th('err_upload_failed', { name: f.name, error: up.error || '' }));
      }
      toast.success(internal ? th('msg_internal_note_added') : th('msg_reply_sent'));
      setReply('');
      setFiles([]);
      setInternal(false);
      reload();
    } finally {
      setPosting(false);
    }
  }

  async function assign() {
    if (!assignee) return;
    setAssigning(true);
    try {
      const res = await complaints.assign(grievanceId, assignee, roleLabel || undefined);
      if (!res.success) return toast.error(res.error || th('err_assign_failed'));
      toast.success(th('msg_assigned'));
      setAssignee('');
      setRoleLabel('');
      reload();
    } finally {
      setAssigning(false);
    }
  }

  async function feedback(n: number) {
    setRating(n);
    const res = await complaints.submitFeedback(grievanceId, n);
    if (res.success) toast.success(th('msg_feedback_thanks'));
    else toast.error(res.error || th('err_feedback_failed'));
  }

  const rootFiles = g.attachments.filter((a) => !a.comment_id);

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <Card>
        <CardHeader className="gap-2">
          <Text className="text-muted-foreground font-mono text-xs">{g.complaint_number}</Text>
          <CardTitle className="text-xl">{g.title}</CardTitle>
          <View className="flex-row flex-wrap gap-2">
            <PriorityPill priority={g.priority} />
            {g.is_confidential ? (
              <View className="border-border flex-row items-center gap-1 rounded-full border px-2 py-0.5">
                <Icon as={ShieldAlert} className="text-foreground size-3" />
                <Text className="text-xs">{t('grievances.list.confidential')}</Text>
              </View>
            ) : null}
            {g.is_anonymous ? <OutlinePill label={t('grievances.list.anonymous')} /> : null}
            {isOverdue(g) ? <OverduePill /> : null}
            <StatusPill status={g.status} />
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          <Text className="text-sm">{g.description}</Text>
          <View className="gap-1">
            {g.category?.name ? <Text className="text-muted-foreground text-sm">{th('category_label', { name: g.category.name })}</Text> : null}
            {g.department ? <Text className="text-muted-foreground text-sm">{th('department_label', { name: g.department })}</Text> : null}
            <Text className="text-muted-foreground text-sm">{th('submitted_label', { date: date(g.submitted_at) })}</Text>
            {g.due_date ? (
              <View className="flex-row items-center gap-1">
                <Icon as={Clock} className="text-muted-foreground size-3.5" />
                <Text className="text-muted-foreground text-sm">{th('due_label', { date: date(g.due_date) })}</Text>
              </View>
            ) : null}
          </View>
          {rootFiles.length ? (
            <View className="gap-2">
              <Text className="text-sm font-medium">{th('attachments')}</Text>
              <Attachments grievanceId={grievanceId} items={rootFiles} />
            </View>
          ) : null}
          {g.can_manage ? (
            <View className="border-border gap-2 border-t pt-3">
              <Picker value={g.status} onChange={(v) => act(complaints.updateStatus(grievanceId, v as GrievanceStatus), 'msg_status_updated', 'err_status_failed')} options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`grievances.status.${s}`) }))} />
              <Button variant="outline" size="sm" className="self-start" onPress={() => act(complaints.escalate(grievanceId), 'msg_escalated', 'err_escalate_failed')}>
                <Text>{th('btn_escalate')}</Text>
              </Button>
            </View>
          ) : null}
          {isAdminRole ? (
            <View className="border-border gap-2 border-t pt-3">
              <Text className="text-muted-foreground text-xs">{th('assign_to')}</Text>
              <Picker value={assignee} onChange={setAssignee} placeholder={th('select_staff_placeholder')} options={(staff.data ?? []).map((s) => ({ value: s.profileId, label: s.subtitle ? `${s.name} (${s.subtitle})` : s.name }))} />
              <Text className="text-muted-foreground text-xs">{th('role_label_label')}</Text>
              <Input value={roleLabel} onChangeText={setRoleLabel} placeholder={th('role_label_placeholder')} />
              <Button size="sm" className="self-start" onPress={assign} disabled={assigning || !assignee}>
                <Text>{th('btn_assign')}</Text>
              </Button>
            </View>
          ) : null}
          {isOwner && ['resolved', 'closed'].includes(g.status) ? (
            <View className="border-border gap-2 border-t pt-3">
              <Button variant="outline" size="sm" className="self-start" onPress={() => act(complaints.reopen(grievanceId), 'msg_reopened', 'err_reopen_failed')}>
                <Text>{th('btn_reopen')}</Text>
              </Button>
              <Text className="text-sm font-medium">{th('rate_resolution')}</Text>
              <View className="flex-row gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => feedback(n)} hitSlop={6} accessibilityLabel={String(n)}>
                    <Icon as={Star} className={cn('size-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{th('conversation_title')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          {g.comments.length === 0 ? <Text variant="muted" className="text-sm">{th('no_replies')}</Text> : null}
          {g.comments.map((c) => {
            const atts = g.attachments.filter((a) => a.comment_id === c.id);
            return (
              <View key={c.id} className={cn('gap-1 rounded-lg p-3', c.is_internal_note ? 'border border-amber-200 bg-amber-50' : 'bg-muted/40')}>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-xs font-medium">{c.author_profile_id === myId ? th('you') : th('staff')}</Text>
                  {c.is_internal_note ? (
                    <Badge variant="outline">
                      <Text className="text-[10px]">{th('internal_note_badge')}</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-muted-foreground text-xs">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(c.created_at))}</Text>
                </View>
                <Text className="text-sm">{c.body}</Text>
                {atts.length ? <Attachments grievanceId={grievanceId} items={atts} /> : null}
              </View>
            );
          })}
          <Separator />
          <Textarea value={reply} onChangeText={setReply} placeholder={th('reply_placeholder')} className="min-h-20" />
          {files.length ? (
            <View className="flex-row flex-wrap gap-2">
              {files.map((f, i) => (
                <View key={`${f.uri}-${i}`} className="bg-muted flex-row items-center gap-1 rounded px-2 py-1">
                  <Text className="max-w-40 text-xs" numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Pressable onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} hitSlop={6}>
                    <Icon as={X} className="text-muted-foreground size-3" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-3">
              <Button variant="outline" size="sm" onPress={async () => setFiles([...files, ...(await pickDocuments())])}>
                <Icon as={Upload} className="text-foreground size-3.5" />
                <Text>{th('btn_attach')}</Text>
              </Button>
              {g.can_manage ? <CheckRow checked={internal} onPress={() => setInternal((v) => !v)} label={th('internal_note_checkbox')} /> : null}
            </View>
            <Button size="sm" onPress={sendReply} disabled={posting || !reply.trim()}>
              <Icon as={Send} className="text-primary-foreground size-4" />
              <Text>{th('btn_send')}</Text>
            </Button>
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
