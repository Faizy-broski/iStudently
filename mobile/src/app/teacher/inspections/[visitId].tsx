import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, MessageSquareWarning, Mic, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The teacher's evaluation for one visit: rubric scores, evidence, notes, file an appeal (web: /teacher/inspections/[visitId]). */
export default function TeacherInspectionEvaluation() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.teacherView.${key}`);
  const toast = useToast();
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const res = useApi(visitId ? ['teacher', 'inspection-evaluation', visitId] : null, ([, , v]) => teacherInspections.evaluationForVisit(v as string));
  const [appealOpen, setAppealOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ev = res.data ?? null;

  async function openEvidence(evidenceId: string) {
    const r = await teacherInspections.evidenceUrl(evidenceId);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    await WebBrowser.openBrowserAsync(r.data.url);
  }

  async function fileAppeal() {
    if (!ev || !reason.trim()) return;
    setBusy(true);
    const r = await teacherInspections.createAppeal(ev.id, reason.trim());
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_appeal_filed'));
    setAppealOpen(false);
    router.replace({ pathname: '/teacher/inspections/appeals/[id]', params: { id: r.data.id } });
  }

  if (res.isLoading) return <LoadingList rows={5} />;
  const scores = new Map((ev?.scores ?? []).map((s) => [s.criterion_id, s]));
  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.error ? <Text className="text-destructive text-sm">{res.error.message}</Text> : null}
        {!ev ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{k('not_available')}</Text>
        ) : (
          <>
            <Card>
              <CardContent className="flex-row items-center justify-between p-4">
                <Text className="text-lg font-semibold">{k('page_title')}</Text>
                {ev.overall_score !== null ? (
                  <View className="flex-row items-center gap-1">
                    <Icon as={TrendingUp} className="size-4 text-[#022172] dark:text-blue-300" />
                    <Text className="text-xl font-bold">{String(ev.overall_score)}</Text>
                    <Text className="text-muted-foreground text-xs">/ 100</Text>
                  </View>
                ) : null}
              </CardContent>
            </Card>
            {(ev.rubric_template?.categories ?? []).map((cat) => (
              <Card key={cat.id}>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <CardTitle className="text-base">{cat.name}</CardTitle>
                    <Badge variant="outline">
                      <Text className="text-[10px]">{`${cat.weight}%`}</Text>
                    </Badge>
                  </View>
                </CardHeader>
                <CardContent className="gap-3">
                  {cat.criteria.map((crit) => {
                    const s = scores.get(crit.id);
                    return (
                      <View key={crit.id} className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="text-sm font-medium">{crit.name}</Text>
                          {s?.comment ? <Text className="text-muted-foreground text-xs">{s.comment}</Text> : null}
                        </View>
                        <View className="size-8 items-center justify-center rounded-full bg-[#022172]/10">
                          <Text className="text-sm font-semibold text-[#022172] dark:text-blue-300">{s ? String(s.score) : '—'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
            {ev.evidence.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{k('evidence_title')}</CardTitle>
                </CardHeader>
                <CardContent className="flex-row flex-wrap gap-2">
                  {ev.evidence.map((e) => (
                    <Button key={e.id} size="sm" variant="outline" onPress={() => openEvidence(e.id)}>
                      <Icon as={e.file_type === 'photo' ? Camera : Mic} className="size-3" />
                      <Text className="max-w-[140px]" numberOfLines={1}>
                        {e.file_name}
                      </Text>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            {ev.inspector_notes ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{k('notes_title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="text-sm">{ev.inspector_notes}</Text>
                </CardContent>
              </Card>
            ) : null}
            <Button variant="outline" className="self-end" onPress={() => setAppealOpen(true)}>
              <Icon as={MessageSquareWarning} className="text-destructive size-4" />
              <Text className="text-destructive">{k('btn_file_appeal')}</Text>
            </Button>
          </>
        )}
      </ScrollView>
      <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{k('dialog_appeal_title')}</DialogTitle>
            <DialogDescription>{k('dialog_appeal_desc')}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChangeText={setReason} placeholder={k('field_appeal_reason_placeholder')} numberOfLines={4} />
          <DialogFooter>
            <Button onPress={fileAppeal} disabled={busy || !reason.trim()}>
              <Icon as={MessageSquareWarning} className="text-primary-foreground size-4" />
              <Text>{k('btn_submit_appeal')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
