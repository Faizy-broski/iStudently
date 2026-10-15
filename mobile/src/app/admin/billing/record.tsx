import type { PaymentMethod } from '@studently/api-client';
import { todayIso } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Paperclip, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminFees, adminSchool, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

const METHODS: PaymentMethod[] = ['cash', 'online', 'bank_deposit', 'cheque'];
const METHOD_KEY: Record<PaymentMethod, string> = { cash: 'cash', online: 'online', bank_deposit: 'bank', cheque: 'cheque' };

type Row = { key: number; receipt_number: string; manual_receipt_number: string; amount: string; payment_date: string; comment: string; is_lunch_payment: boolean; payment_method: PaymentMethod | null; file: PickedDocument | null };
const newRow = (key: number): Row => ({ key, receipt_number: '', manual_receipt_number: '', amount: '', payment_date: todayIso(), comment: '', is_lunch_payment: false, payment_method: null, file: null });

/**
 * Record one or more payments for a student (web: the new-payment rows on the student's payments page):
 * own receipt number or auto, MRN, amount, date, comment, lunch, method, attachment.
 */
export default function RecordPayment() {
  const { t } = useTranslation();
  const p = (k: string) => t(`fees.payments.${k}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { campusId, scopeId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const rawDefault = settings.data?.default_payment_method;
  const defaultMethod: PaymentMethod = typeof rawDefault === 'string' && METHODS.includes(rawDefault as PaymentMethod) ? (rawDefault as PaymentMethod) : 'cash';
  // A row's method stays null until changed, so it follows the campus default once settings load.
  const [rows, setRows] = useState<Row[]>([newRow(0)]);
  const [saving, setSaving] = useState(false);

  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    const valid = rows.filter((r) => r.amount && parseFloat(r.amount) > 0);
    if (!valid.length) return toast.error(p('enterAtLeastOne'));
    if (!scopeId || !studentId) return;
    setSaving(true);
    for (const r of valid) {
      let fileUrl: string | undefined;
      if (r.file) {
        const up = await media.uploadAttachment({ uri: r.file.uri, name: r.file.name, type: r.file.type }, scopeId);
        if (up.success && up.data) fileUrl = up.data.url;
      }
      const res = await adminFees.recordPayment(scopeId, {
        student_id: studentId,
        amount: parseFloat(r.amount),
        payment_date: r.payment_date,
        payment_method: r.payment_method ?? defaultMethod,
        comment: r.comment || null,
        is_lunch_payment: r.is_lunch_payment,
        manual_receipt_number: r.manual_receipt_number || undefined,
        receipt_number: r.receipt_number || undefined,
        file_url: fileUrl,
      });
      if (!res.success) {
        setSaving(false);
        // Rows before this one are saved; keep the rest on screen.
        setRows((list) => list.slice(list.findIndex((x) => x.key === r.key)));
        mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'ledger' || (typeof k[1] === 'string' && k[1].startsWith('fees-'))));
        return toast.error(res.error || p('saveFailed'));
      }
    }
    setSaving(false);
    toast.success(p('paymentSaved'));
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'ledger' || k[1] === 'balances' || (typeof k[1] === 'string' && k[1].startsWith('fees-'))));
    mutate((k) => typeof k === 'string' && k.startsWith('admin-balances'));
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: p('addPayment') }} />
      <Screen scroll edges={['bottom']}>
        {rows.map((r, i) => (
          <Card key={r.key} className="py-3">
            <CardContent className="gap-2 px-4">
              {rows.length > 1 ? (
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-xs">{`#${i + 1}`}</Text>
                  <Pressable onPress={() => setRows((list) => list.filter((x) => x.key !== r.key))} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8}>
                    <Icon as={Trash2} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              ) : null}
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1">
                  <Label>{p('th_receipt')}</Label>
                  <Input value={r.receipt_number} onChangeText={(v) => update(r.key, { receipt_number: v })} placeholder={p('auto')} />
                </View>
                <View className="flex-1 gap-1">
                  <Label>{p('th_mrn')}</Label>
                  <Input value={r.manual_receipt_number} onChangeText={(v) => update(r.key, { manual_receipt_number: v })} placeholder={p('th_mrn')} />
                </View>
              </View>
              <Text className="text-muted-foreground text-xs">{p('receiptAutoGenerated')}</Text>
              <Label>{p('th_amount')}</Label>
              <Input value={r.amount} onChangeText={(v) => update(r.key, { amount: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="0.00" autoFocus={i === 0} />
              <Label>{p('th_paymentDate')}</Label>
              <DateField value={r.payment_date} onChange={(v) => update(r.key, { payment_date: v ?? r.payment_date })} />
              <Label>{p('th_method')}</Label>
              <FilterChips<PaymentMethod> value={r.payment_method ?? defaultMethod} onChange={(v) => update(r.key, { payment_method: v })} options={METHODS.map((m) => ({ value: m, label: p(METHOD_KEY[m]) }))} />
              <Label>{p('th_comment')}</Label>
              <Input value={r.comment} onChangeText={(v) => update(r.key, { comment: v })} />
              <View className="flex-row items-center justify-between">
                <Label>{p('th_lunchPayment')}</Label>
                <Switch checked={r.is_lunch_payment} onCheckedChange={(v) => update(r.key, { is_lunch_payment: v })} />
              </View>
              <Label>{p('th_attachment')}</Label>
              {r.file ? (
                <View className="border-border flex-row items-center gap-2 rounded-md border px-3 py-2">
                  <Icon as={Paperclip} className="text-muted-foreground size-4" />
                  <Text className="flex-1 text-sm" numberOfLines={1}>
                    {r.file.name}
                  </Text>
                  <Pressable onPress={() => update(r.key, { file: null })} accessibilityRole="button" hitSlop={8}>
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={async () => {
                    const [file] = await pickDocuments({ multiple: false });
                    if (file) update(r.key, { file });
                  }}>
                  <Icon as={Paperclip} className="size-4" />
                  <Text>{p('attachFile')}</Text>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        <Button variant="outline" onPress={() => setRows((list) => [...list, newRow((list.at(-1)?.key ?? 0) + 1)])}>
          <Icon as={Plus} className="size-4" />
          <Text>{p('addPayment')}</Text>
        </Button>
        <Button disabled={saving || !scopeId} onPress={save}>
          <Text>{saving ? t('common.saving') : p('codes_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
