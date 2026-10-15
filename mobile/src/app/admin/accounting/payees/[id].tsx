import { todayIso } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { InfoCard, InfoRow } from '@/components/app/info';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** One payee with bank details and payments (web: /admin/accounting/payees/[payeeId]). */
export default function PayeeDetail() {
  const { t } = useTranslation();
  const p = (k: string) => t(`accounting.payees.${k}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const payee = useApi(scopeId ? ['admin', 'acc-payee', scopeId, id] : null, () => adminAccounting.payee(scopeId!, id));
  const payments = useApi(scopeId ? ['admin', 'acc-payee-payments', scopeId, id] : null, () => adminAccounting.payeePayments(scopeId!, id));
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [ref, setRef] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  if (payee.isLoading) return <LoadingList rows={5} />;
  if (payee.error || !payee.data) return <ErrorState message={payee.error?.message} onRetry={() => payee.mutate()} />;
  const x = payee.data;
  const total = (payments.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

  async function addPayment() {
    const amt = parseFloat(amount);
    if (!(amt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast.error(t('fees.structures.fillRequired'));
    setBusy(true);
    const res = await adminAccounting.addPayeePayment(scopeId!, id, { amount: amt, payment_date: date, reference_number: ref.trim() || undefined, description: desc.trim() || undefined });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    setAdding(false);
    payments.mutate();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: x.name,
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/accounting/payees/form', params: { id } })} accessibilityLabel={t('app.edit')}>
              <Icon as={Pencil} className="size-5" />
            </Button>
          ),
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <InfoCard title={x.name}>
          <InfoRow label={p('th_email')} value={x.email} />
          <InfoRow label={p('th_phone')} value={x.phone} />
          <InfoRow label={p('address')} value={x.address} />
          <InfoRow label={p('th_bank')} value={x.bank} />
          <InfoRow label={p('th_accountNumber')} value={x.account_number} />
          <InfoRow label={p('th_swiftIban')} value={x.swift_iban} />
          <InfoRow label={p('th_bsbBic')} value={x.bsb_bic} />
        </InfoCard>
        <Card className="gap-1 py-4">
          <CardHeader className="flex-row items-center justify-between px-4">
            <CardTitle>{`${t('app.ac_payments')} · ${money(total)}`}</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setAmount('');
                setDate(todayIso());
                setRef('');
                setDesc('');
                setAdding(true);
              }}>
              <Icon as={Plus} className="size-4" />
              <Text>{t('app.ac_add')}</Text>
            </Button>
          </CardHeader>
          <CardContent className="px-4">
            {payments.data?.length === 0 ? <Text variant="muted">—</Text> : null}
            {(payments.data ?? []).map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-3 py-2">
                  <View className="flex-1">
                    <Text className="font-medium">{money(r.amount)}</Text>
                    <Text className="text-muted-foreground text-xs">{[formatDate(r.payment_date), r.reference_number, r.description].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={t('app.bl_delete')}
                    onPress={async () => {
                      if (!(await confirm({ title: t('app.ac_delete'), body: money(r.amount), destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                      const res = await adminAccounting.deletePayeePayment(scopeId!, r.id);
                      if (!res.success) return toast.error(res.error || t('app.error_title'));
                      payments.mutate();
                    }}>
                    <Icon as={Trash2} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{t('app.ac_add_payment')}</DialogTitle>
          </DialogHeader>
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          <Label>{t('fees.payments.th_paymentDate')}</Label>
          <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
          <Label>{t('accounting.transactions.referenceNumber')}</Label>
          <Input value={ref} onChangeText={setRef} />
          <Label>{t('accounting.transactions.descOptional')}</Label>
          <Input value={desc} onChangeText={setDesc} />
          <DialogFooter>
            <Button onPress={addPayment} disabled={busy}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
