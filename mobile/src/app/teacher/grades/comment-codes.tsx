import type { TeacherCommentCode, TeacherCommentCodeScale } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

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
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Button className="self-start" onPress={() => setScaleForm({ title: '', comment: '' })}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{k('newScale')}</Text>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{k('commentCodeScales')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {res.isLoading ? (
              <LoadingList rows={3} />
            ) : !scales.length ? (
              <View className="items-center gap-2 py-6">
                <Text className="text-muted-foreground text-sm">{k('noScalesYet')}</Text>
                <Button variant="outline" size="sm" onPress={() => setScaleForm({ title: '', comment: '' })}>
                  <Text>{k('createFirstScale')}</Text>
                </Button>
              </View>
            ) : (
              scales.map((s) => {
                const mine = !!s.staff_id;
                const codes = [...(s.codes ?? [])].sort((a, b) => a.sort_order - b.sort_order);
                const expanded = open === s.id;
                return (
                  <View key={s.id} className="border-border overflow-hidden rounded-lg border">
                    <View className="flex-row items-center gap-2 px-3 py-2.5">
                      <Pressable onPress={() => setOpen(expanded ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded }} className="flex-1 flex-row items-center gap-2">
                        <Icon as={expanded ? ChevronDown : ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
                        <Text className="font-medium">{s.title}</Text>
                        {!mine ? (
                          <Badge variant="secondary" className="flex-row items-center gap-1">
                            <Icon as={Lock} className="text-foreground size-3" />
                            <Text className="text-xs">{k('schoolWide')}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-xs">{k('codeCount', { count: codes.length })}</Text>
                      </Pressable>
                      {mine ? (
                        <>
                          <Pressable onPress={() => setCodeForm({ scaleId: s.id, title: '', short: '', comment: '' })} hitSlop={6} className="p-1" accessibilityLabel={k('addCode')}>
                            <Icon as={Plus} className="text-primary size-4" />
                          </Pressable>
                          <Pressable onPress={() => setScaleForm({ id: s.id, title: s.title, comment: s.comment ?? '' })} hitSlop={6} className="p-1" accessibilityLabel={k('editScale')}>
                            <Icon as={Pencil} className="text-muted-foreground size-4" />
                          </Pressable>
                          <Pressable onPress={() => deleteScale(s)} hitSlop={6} className="p-1" accessibilityLabel={k('deleteScale')}>
                            <Icon as={Trash2} className="text-destructive size-4" />
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                    {expanded ? (
                      <View className="border-border bg-muted/30 border-t px-3 py-2">
                        {!codes.length ? (
                          <View className="items-center gap-2 py-3">
                            <Text className="text-muted-foreground text-sm">{k('noCodesYet')}</Text>
                            {mine ? (
                              <Button size="sm" variant="outline" onPress={() => setCodeForm({ scaleId: s.id, title: '', short: '', comment: '' })}>
                                <Text>{k('addFirstCode')}</Text>
                              </Button>
                            ) : null}
                          </View>
                        ) : (
                          codes.map((c) => (
                            <View key={c.id} className="border-border flex-row items-center gap-2 border-b py-2 last:border-b-0">
                              <Text className="w-10 font-mono text-sm font-semibold">{c.short_name || '—'}</Text>
                              <View className="flex-1">
                                <Text className="text-sm">{c.title}</Text>
                                {c.comment ? <Text className="text-muted-foreground text-xs">{c.comment}</Text> : null}
                              </View>
                              {mine ? (
                                <>
                                  <Pressable onPress={() => setCodeForm({ id: c.id, title: c.title, short: c.short_name ?? '', comment: c.comment ?? '' })} hitSlop={6} className="p-1" accessibilityLabel={k('edit')}>
                                    <Icon as={Pencil} className="text-muted-foreground size-3.5" />
                                  </Pressable>
                                  <Pressable onPress={() => deleteCode(c)} hitSlop={6} className="p-1" accessibilityLabel={k('delete')}>
                                    <Icon as={Trash2} className="text-destructive size-3.5" />
                                  </Pressable>
                                </>
                              ) : null}
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
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
