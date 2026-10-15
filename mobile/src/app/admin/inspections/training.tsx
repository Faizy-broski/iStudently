import { Stack } from 'expo-router';
import { GraduationCap, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Training prescriptions from inspections: assign a session or dismiss (web: /admin/inspections/training-prescriptions). */
export default function TrainingPrescriptions() {
  const { t } = useTranslation();
  const p = (k: string) => t(`inspections.training.${k}`);
  const toast = useToast();
  const { scopeId } = useCampus();
  const list = useApi(scopeId ? ['admin', 'training-prescriptions', scopeId] : null, ([, , id]) => adminInspections.prescriptionsForSchool(id as string));
  const sessions = useApi(scopeId ? ['admin', 'training-sessions', scopeId] : null, ([, , id]) => adminInspections.trainingSessions(id as string));
  const [target, setTarget] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [assigning, setAssigning] = useState(false);

  async function assign() {
    if (!target) return;
    setAssigning(true);
    try {
      const res = await adminInspections.assignPrescription(target, sessionId || undefined);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(p('msg_assigned'));
      setTarget(null);
      setSessionId('');
      list.mutate();
    } finally {
      setAssigning(false);
    }
  }

  async function dismiss(id: string) {
    const res = await adminInspections.dismissPrescription(id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(p('msg_dismissed'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: p('admin_page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={<Text variant="muted" className="p-4 text-sm">{p('admin_page_subtitle')}</Text>}
          items={scopeId ? list.data : []}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={scopeId ? p('no_prescriptions') : p('select_campus_prompt')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => (
            <View className="flex-row items-start gap-3 px-4 py-3">
              <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                <Icon as={GraduationCap} className="size-4 text-[#022172]" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium">{x.teacher ? `${x.teacher.first_name} ${x.teacher.last_name}` : ''}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {x.auto_suggested ? (
                    <Badge variant="outline">
                      <Icon as={Sparkles} className="text-foreground size-2.5" />
                      <Text className="text-[10px]">{p('auto_suggested_badge')}</Text>
                    </Badge>
                  ) : null}
                  <Badge variant="secondary">
                    <Text className="text-[10px]">{p(`status_${x.status}`)}</Text>
                  </Badge>
                </View>
                {x.reason ? <Text className="text-sm">{x.reason}</Text> : null}
                {x.training_session ? <Text className="text-muted-foreground text-xs">{`${p('linked_session_label')}: ${x.training_session.title}`}</Text> : null}
                {x.status === 'suggested' || x.status === 'assigned' ? (
                  <View className="flex-row gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setTarget(x.id);
                        setSessionId(x.training_session_id || '');
                      }}>
                      <Text className="text-xs">{p('btn_assign')}</Text>
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => dismiss(x.id)}>
                      <Text className="text-destructive text-xs">{p('btn_dismiss')}</Text>
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      </View>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('dialog_assign_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{p('field_training_session_optional')}</Label>
            <Picker value={sessionId} onChange={setSessionId} placeholder={p('field_training_session_placeholder')} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.title }))} />
          </View>
          <DialogFooter>
            <Button onPress={assign} disabled={assigning}>
              <Text>{p('btn_confirm_assign')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
