import type { FeeSettings, SiblingDiscountTier } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const DEFAULTS: FeeSettings = {
  enable_late_fees: false, late_fee_type: 'fixed', late_fee_value: 0, grace_days: 0, enable_sibling_discounts: false,
  discount_forfeiture_enabled: false, admin_can_restore_discounts: true, allow_partial_payments: true, min_partial_payment_percent: 0,
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-1">
      <Text className="flex-1">{label}</Text>
      <Switch checked={value} onCheckedChange={onChange} />
    </View>
  );
}

/** Late fees, discount and partial-payment rules for the campus (web: /admin/fees/settings, general tab). */
export default function FeeSettingsScreen() {
  const { t } = useTranslation();
  const s = (k: string) => t(`fees.settings.${k}`);
  const { scopeId } = useCampus();
  const data = useApi(scopeId ? ['admin', 'fee-settings', scopeId] : null, () => adminFees.settings(scopeId!));
  const [v, setV] = useState<FeeSettings>(DEFAULTS);
  useEffect(() => {
    if (data.data) setV({ ...DEFAULTS, ...data.data });
  }, [data.data]);
  const set = <K extends keyof FeeSettings>(k: K, val: FeeSettings[K]) => setV((p) => ({ ...p, [k]: val }));
  const num = (val: string) => (val.replace(/[^0-9.]/g, '') === '' ? 0 : Number(val.replace(/[^0-9.]/g, '')));
  const save = useAction(() => adminFees.updateSettings(scopeId!, v), { success: s('saved'), onSuccess: () => data.mutate() });
  const tierData = useApi(scopeId ? ['admin', 'sibling-tiers', scopeId] : null, ([, , sid]) => adminFees.siblingTiers(sid as string));
  const [tiers, setTiers] = useState<SiblingDiscountTier[] | null>(null);
  const tierList = tiers ?? tierData.data ?? [];
  const setTier = (i: number, patch: Partial<SiblingDiscountTier>) => setTiers(tierList.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const saveTiers = useAction(() => adminFees.saveSiblingTiers(scopeId!, tierList), {
    success: s('siblingsSaved'),
    onSuccess: () => {
      setTiers(null);
      tierData.mutate();
    },
  });

  if (data.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen options={{ title: s('pageTitle') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{s('pageSubtitle')}</Text>
        <Button variant="outline" onPress={() => router.push('/admin/billing/structures')}>
          <Text>{s('feeStructuresLink')}</Text>
        </Button>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{s('lateFeeSettings')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <Toggle label={s('enableLateFees')} value={v.enable_late_fees} onChange={(x) => set('enable_late_fees', x)} />
            {v.enable_late_fees ? (
              <>
                <Label>{s('lateFeeType')}</Label>
                <FilterChips<FeeSettings['late_fee_type']>
                  value={v.late_fee_type}
                  onChange={(x) => set('late_fee_type', x)}
                  options={[
                    { value: 'fixed', label: s('typeFixed') },
                    { value: 'percentage', label: s('typePercentage') },
                  ]}
                />
                <Label>{s('valueLabel')}</Label>
                <Input value={String(v.late_fee_value)} onChangeText={(x) => set('late_fee_value', num(x))} keyboardType="decimal-pad" />
                <Label>{s('graceDays')}</Label>
                <Input value={String(v.grace_days)} onChangeText={(x) => set('grace_days', Math.round(num(x)))} keyboardType="number-pad" />
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{s('discountSettings')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            <Toggle label={s('enableSiblingDisc')} value={v.enable_sibling_discounts} onChange={(x) => set('enable_sibling_discounts', x)} />
            <Toggle label={s('discountForfeit')} value={v.discount_forfeiture_enabled} onChange={(x) => set('discount_forfeiture_enabled', x)} />
            <Toggle label={s('adminRestore')} value={v.admin_can_restore_discounts} onChange={(x) => set('admin_can_restore_discounts', x)} />
          </CardContent>
        </Card>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{s('paymentSettings')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            <Toggle label={s('allowPartial')} value={v.allow_partial_payments} onChange={(x) => set('allow_partial_payments', x)} />
            {v.allow_partial_payments ? (
              <>
                <Label>{s('minPartialPct')}</Label>
                <Input value={String(v.min_partial_payment_percent)} onChangeText={(x) => set('min_partial_payment_percent', Math.min(100, num(x)))} keyboardType="decimal-pad" />
              </>
            ) : null}
          </CardContent>
        </Card>
        <Button onPress={() => save.run()} disabled={save.running || !scopeId}>
          <Text>{save.running ? s('saving') : s('saveSettings')}</Text>
        </Button>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{s('siblingTiers')}</CardTitle>
            <Text variant="muted">{s('siblingTiersDesc')}</Text>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            {tierList.map((tier, i) => (
              <View key={i} className="border-info-soft dark:border-border gap-2 rounded-xl border p-3">
                <View className="flex-row items-center gap-2">
                  <Label className="flex-1">{s('siblings')}</Label>
                  <Input className="w-20" value={String(tier.sibling_count || '')} onChangeText={(x) => setTier(i, { sibling_count: parseInt(x.replace(/\D/g, ''), 10) || 0 })} keyboardType="number-pad" />
                  <Pressable onPress={() => setTiers(tierList.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                <Label>{s('discountType')}</Label>
                <FilterChips<SiblingDiscountTier['discount_type']>
                  value={tier.discount_type}
                  onChange={(x) => setTier(i, { discount_type: x })}
                  options={[
                    { value: 'percentage', label: s('percentage') },
                    { value: 'fixed', label: s('fixedLabel') },
                  ]}
                />
                <Label>{s('valueLabel')}</Label>
                <Input value={String(tier.discount_value)} onChangeText={(x) => setTier(i, { discount_value: num(x) })} keyboardType="decimal-pad" />
              </View>
            ))}
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setTiers([...tierList, { sibling_count: tierList.length ? Math.max(...tierList.map((x) => x.sibling_count)) + 1 : 2, discount_type: 'percentage', discount_value: 5 }])}>
                <Icon as={Plus} className="size-4" />
                <Text>{s('addTier')}</Text>
              </Button>
              <Button className="flex-1" onPress={() => saveTiers.run()} disabled={saveTiers.running || !scopeId}>
                <Text>{s('saveTiers')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{s('tabServices')}</CardTitle>
            <Text variant="muted">{s('servicesNote')}</Text>
          </CardHeader>
          <CardContent className="px-4">
            <Button variant="outline" onPress={() => router.push('/admin/settings/services')}>
              <Text>{s('manageServices')}</Text>
            </Button>
          </CardContent>
        </Card>
      </Screen>
    </>
  );
}
