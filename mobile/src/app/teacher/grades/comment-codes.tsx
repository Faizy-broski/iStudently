import type { TeacherCommentCode, TeacherCommentCodeScale } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Lock, MessageSquareText, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { IconTile, RowActions, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type ScaleForm = { id?: string; title: string; comment: string };
type CodeForm = { id?: string; scaleId?: string; title: string; short: string; comment: string };

/** School-wide comment code scales (read-only) and the teacher's own scales and codes (web: /teacher/grades/comment-codes). */
export default function TeacherCommentCodes() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.commentCodes.${key}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const res = useApi(['teacher', 'comment-codes'], () => teacher.commentCodes());
  const [open, setOpen] = useState<string | null>(null);
  const [scaleForm, setScaleForm] = useState<ScaleForm | null>(null);
  const [codeForm, setCodeForm] = useState<CodeForm | null>(null);
  const [busy, setBusy] = useState(false);
  const scales = res.data ?? [];

  async function saveScale() {
    if (!scaleForm?.title.trim()) return;
    setBusy(true);
    const body = { title: scaleForm.title.trim(), comment: scaleForm.comment.trim() || undefined };
    const r = scaleForm.id ? await teacher.updateCommentScale(scaleForm.id, { title: body.title, comment: body.comment ?? null }) : await teacher.createCommentScale(body);
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('saveScaleFailed'));
    toast.success(k(scaleForm.id ? 'scaleUpdated' : 'scaleCreated'));
    setScaleForm(null);
    res.mutate();
  }
  async function deleteScale(s: TeacherCommentCodeScale) {
    if (!(await confirm({ title: k('deleteScale'), body: s.title, destructive: true, confirmLabel: k('delete') }))) return;
    const r = await teacher.deleteCommentScale(s.id);
    if (!r.success) return toast.error(r.error || k('deleteScaleFailed'));
    toast.success(k('scaleDeleted'));
    res.mutate();
  }
  async function saveCode() {
    if (!codeForm?.title.trim()) return;
    setBusy(true);
    const r = codeForm.id
      ? await teacher.updateCommentCode(codeForm.id, { title: codeForm.title.trim(), short_name: codeForm.short.trim() || null, comment: codeForm.comment.trim() || null })
      : await teacher.createCommentCode(codeForm.scaleId ?? '', { title: codeForm.title.trim(), short_name: codeForm.short.trim() || undefined, comment: codeForm.comment.trim() || undefined });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('saveCodeFailed'));
    toast.success(k(codeForm.id ? 'codeUpdated' : 'codeAdded'));
    setCodeForm(null);
    res.mutate();
  }
  async function deleteCode(c: TeacherCommentCode) {
    if (!(await confirm({ title: k('delete'), body: c.title, destructive: true, confirmLabel: k('delete') }))) return;
    const r = await teacher.deleteCommentCode(c.id);
    if (!r.success) return toast.error(r.error || k('deleteCodeFailed'));
    toast.success(k('codeDeleted'));
    res.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{k('pageSubtitle')}</Text>
          <Button size="sm" onPress={() => setScaleForm({ title: '', comment: '' })}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('newScale')}</Text>
          </Button>
        </View>
        <Section title={k('commentCodeScales')}>
          {res.isLoading ? (
            <LoadingList rows={3} />
          ) : !scales.length ? (
            <EmptyState icon={MessageSquareText} title={k('noScalesYet')} actionLabel={k('createFirstScale')} onAction={() => setScaleForm({ title: '', comment: '' })} />
          ) : (
            scales.map((s) => {
              const mine = !!s.staff_id;
              const codes = [...(s.codes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
              const expanded = open === s.id;
              return (
                <Panel key={s.id} className="overflow-hidden">
                  <View className="flex-row items-center gap-3 px-4 py-3">
                    <Pressable onPress={() => setOpen(expanded ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded }} className="flex-1 flex-row items-center gap-3 active:opacity-70">
                      <IconTile icon={mine ? MessageSquareText : Lock} tone={mine ? 'brand' : 'muted'} size={40} />
                      <View className="flex-1 gap-1">
                        <Text className="text-sm font-semibold">{s.title}</Text>
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          {!mine ? <StatusChip label={k('schoolWide')} tone="muted" /> : null}
                          <Text className="text-muted-foreground text-xs">{k('codeCount', { count: codes.length })}</Text>
                        </View>
                      </View>
                      <Icon flipRtl as={expanded ? ChevronDown : ChevronRight} className="text-muted-foreground size-4" />
                    </Pressable>
                  </View>
                  {mine ? (
                    <View className="px-4 pb-3">
                      <RowActions onEdit={() => setScaleForm({ id: s.id, title: s.title, comment: s.comment ?? '' })} onDelete={() => deleteScale(s)} editLabel={k('editScale')} deleteLabel={k('deleteScale')}>
                        <Pressable onPress={() => setCodeForm({ scaleId: s.id, title: '', short: '', comment: '' })} hitSlop={4} accessibilityRole="button" accessibilityLabel={k('addCode')} className="bg-success-soft size-9 items-center justify-center rounded-full active:opacity-70">
                          <Icon as={Plus} className="text-success size-4" />
                        </Pressable>
                      </RowActions>
                    </View>
                  ) : null}
                  {expanded ? (
                    <View className="border-info-soft dark:border-border bg-muted/30 border-t">
                      {!codes.length ? (
                        <View className="items-center gap-2 py-4">
                          <Text className="text-muted-foreground text-sm">{k('noCodesYet')}</Text>
                          {mine ? (
                            <Button size="sm" variant="outline" onPress={() => setCodeForm({ scaleId: s.id, title: '', short: '', comment: '' })}>
                              <Text>{k('addFirstCode')}</Text>
                            </Button>
                          ) : null}
                        </View>
                      ) : (
                        codes.map((c, i) => (
                          <View key={c.id} className={cn('flex-row items-center gap-3 px-4 py-2.5', i < codes.length - 1 && 'border-info-soft dark:border-border border-b')}>
                            <View className="bg-info-soft min-w-10 items-center rounded-lg px-2 py-1">
                              <Text className="text-brand dark:text-brand-secondary font-mono text-xs font-bold">{c.short_name || '—'}</Text>
                            </View>
                            <View className="flex-1">
                              <Text className="text-sm font-medium">{c.title}</Text>
                              {c.comment ? <Text className="text-muted-foreground text-xs">{c.comment}</Text> : null}
                            </View>
                            {mine ? <RowActions onEdit={() => setCodeForm({ id: c.id, title: c.title, short: c.short_name ?? '', comment: c.comment ?? '' })} onDelete={() => deleteCode(c)} editLabel={k('edit')} deleteLabel={k('delete')} /> : null}
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </Panel>
              );
            })
          )}
        </Section>
      </ScrollView>

      <Dialog open={!!scaleForm} onOpenChange={(v) => !v && setScaleForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{scaleForm?.id ? k('editScale') : k('newCommentCodeScale')}</DialogTitle>
          </DialogHeader>
          {scaleForm ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{k('title')}</Label>
                <Input value={scaleForm.title} onChangeText={(v) => setScaleForm({ ...scaleForm, title: v })} placeholder={k('scaleTitlePlaceholder')} />
              </View>
              <View className="gap-1.5">
                <Label>{k('descriptionOptional')}</Label>
                <Input value={scaleForm.comment} onChangeText={(v) => setScaleForm({ ...scaleForm, comment: v })} placeholder={k('shortDescription')} />
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setScaleForm(null)}>
                  <Text>{k('cancel')}</Text>
                </Button>
                <Button onPress={saveScale} disabled={busy || !scaleForm.title.trim()}>
                  <Text>{scaleForm.id ? k('saveChanges') : k('createScale')}</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!codeForm} onOpenChange={(v) => !v && setCodeForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{codeForm?.id ? k('editCode') : k('addCommentCode')}</DialogTitle>
          </DialogHeader>
          {codeForm ? (
            <View className="gap-3">
              <View className="flex-row gap-2">
                <View className="w-24 gap-1.5">
                  <Label>{k('shortCode')}</Label>
                  <Input value={codeForm.short} onChangeText={(v) => setCodeForm({ ...codeForm, short: v })} placeholder={k('shortCodePlaceholder')} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{k('title')}</Label>
                  <Input value={codeForm.title} onChangeText={(v) => setCodeForm({ ...codeForm, title: v })} placeholder={k('codeTitlePlaceholder')} />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{k('description')}</Label>
                <Input value={codeForm.comment} onChangeText={(v) => setCodeForm({ ...codeForm, comment: v })} placeholder={k('expandedDescription')} />
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setCodeForm(null)}>
                  <Text>{k('cancel')}</Text>
                </Button>
                <Button onPress={saveCode} disabled={busy || !codeForm.title.trim()}>
                  <Text>{codeForm.id ? k('saveChanges') : k('addCode')}</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
