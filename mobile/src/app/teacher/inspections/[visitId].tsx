import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, ClipboardCheck, FileText, MessageSquareWarning, Mic } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { HeroCard, RowItem, RowPill, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { ErrorState, EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
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
        {res.error ? <ErrorState message={res.error.message} onRetry={() => res.mutate()} /> : null}
        {!ev ? (
          <EmptyState icon={ClipboardCheck} title={k('not_available')} />
        ) : (
          <>
            <HeroCard>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row flex-1 items-center gap-2.5">
                  <View className="size-10 items-center justify-center rounded-xl bg-white/15">
                    <Icon as={ClipboardCheck} className="size-5 text-white" />
                  </View>
                  <Text className="flex-1 text-base font-semibold text-white">{k('page_title')}</Text>
                </View>
                {ev.overall_score !== null ? (
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-3xl font-bold text-white">{String(ev.overall_score)}</Text>
                    <Text className="text-xs text-white/80">/ 100</Text>
                  </View>
                ) : null}
              </View>
            </HeroCard>
            {(ev.rubric_template?.categories ?? []).map((cat) => (
              <Panel key={cat.id}>
                <View className="flex-row items-center gap-2 px-4 pb-1 pt-4">
                  <Text className="flex-1 text-base font-semibold">{cat.name}</Text>
                  <StatusChip label={`${cat.weight}%`} tone="info" />
                </View>
                {cat.criteria.map((crit, i) => {
                  const s = scores.get(crit.id);
                  return (
                    <RowItem
                      key={crit.id}
                      title={crit.name}
                      meta={s?.comment || null}
                      last={i === cat.criteria.length - 1}
                      trailing={
                        <View className="bg-info-soft size-9 items-center justify-center rounded-full">
                          <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{s ? String(s.score) : '—'}</Text>
                        </View>
                      }
                    />
                  );
                })}
              </Panel>
            ))}
            {ev.evidence.length ? (
              <Section title={k('evidence_title')}>
                <View className="flex-row flex-wrap gap-2">
                  {ev.evidence.map((e) => (
                    <RowPill key={e.id} icon={e.file_type === 'photo' ? Camera : Mic} label={e.file_name.length > 24 ? `${e.file_name.slice(0, 22)}…` : e.file_name} onPress={() => openEvidence(e.id)} />
                  ))}
                </View>
              </Section>
            ) : null}
            {ev.inspector_notes ? (
              <Section title={k('notes_title')}>
                <Panel className="flex-row gap-3 p-4">
                  <Icon as={FileText} className="text-brand dark:text-brand-secondary mt-0.5 size-4" />
                  <Text className="flex-1 text-sm">{ev.inspector_notes}</Text>
                </Panel>
              </Section>
            ) : null}
            <Button variant="outline" className="border-destructive/30 bg-destructive-soft self-stretch rounded-full" onPress={() => setAppealOpen(true)}>
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
