import type { HifziPlan, HifziPlanType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CirclePicker, NoCircles, NoRoster, RosterPicker, useHifziCircles, useHifziRoster, useHz, useRiwayat } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

const PLAN_TYPES: HifziPlanType[] = ['quantity_based', 'time_based', 'staged', 'custom', 'intensive'];

/** Create or edit a student's plan: riwayah, type, daily target (web: CreatePlanDialog; no ayah range until the corpus is loaded). */
function PlanDialog({ studentId, circleId, editing, onClose, onSaved }: { studentId: string; circleId: string; editing: HifziPlan | null; onClose: () => void; onSaved: () => void }) {
  const { h, a, isAr } = useHz('plans');
  const toast = useToast();
  const { campusId } = useCampus();
  const riwayat = useRiwayat();
  const list = riwayat.data ?? [];
  const [riwayahId, setRiwayahId] = useState(editing?.riwayah_id ?? '');
  const [planType, setPlanType] = useState<HifziPlanType>(editing?.plan_type ?? 'quantity_based');
  const [daily, setDaily] = useState(editing?.daily_new_ayat_target != null ? String(editing.daily_new_ayat_target) : '');
  const [saving, setSaving] = useState(false);
  const riwayah = riwayahId || list[0]?.id || '';

  async function save() {
    if (!riwayah) return;
    setSaving(true);
    try {
      const dto = { student_id: studentId, circle_id: circleId || undefined, plan_type: planType, riwayah_id: riwayah, daily_new_ayat_target: daily ? Number(daily) : undefined };
      const res = editing ? await adminHifzi.updatePlan(editing.id, dto, campusId) : await adminHifzi.createPlan(dto, campusId);
      if (!res.success) return toast.error(res.error || h(editing ? 'updateError' : 'createError'));
      toast.success(h(editing ? 'updateSuccess' : 'createSuccess'));
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <KeyboardAvoidingView>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <DialogTitle>{editing ? h('edit') : h('create')}</DialogTitle>
              <DialogDescription>{h('corpusNote')}</DialogDescription>
            </DialogHeader>
            <View className="gap-1.5">
              <Label>{h('riwayah')}</Label>
              <Picker value={riwayah} onChange={setRiwayahId} options={list.map((r) => ({ value: r.id, label: isAr ? r.name_ar : r.name_en }))} />
            </View>
            <View className="gap-1.5">
              <Label>{h('planType')}</Label>
              <Picker value={planType} onChange={(v) => setPlanType(v as HifziPlanType)} options={PLAN_TYPES.map((p) => ({ value: p, label: h(`planType_${p}`) }))} />
            </View>
            <View className="gap-1.5">
              <Label>{h('dailyTarget')}</Label>
              <Input value={daily} onChangeText={(v) => setDaily(v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
                <Text>{a('hz_cancel')}</Text>
              </Button>
              <Button className="flex-1" onPress={save} disabled={saving || !riwayah}>
                <Text>{editing ? h('edit') : h('create')}</Text>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

/** Student plan and today's assignment items; admins can regenerate the assignment (web: /admin/hifzi/plans). */
export default function HifziPlans() {
  const { h, a, t, isAr } = useHz('plans');
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const circles = useHifziCircles();
  const riwayat = useRiwayat();
  const list = circles.data ?? [];
  const [pickedCircle, setPickedCircle] = useState('');
  const circleId = list.some((c) => c.id === pickedCircle) ? pickedCircle : (list[0]?.id ?? '');
  const roster = useHifziRoster(circleId || null);
  const rows = roster.data ?? [];
  const [pickedStudent, setPickedStudent] = useState('');
  const studentId = rows.some((e) => e.student_id === pickedStudent) ? pickedStudent : (rows[0]?.student_id ?? '');
  const plans = useApi(studentId ? ['admin', 'hifzi-plans', studentId, campusId ?? 'school'] : null, ([, , s]) => adminHifzi.plans(s as string, campusId));
  const assignment = useApi(studentId ? ['admin', 'hifzi-assignment', studentId, campusId ?? 'school'] : null, ([, , s]) => adminHifzi.assignment(s as string, campusId));
  const [dialog, setDialog] = useState<{ editing: HifziPlan | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = (plans.data ?? [])[0] ?? null;
  const items = assignment.data?.hifzi_assignment_items ?? [];
  const riwayahName = (id: string) => {
    const r = (riwayat.data ?? []).find((x) => x.id === id);
    return r ? (isAr ? r.name_ar : r.name_en) : id;
  };

  async function remove(p: HifziPlan) {
    if (!(await confirm({ title: h('deleteConfirm'), destructive: true, confirmLabel: h('delete') }))) return;
    setBusy(true);
    try {
      const res = await adminHifzi.deletePlan(p.id, campusId);
      if (!res.success) return toast.error(res.error || h('deleteError'));
      toast.success(h('deleteSuccess'));
      plans.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!studentId) return;
    setBusy(true);
    try {
      const res = await adminHifzi.generateAssignment(studentId, campusId);
      if (!res.success) return toast.error(res.error || a('hz_failed'));
      toast.success(a('hz_regenerated'));
      assignment.mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: t('hifzi.recitation.title'),
          headerRight: () => (
            <Pressable onPress={regenerate} disabled={busy || !studentId} hitSlop={8} className="p-1" accessibilityLabel={a('hz_regenerate')}>
              <Icon as={RefreshCw} className="text-foreground size-5" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (plans.mutate(), assignment.mutate())} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : circles.error ? (
          <ErrorState message={circles.error.message} onRetry={() => circles.mutate()} />
        ) : !list.length ? (
          <NoCircles />
        ) : (
          <>
            <CirclePicker circles={list} value={circleId} onChange={setPickedCircle} />
            {rows.length ? <RosterPicker roster={rows} value={studentId} onChange={setPickedStudent} /> : null}
            {roster.isLoading ? (
              <LoadingList rows={2} />
            ) : !rows.length ? (
              <NoRoster circleId={circleId} />
            ) : plans.isLoading || assignment.isLoading ? (
              <LoadingList rows={2} />
            ) : !plan ? (
              <Card>
                <CardContent className="items-center gap-3 pt-6 pb-6">
                  <Text className="text-muted-foreground text-center text-sm">{h('noPlanYet')}</Text>
                  <Button onPress={() => setDialog({ editing: null })}>
                    <Icon as={Plus} className="text-primary-foreground size-4" />
                    <Text>{h('create')}</Text>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="gap-2 pt-4">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Badge>
                        <Text className="text-xs">{h(`planType_${plan.plan_type}`)}</Text>
                      </Badge>
                      <Text className="text-muted-foreground flex-1 text-sm">
                        {riwayahName(plan.riwayah_id)}
                        {plan.daily_new_ayat_target != null ? ` · ${h('dailyTargetLabel')}: ${plan.daily_new_ayat_target}` : ''}
                      </Text>
                      <Pressable onPress={() => setDialog({ editing: plan })} hitSlop={6} className="p-1" accessibilityLabel={h('edit')}>
                        <Icon as={Pencil} className="text-muted-foreground size-4" />
                      </Pressable>
                      <Pressable onPress={() => remove(plan)} disabled={busy} hitSlop={6} className="p-1" accessibilityLabel={h('delete')}>
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Pressable>
                    </View>
                    {!items.length ? <Text className="text-muted-foreground text-xs">{h('corpusNote')}</Text> : null}
                  </CardContent>
                </Card>
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="flex-row items-center gap-2 pt-3 pb-3">
                      <Badge variant="secondary">
                        <Text className="text-xs">{t(`hifzi.recitation.${it.item_type}`)}</Text>
                      </Badge>
                      <Text className="text-muted-foreground flex-1 text-sm">{isAr ? it.hifzi_reason_codes?.label_ar : it.hifzi_reason_codes?.label_en}</Text>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      {dialog && studentId ? (
        <PlanDialog
          studentId={studentId}
          circleId={circleId}
          editing={dialog.editing}
          onClose={() => setDialog(null)}
          onSaved={() => {
            plans.mutate();
            assignment.mutate();
          }}
        />
      ) : null}
    </View>
  );
}
