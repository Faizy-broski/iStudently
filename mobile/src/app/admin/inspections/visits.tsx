import type { InspectionVisit, VisitStatus } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Calendar, CheckCircle2, UserCog, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUS_CLS: Record<VisitStatus, [string, string]> = {
  scheduled: ['bg-amber-100', 'text-amber-800'],
  confirmed: ['bg-blue-100', 'text-blue-800'],
  in_progress: ['bg-purple-100', 'text-purple-800'],
  completed: ['bg-green-100', 'text-green-800'],
  cancelled: ['bg-red-100', 'text-red-800'],
  rescheduled: ['bg-gray-100', 'text-gray-600'],
};

/** Inspection visits for the campus: confirm or cancel (web: /admin/inspections/visits). */
export default function InspectionVisits() {
  const { t } = useTranslation();
  const v = (k: string) => t(`inspections.visits.${k}`);
  const toast = useToast();
  const { scopeId } = useCampus();
  const list = useApi(scopeId ? ['admin', 'inspection-visits', scopeId] : null, ([, , id]) => adminInspections.visitsForSchool(id as string));
  const [acting, setActing] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InspectionVisit | null>(null);
  const [reason, setReason] = useState('');

  async function confirmVisit(id: string) {
    setActing(id);
    try {
      const res = await adminInspections.confirmVisit(id);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(v('msg_confirmed'));
      list.mutate();
    } finally {
      setActing(null);
    }
  }

  async function cancel() {
    if (!cancelTarget) return;
    setActing(cancelTarget.id);
    try {
      const res = await adminInspections.cancelVisit(cancelTarget.id, reason.trim() || undefined);
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(v('msg_cancelled'));
      setCancelTarget(null);
      setReason('');
      list.mutate();
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: v('admin_page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={<Text variant="muted" className="p-4 text-sm">{v('admin_page_subtitle')}</Text>}
          items={scopeId ? list.data : []}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={scopeId ? v('no_visits') : v('select_campus_prompt')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => {
            const [bg, fg] = STATUS_CLS[x.status] ?? STATUS_CLS.rescheduled;
            return (
              <View className="gap-2 px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                    <Icon as={UserCog} className="size-4 text-[#022172]" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium">{x.inspector ? `${x.inspector.first_name} ${x.inspector.last_name}` : v('inspector_label')}</Text>
                    <View className="flex-row flex-wrap items-center gap-1">
                      <Icon as={Calendar} className="text-muted-foreground size-3" />
                      <Text className="text-muted-foreground text-xs">{`${x.scheduled_date}${x.scheduled_start_time ? ` · ${x.scheduled_start_time}` : ''}`}</Text>
                      <Badge variant="secondary">
                        <Text className="text-[10px]">{v(`visit_type_${x.visit_type}`)}</Text>
                      </Badge>
                    </View>
                  </View>
                  <View className={cn('rounded-full px-2 py-0.5', bg)}>
                    <Text className={cn('text-xs', fg)}>{v(`status_${x.status}`)}</Text>
                  </View>
                </View>
                {x.status === 'scheduled' || x.status === 'confirmed' ? (
                  <View className="flex-row justify-end gap-2">
                    {x.status === 'scheduled' ? (
                      <Button size="sm" variant="outline" onPress={() => confirmVisit(x.id)} disabled={acting === x.id}>
                        <Icon as={CheckCircle2} className="text-foreground size-3.5" />
                        <Text>{v('btn_confirm')}</Text>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onPress={() => setCancelTarget(x)} disabled={acting === x.id}>
                      <Icon as={XCircle} className="text-destructive size-3.5" />
                      <Text className="text-destructive">{v('btn_cancel_visit')}</Text>
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{v('dialog_cancel_title')}</DialogTitle>
            <DialogDescription>{v('dialog_cancel_desc')}</DialogDescription>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{v('field_cancellation_reason')}</Label>
            <Textarea value={reason} onChangeText={setReason} className="min-h-20" />
          </View>
          <DialogFooter>
            <Button variant="destructive" onPress={cancel} disabled={!!acting}>
              <Icon as={XCircle} className="size-4 text-white" />
              <Text>{v('btn_confirm_cancel')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
