import type { JcSessionSummary } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/app/bottom-sheet';
import { DataList } from '@/components/app/data-list';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Segmented } from '@/components/app/segmented';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { JcStatusChip, useJcBase } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

/** Exam sessions (web: /admin/exam-control). Admins create sessions; members see the ones they belong to. */
export default function ExamControlSessions() {
  const { t } = useTranslation();
  const { isAdmin, isTeacher, to } = useJcBase();
  const { campusId } = useCampus();
  const cid = isTeacher ? null : (campusId ?? null);
  const list = useApi(['jc', 'sessions', cid ?? 'own'] as const, ([, , c]) => jahbadhControl.sessions(c === 'own' ? null : c));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<'1' | '2' | '3'>('1');
  const [date, setDate] = useState(todayYmd());
  const create = useAction(jahbadhControl.createSession, { success: t('examControl.created') });
  const canCreate = isAdmin && !isTeacher;

  const submit = async () => {
    const res = await create.run({ name, stage: Number(stage), issue_date: date, campus_id: cid });
    const id = res.data?.session.id ?? null;
    if (res.ok && id) {
      setOpen(false);
      setName('');
      list.mutate();
      router.push(to('setup', id));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('examControl.title'),
          headerRight: canCreate
            ? () => (
                <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('examControl.newSession')} className="p-2">
                  <Icon as={Plus} className="text-brand dark:text-brand-secondary size-5" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <DataList
        className="bg-background"
        header={
          <Text variant="muted" className="p-4 pb-2 text-sm">
            {t('examControl.subtitle')}
          </Text>
        }
        items={list.data}
        error={list.error}
        isLoading={list.isLoading}
        isRefreshing={list.isValidating && !list.isLoading}
        onRefresh={() => list.mutate()}
        emptyTitle={canCreate ? t('examControl.noSessionsAdmin') : t('examControl.noSessionsMember')}
        keyExtractor={(s: JcSessionSummary) => s.id}
        renderItem={(s: JcSessionSummary) => (
          <Pressable onPress={() => router.push(to('session', s.id))} accessibilityRole="button" className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
            <IconTile icon={ShieldCheck} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold" numberOfLines={2}>
                {s.name}
              </Text>
              <Text variant="muted" className="text-xs">
                {`${t(`examControl.round_${s.round}`)} · ${t('examControl.stageN', { n: s.stage })} · ${s.issue_date}`}
              </Text>
            </View>
            <JcStatusChip status={s.status} />
          </Pressable>
        )}
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('examControl.newSession')}>
        <View className="gap-3">
          <View className="gap-1.5">
            <Label>{t('examControl.sessionName')}</Label>
            <Input value={name} onChangeText={setName} placeholder={t('examControl.sessionNameHint')} />
          </View>
          <View className="gap-1.5">
            <Label>{t('examControl.stage')}</Label>
            <Segmented value={stage} onChange={setStage} options={(['1', '2', '3'] as const).map((n) => ({ value: n, label: t('examControl.stageN', { n }) }))} />
          </View>
          <DateField label={t('examControl.issueDate')} value={date} onChange={setDate} />
          <Button onPress={submit} disabled={!name.trim() || create.running}>
            <Text>{t('examControl.create')}</Text>
          </Button>
        </View>
      </BottomSheet>
    </>
  );
}
