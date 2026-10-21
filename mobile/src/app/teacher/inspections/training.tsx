import { Stack } from 'expo-router';
import { Check, GraduationCap, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Training suggested or assigned after inspections; mark one complete (web: /teacher/inspections/training). */
export default function TeacherInspectionTraining() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.training.${key}`);
  const toast = useToast();
  const res = useApi(['teacher', 'prescriptions'], () => teacherInspections.myPrescriptions());
  const [busy, setBusy] = useState<string | null>(null);
  const list = res.data ?? [];

  async function complete(id: string) {
    setBusy(id);
    const r = await teacherInspections.completePrescription(id);
    setBusy(null);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_completed'));
    res.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('page_subtitle')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState icon={GraduationCap} title={k('no_prescriptions')} />
        ) : (
          <Panel>
            {list.map((p, i) => (
              <RowItem
                key={p.id}
                leading={<IconTile icon={GraduationCap} size={40} round />}
                title={p.reason || k(`status_${p.status}`)}
                meta={p.training_session ? `${k('linked_session_label')}: ${p.training_session.title}` : null}
                trailing={<StatusChip label={k(`status_${p.status}`)} tone={p.status === 'completed' ? 'success' : p.status === 'dismissed' ? 'muted' : 'warning'} />}
                last={i === list.length - 1}>
                {p.auto_suggested || p.status === 'suggested' || p.status === 'assigned' ? (
                  <View className="flex-row flex-wrap items-center gap-2 ps-[52px]">
                    {p.auto_suggested ? (
                      <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                        <Icon as={Sparkles} className="text-brand dark:text-brand-secondary size-3" />
                        <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{k('auto_suggested_badge')}</Text>
                      </View>
                    ) : null}
                    {p.status === 'suggested' || p.status === 'assigned' ? (
                      <Button size="sm" variant="outline" className="rounded-full" onPress={() => complete(p.id)} disabled={busy === p.id}>
                        <Icon as={Check} className="text-success size-3.5" />
                        <Text>{k('btn_mark_complete')}</Text>
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </RowItem>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
