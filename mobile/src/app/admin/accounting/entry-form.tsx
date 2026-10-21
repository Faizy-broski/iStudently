import type { EntryKind } from '@studently/api-client';
import { todayIso } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Paperclip, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting, adminEmployees, adminSchool, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { pickDocuments } from '@/lib/upload';

const KINDS: EntryKind[] = ['incomes', 'expenses', 'staff-payments'];
const METHODS = ['cash', 'online', 'bank_deposit', 'cheque'] as const;
const METHOD_KEY: Record<string, string> = { cash: 'cash', online: 'online', bank_deposit: 'bank', cheque: 'cheque' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NONE = '__none__';

/** Add or edit an income, expense or staff payment. */
export default function AccountingEntryForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ kind?: string; year: string; id?: string; staff?: string }>();
  const kind: EntryKind = KINDS.includes(params.kind as EntryKind) ? (params.kind as EntryKind) : 'incomes';
  const { year, id } = params;
  const editing = !!id;
  const { campusId, scopeId } = useCampus();
  const list = useApi(editing && scopeId ? ['admin', 'acc-entries', kind, scopeId, year] : null, () => adminAccounting.entries(kind, scopeId!, year));
  const existing = list.data?.find((e) => e.id === id);
  const categories = useApi(scopeId ? ['admin', 'acc-categories', scopeId] : null, () => adminAccounting.categories(scopeId!, undefined, true));
  const staff = useApi(kind === 'staff-payments' && scopeId ? ['admin', 'acc-staff', scopeId] : null, () => adminEmployees.list('employees', scopeId, { limit: 300 }));
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState(NONE);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [comments, setComments] = useState('');
  const [staffId, setStaffId] = useState(params.staff ?? '');
  const [receipt, setReceipt] = useState('');
  const [file, setFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  // The campus default payment method, as on the web (used until the method is changed).
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const defaultMethod = settings.data?.default_payment_method;
  const [methodTouched, setMethodTouched] = useState(false);
  const methodValue = !editing && !methodTouched && typeof defaultMethod === 'string' && (METHODS as readonly string[]).includes(defaultMethod) ? (defaultMethod as (typeof METHODS)[number]) : method;

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setAmount(String(existing.amount));
    setDate((existing.income_date ?? existing.payment_date ?? todayIso()).slice(0, 10));
    setCategoryId(existing.category_id ?? NONE);
    if (existing.payment_method && (METHODS as readonly string[]).includes(existing.payment_method)) setMethod(existing.payment_method as (typeof METHODS)[number]);
    setComments(existing.comments ?? '');
    setStaffId(existing.staff_id ?? '');
    setReceipt(existing.receipt_number ?? '');
    setFile(existing.file_attached ?? null);
  }, [existing]);

  async function attach() {
    const [doc] = await pickDocuments({ multiple: false });
    if (!doc || !scopeId) return;
    setUploading(true);
    const up = await media.uploadAttachment({ uri: doc.uri, name: doc.name, type: doc.type }, scopeId);
    setUploading(false);
    if (!up.success || !up.data) return toast.error(up.error || t('app.error_title'));
    setFile(up.data.url);
  }

  const allowedType = kind === 'incomes' ? 'incomes' : 'expenses';
  const catOptions = [{ value: NONE, label: '—' }, ...(categories.data ?? []).filter((c) => c.category_type === allowedType || c.category_type === 'common').map((c) => ({ value: c.id, label: c.name }))];
  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('acc-'));

  // Web staff payments are titled "Payment to <name>".
  const pickedStaff = (staff.data ?? []).find((e) => e.id === staffId);
  const titleValue = title || (kind === 'staff-payments' && pickedStaff ? `Payment to ${shortName(pickedStaff.profile)}` : '');

  // `another`: keep the form open for the next entry (the web adds several rows and saves them together).
  async function save(another = false) {
    const amt = parseFloat(amount);
    if (!titleValue.trim() || !(amt > 0) || !DATE.test(date) || (kind === 'staff-payments' && !staffId)) return toast.error(t('fees.structures.fillRequired'));
    const input = {
      title: titleValue.trim(),
      amount: amt,
      date,
      category_id: categoryId === NONE ? null : categoryId,
      payment_method: methodValue,
      comments: comments.trim() || null,
      file_attached: file,
      ...(kind === 'staff-payments' ? { staff_id: staffId, receipt_number: receipt.trim() || undefined } : {}),
    };
    setBusy(true);
    const res = editing ? await adminAccounting.updateEntry(kind, scopeId!, id!, input) : await adminAccounting.createEntry(kind, scopeId!, year, input);
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(t('app.saved'));
    refresh();
    if (another && !editing) {
      setTitle('');
      setAmount('');
      setComments('');
      setReceipt('');
      setFile(null);
      return;
    }
    router.back();
  }

  if (editing && list.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('app.edit') : t(`app.ac_add_${kind}`) }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{`${t('fees.structures.academicYear')}: ${year}`}</Text>
        {kind === 'staff-payments' ? (
          <View className="gap-1.5">
            <Label>{t('accounting.staffPayments.th_user')}</Label>
            <Picker value={staffId} onChange={setStaffId} options={(staff.data ?? []).map((e) => ({ value: e.id, label: shortName(e.profile) || e.employee_number }))} />
          </View>
        ) : null}
        <View className="gap-1.5">
          <Label>{t('app.ac_title_label')}</Label>
          <Input value={titleValue} onChangeText={setTitle} />
        </View>
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_amount')}</Label>
          <Input value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        </View>
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_paymentDate')}</Label>
          <DateField value={date} onChange={(v) => setDate(v ?? date)} />
        </View>
        <View className="gap-1.5">
          <Label>{t('accounting.transactions.th_category')}</Label>
          <Picker value={categoryId} onChange={setCategoryId} options={catOptions} />
        </View>
        <View className="gap-1.5">
          <Label>{t('fees.payments.th_method')}</Label>
          <FilterChips<(typeof METHODS)[number]>
            value={methodValue}
            onChange={(v) => {
              setMethodTouched(true);
              setMethod(v);
            }} options={METHODS.map((m) => ({ value: m, label: t(`fees.payments.${METHOD_KEY[m]}`) }))} />
        </View>
        <View className="gap-1.5">
          <Label>{t('accounting.transactions.th_comment')}</Label>
          <Input value={comments} onChangeText={setComments} multiline />
        </View>
        {kind === 'staff-payments' ? (
          <View className="gap-1.5">
            <Label>{t('admin.accounting.staff_payments.col_receipt')}</Label>
            <Input value={receipt} onChangeText={setReceipt} placeholder={t('admin.accounting.staff_payments.auto_receipt')} />
          </View>
        ) : null}
        <View className="gap-1.5">
          <Label>{t('admin.accounting.incomes.col_attachment')}</Label>
          {file ? (
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => Linking.openURL(file)} accessibilityRole="link" className="flex-1">
                <Text className="text-primary underline" numberOfLines={1}>
                  {t('fees.payments.view')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setFile(null)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={8}>
                <Icon as={X} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
          ) : null}
          <Button variant="outline" size="sm" onPress={attach} disabled={uploading}>
            <Icon as={Paperclip} className="size-4" />
            <Text>{uploading ? t('common.loading') : file ? t('fees.payments.replaceFile') : t('fees.payments.attachFile')}</Text>
          </Button>
        </View>
        <Button onPress={() => save()} disabled={busy || !scopeId}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? null : (
          <Button variant="outline" onPress={() => save(true)} disabled={busy || !scopeId}>
            <Text>{t('app.ac_save_add_another')}</Text>
          </Button>
        )}
        {editing ? (
          <Button
            variant="ghost"
            onPress={async () => {
              if (!(await confirm({ title: t('app.ac_delete'), body: `${title} · ${amount}`, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
              const res = await adminAccounting.deleteEntry(kind, scopeId!, id!);
              if (!res.success) return toast.error(res.error || t('app.error_title'));
              refresh();
              router.back();
            }}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
