import type { FeeAdjustmentType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Ban, Clock, DollarSign, Percent, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { Screen } from '@/components/app/screen';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { AdjustmentRow } from '@/features/admin/fee-records';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type AdjustType = Exclude<FeeAdjustmentType, 'discount_restored'>;
const TYPES: { type: AdjustType; icon: typeof Percent; needsLateFee?: boolean; danger?: boolean }[] = [
  { type: 'custom_discount', icon: Percent },
  { type: 'late_fee_removed', icon: Clock, needsLateFee: true },
  { type: 'late_fee_reduced', icon: DollarSign, needsLateFee: true },
  { type: 'fee_waived', icon: Ban, danger: true },
];

/** Discount, remove or reduce the late fee, or waive a fee, with a reason for the audit log (web: FeeAdjustmentModal). */
export default function AdjustFee() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const fee = useApi(scopeId && id ? ['admin', 'student-fee', scopeId, id] : null, ([, , sid, fid]) => adminFees.studentFee(sid as string, fid as string));
  const history = useApi(scopeId && id ? ['admin', 'fee-adjustments', scopeId, id] : null, ([, , sid, fid]) => adminFees.adjustments(sid as string, fid as string));
  const [type, setType] = useState<AdjustType>('custom_discount');
  const [lateFee, setLateFee] = useState<string | null>(null);
  const [discount, setDiscount] = useState('0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (fee.isLoading) return <LoadingList rows={4} />;
  if (fee.error || !fee.data) return <ErrorState message={fee.error?.message} onRetry={() => fee.mutate()} />;
  const d = fee.data;
  const pr = d.students?.profiles;
  const studentName = pr ? [pr.first_name, pr.father_name, pr.last_name].filter(Boolean).join(' ') : '—';
  const late = d.late_fee_applied || 0;
  const lateValue = lateFee ?? String(late);

  async function submit() {
    if (!reason.trim()) return toast.error(t('app.fr_reason_required'));
    if (!scopeId || !id) return;
    setBusy(true);
    const res = await adminFees.adjust(scopeId, id, {
      type,
      newLateFee: type === 'late_fee_reduced' ? Number(lateValue) || 0 : undefined,
      customDiscount: type === 'custom_discount' ? Number(discount) || 0 : undefined,
      reason: reason.trim(),
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.fr_adjust_failed'));
    toast.success(t('app.fr_adjusted'));
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && (k[1].startsWith('fees-') || k[1] === 'student-fee' || k[1] === 'fee-adjustments'));
    router.back();
  }

  const summary: [string, string, string][] = [
    [t('app.fr_base_amount'), money(d.base_amount), ''],
    [t('app.fr_late_fee'), money(late), 'text-warning '],
    [t('app.fr_custom_discount'), `-${money(d.custom_discount || 0)}`, 'text-success '],
    [t('app.fr_final_amount'), money(d.final_amount), 'text-primary'],
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('admin.fees.page.actions.adjust') }} />
      <Screen scroll edges={['bottom']}>
        <Text className="text-muted-foreground">{studentName}</Text>
        <Card className="py-3">
          <CardContent className="flex-row flex-wrap gap-y-3 px-4">
            {summary.map(([label, value, tone]) => (
              <View key={label} className="w-1/2">
                <Text className="text-muted-foreground text-xs">{label}</Text>
                <Text className={cn('font-semibold', tone)}>{value}</Text>
              </View>
            ))}
          </CardContent>
        </Card>

        <Label>{t('app.fr_adjustment_type')}</Label>
        <View className="flex-row flex-wrap gap-2">
          {TYPES.map((x) => {
            const disabled = !!x.needsLateFee && !late;
            const on = type === x.type;
            return (
              <Pressable
                key={x.type}
                disabled={disabled}
                onPress={() => setType(x.type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled }}
                className={cn(
                  'min-w-[46%] flex-1 flex-row items-center gap-3 rounded-lg border-2 p-3',
                  on ? (x.danger ? 'border-destructive bg-destructive-soft ' : 'border-brand-secondary bg-info-soft') : 'border-border',
                  disabled && 'opacity-50',
                )}>
                <Icon as={x.icon} className={cn('size-5', on && (x.danger ? 'text-destructive' : 'text-primary'))} />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{t(`app.fr_type_${x.type}`)}</Text>
                  <Text className="text-muted-foreground text-xs">{t(`app.fr_type_${x.type}_hint`)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {type === 'late_fee_reduced' ? (
          <View className="gap-1.5">
            <Label>{t('app.fr_new_late_fee')}</Label>
            <Input value={lateValue} onChangeText={(v) => setLateFee(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder={t('app.fr_new_late_fee_ph')} />
            <Text className="text-muted-foreground text-xs">{t('app.fr_current_late_fee', { amount: money(late) })}</Text>
          </View>
        ) : null}
        {type === 'custom_discount' ? (
          <View className="gap-1.5">
            <Label>{t('app.fr_discount_amount')}</Label>
            <Input value={discount} onChangeText={(v) => setDiscount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder={t('app.fr_discount_ph')} />
          </View>
        ) : null}

        <View className="gap-1.5">
          <Label>{`${t('app.fr_reason')} *`}</Label>
          <Textarea value={reason} onChangeText={setReason} placeholder={t('app.fr_reason_ph')} />
          <View className="flex-row items-center gap-1">
            <Icon as={AlertCircle} className="text-muted-foreground size-3.5" />
            <Text className="text-muted-foreground text-xs">{t('app.fr_audit_note')}</Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => router.back()}>
            <Text>{t('common.cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={submit} disabled={busy}>
            <Text>{busy ? t('app.fr_applying') : t('app.fr_apply')}</Text>
          </Button>
        </View>

        {(history.data?.length ?? 0) > 0 ? (
          <View className="gap-2 pt-2">
            <View className="flex-row items-center gap-2">
              <Icon as={RefreshCw} className="size-4" />
              <Text className="text-sm font-medium">{t('app.fr_history')}</Text>
            </View>
            {(history.data ?? []).map((a) => (
              <AdjustmentRow key={a.id} adj={a} money={money} />
            ))}
          </View>
        ) : null}
      </Screen>
    </>
  );
}
