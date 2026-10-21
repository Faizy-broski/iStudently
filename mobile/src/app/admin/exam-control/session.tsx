import { JC_STATUSES, jcSteps, type JcStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CheckCircle2, ChevronLeft, Circle, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { JcError, JcStatusChip, MiniTile, Note, useJcBase, useOverview, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useAction } from '@/lib/use-action';

/** Session home (web: /admin/exam-control?session=…): status, counts and the workflow checklist. */
export default function ExamControlSession() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const id = useSessionId();
  const { to, base } = useJcBase();
  const ov = useOverview(id);
  const o = ov.data;
  const update = useAction(jahbadhControl.updateSession, { success: t('examControl.saved') });
  const remove = useAction(jahbadhControl.deleteSession, { success: t('examControl.deleted') });

  const setStatus = async (status: string) => {
    if (!id) return;
    const res = await update.run(id, { status: status as JcStatus });
    if (res.ok) ov.mutate(res.data, { revalidate: false });
  };
  const del = async () => {
    if (!id) return;
    if (!(await confirm({ title: t('examControl.deleteSession'), body: t('examControl.confirmDeleteSession'), destructive: true }))) return;
    if ((await remove.run(id)).ok) router.replace(base as never);
  };

  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  const c = o.counts;
  const r = o.rights;

  return (
    <>
      <Stack.Screen
        options={{
          title: o.session.name,
          headerRight: r.chief
            ? () => (
                <Pressable onPress={del} accessibilityRole="button" accessibilityLabel={t('examControl.deleteSession')} className="p-2">
                  <Icon as={Trash2} className="text-destructive size-5" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="flex-row flex-wrap items-center gap-2">
          <JcStatusChip status={o.session.status} />
          <Text variant="muted" className="text-xs">
            {`${t(`examControl.round_${o.session.round}`)} · ${t('examControl.stageN', { n: o.session.stage })} · ${t('examControl.sessionCode')} ${o.session.session_code}`}
          </Text>
          {r.unmasked ? <Icon as={ShieldCheck} className="text-success size-4" /> : null}
        </View>
        {r.manage ? (
          <Picker value={o.session.status} onChange={setStatus} options={JC_STATUSES.map((s) => ({ value: s, label: t(`examControl.status_${s}`) }))} />
        ) : (
          <Note text={t('examControl.memberRoles', { roles: r.roles.map((x) => t(`examControl.role_${x}`)).join('، ') || t('examControl.role_chief') })} />
        )}
        {!r.unmasked && r.entry && !r.manage ? <Note tone="warning" text={t('examControl.blindNote')} /> : null}
        {r.manage ? (
          <View className="flex-row flex-wrap gap-2">
            <MiniTile label={t('examControl.count_participating')} value={c.participating} tone="success" />
            <MiniTile label={t('examControl.count_numbered')} value={`${c.numbered}/${c.participating}`} tone={c.numbered === c.participating ? 'success' : 'warning'} />
            <MiniTile label={t('examControl.count_placed')} value={`${c.placed}/${c.participating}`} tone={c.placed === c.participating ? 'success' : 'warning'} />
            <MiniTile label={t('examControl.count_committees')} value={c.committees} />
            <MiniTile label={t('examControl.count_capacity')} value={c.capacity} tone={c.capacity >= c.participating ? 'success' : 'destructive'} />
            <MiniTile label={t('examControl.count_special')} value={c.special} />
          </View>
        ) : null}
        <FormSection title={t('examControl.workflow')}>
          {jcSteps(o).map((s, i) => (
            <Pressable key={s.key} onPress={() => router.push(to(s.area, id))} accessibilityRole="button" className="flex-row items-center gap-3 py-1.5 active:opacity-70">
              <Icon as={s.done ? CheckCircle2 : Circle} className={s.done ? 'text-success size-5' : s.done === false ? 'text-warning size-5' : 'text-muted-foreground size-5'} />
              <Text variant="muted" className="w-5 text-xs">
                {String(i + 1)}
              </Text>
              <View className="flex-1">
                <Text className="text-sm font-medium">{t(`examControl.step_${s.key}`)}</Text>
                <Text variant="muted" className="text-[11px]">
                  {t(`examControl.step_${s.key}_hint`)}
                </Text>
              </View>
              <Icon as={ChevronLeft} className="text-muted-foreground size-4 ltr:rotate-180" />
            </Pressable>
          ))}
          {r.chief ? (
            <Pressable onPress={() => router.push(to('audit', id))} accessibilityRole="button" className="flex-row items-center gap-3 py-1.5">
              <Text className="text-brand dark:text-brand-secondary text-sm font-medium">{t('examControl.tab_audit')}</Text>
            </Pressable>
          ) : null}
          {r.manage ? (
            <Pressable onPress={() => router.push(to('alerts', id))} accessibilityRole="button" className="flex-row items-center gap-3 py-1.5">
              <Text className="text-brand dark:text-brand-secondary text-sm font-medium">{t('examControl.tab_alerts')}</Text>
            </Pressable>
          ) : null}
        </FormSection>
        {o.grades.length ? (
          <FormSection title={t('examControl.gradesInSession')}>
            {o.grades.map((g) => (
              <View key={g.grade_level_id} className="gap-0.5">
                <Text className="text-sm font-medium">{`${g.grade_level_name} · ${t('examControl.numberCode')} ${g.number_code}`}</Text>
                <Text variant="muted" className="text-[11px]">
                  {g.subjects.map((s) => `${s.name} (${s.max})`).join('، ')}
                </Text>
              </View>
            ))}
          </FormSection>
        ) : null}
      </ScrollView>
    </>
  );
}
