import { Stack } from 'expo-router';
import { Check, GraduationCap, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

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
        <Text variant="muted">{k('page_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-12 text-center text-sm">{k('no_prescriptions')}</Text>
        ) : (
          <Card>
            <CardContent className="p-0">
              {list.map((p, i) => (
                <View key={p.id} className={cn('flex-row items-start gap-3 p-4', i > 0 && 'border-border border-t')}>
                  <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                    <Icon as={GraduationCap} className="size-4 text-[#022172] dark:text-blue-300" />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap gap-1.5">
                      {p.auto_suggested ? (
                        <Badge variant="outline" className="flex-row items-center gap-1">
                          <Icon as={Sparkles} className="size-2.5" />
                          <Text className="text-[10px]">{k('auto_suggested_badge')}</Text>
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">
                        <Text className="text-[10px]">{k(`status_${p.status}`)}</Text>
                      </Badge>
                    </View>
                    {p.reason ? <Text className="text-sm">{p.reason}</Text> : null}
                    {p.training_session ? <Text className="text-muted-foreground text-xs">{`${k('linked_session_label')}: ${p.training_session.title}`}</Text> : null}
                    {p.status === 'suggested' || p.status === 'assigned' ? (
                      <Button size="sm" variant="outline" className="mt-1 self-start" onPress={() => complete(p.id)} disabled={busy === p.id}>
                        <Icon as={Check} className="size-3.5" />
                        <Text>{k('btn_mark_complete')}</Text>
                      </Button>
                    ) : null}
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
