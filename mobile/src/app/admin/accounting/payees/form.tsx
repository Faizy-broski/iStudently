import type { PayeeInput } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { Screen } from '@/components/app/screen';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

const FIELDS: { key: keyof PayeeInput; label: string; keyboard?: 'email-address' | 'phone-pad' }[] = [
  { key: 'name', label: 'app.be_name' },
  { key: 'email', label: 'accounting.payees.th_email', keyboard: 'email-address' },
  { key: 'phone', label: 'accounting.payees.th_phone', keyboard: 'phone-pad' },
  { key: 'address', label: 'accounting.payees.address' },
  { key: 'bank', label: 'accounting.payees.th_bank' },
  { key: 'account_number', label: 'accounting.payees.th_accountNumber' },
  { key: 'swift_iban', label: 'accounting.payees.th_swiftIban' },
  { key: 'bsb_bic', label: 'accounting.payees.th_bsbBic' },
];

/** Add or edit a payee. */
export default function PayeeForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { scopeId } = useCampus();
  const existing = useApi(editing && scopeId ? ['admin', 'acc-payee', scopeId, id] : null, () => adminAccounting.payee(scopeId!, id!));
  const [v, setV] = useState<Record<string, string>>({});
  const [rollover, setRollover] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const x = existing.data;
    if (!x) return;
    setV(Object.fromEntries(FIELDS.map((f) => [f.key, String((x as unknown as Record<string, unknown>)[f.key] ?? '')])));
    setRollover(!!x.rollover);
  }, [existing.data]);
  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('acc-payee'));

  async function save() {
    if (!v.name?.trim()) return toast.error(t('app.v_required'));
    const input = { ...Object.fromEntries(FIELDS.map((f) => [f.key, v[f.key]?.trim() || undefined])), name: v.name.trim(), rollover } as PayeeInput;
    setBusy(true);
    const res = editing ? await adminAccounting.updatePayee(scopeId!, id!, input) : await adminAccounting.createPayee(scopeId!, input);
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    refresh();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('app.edit') : t('accounting.payees.addPayee') }} />
      <Screen scroll edges={['bottom']}>
        {FIELDS.map((f) => (
          <View key={f.key} className="gap-1.5">
            <Label>{t(f.label)}</Label>
            <Input value={v[f.key] ?? ''} onChangeText={(x) => setV((p) => ({ ...p, [f.key]: x }))} keyboardType={f.keyboard} autoCapitalize={f.keyboard === 'email-address' ? 'none' : undefined} />
          </View>
        ))}
        <View className="flex-row items-center justify-between">
          <Text className="flex-1">{t('app.ac_rollover')}</Text>
          <Switch checked={rollover} onCheckedChange={setRollover} />
        </View>
        <Button onPress={save} disabled={busy || !scopeId}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? (
          <Button
            variant="ghost"
            onPress={async () => {
              if (!(await confirm({ title: t('app.ac_delete_payee'), destructive: true, confirmLabel: t('app.bl_delete') }))) return;
              const res = await adminAccounting.deletePayee(scopeId!, id!);
              if (!res.success) return toast.error(res.error || t('app.error_title'));
              refresh();
              router.dismissTo('/admin/accounting/payees');
            }}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
