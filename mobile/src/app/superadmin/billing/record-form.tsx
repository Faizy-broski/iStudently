import { zodResolver } from '@hookform/resolvers/zod';
import type { BillingCycle, BillingRecordInput, PaymentStatus } from '@studently/api-client';
import { dueDateFor, planPrice, todayIso, v, vBilling } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { NumberField, TextField } from '@/components/app/form';
import { SelectField } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRefreshBilling } from '@/features/superadmin/billing';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const CYCLES: BillingCycle[] = ['Monthly', 'Quarterly', 'Yearly'];
const STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'overdue'];

const schema = z
  .object({
    school_id: z.string().min(1, 'app.v_required'),
    billing_plan_id: z.string().min(1, 'app.v_required'),
    billing_cycle: z.enum(CYCLES),
    amount: v.money(),
    currency: vBilling.currency(),
    start_date: vBilling.date(),
    due_date: vBilling.date(),
    payment_status: z.enum(STATUSES),
    payment_date: z.string().trim().optional(),
    payment_method: v.optional(60),
    transaction_id: v.optional(120),
    notes: v.optional(2000),
  })
  .refine((f) => f.payment_status !== 'paid' || !f.payment_date || /^\d{4}-\d{2}-\d{2}$/.test(f.payment_date), {
    path: ['payment_date'],
    message: 'app.v_date',
  });
type FormValues = z.infer<typeof schema>;

export default function RecordForm() {
  const { t } = useTranslation();
  const refreshAll = useRefreshBilling();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  const plans = useApi(['platform', 'plans', 'all'], () => platform.listPlans(true));
  const record = useApi(editing ? ['platform', 'record', id] : null, () => platform.getRecord(id!));

  const { control, handleSubmit, reset, setValue, getFieldState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      school_id: '',
      billing_plan_id: '',
      billing_cycle: 'Monthly',
      amount: 0,
      currency: 'USD',
      start_date: todayIso(),
      due_date: dueDateFor(todayIso(), 'Monthly'),
      payment_status: 'unpaid',
      payment_date: '',
      payment_method: '',
      transaction_id: '',
      notes: '',
    },
  });

  // Load the record being edited (once).
  const loaded = useRef(false);
  useEffect(() => {
    const r = record.data;
    if (!r || loaded.current) return;
    loaded.current = true;
    reset({
      school_id: r.school_id,
      billing_plan_id: r.billing_plan_id,
      billing_cycle: r.billing_cycle,
      amount: Number(r.amount),
      currency: r.currency,
      start_date: r.start_date,
      due_date: r.due_date,
      payment_status: r.payment_status,
      payment_date: r.payment_date ?? '',
      payment_method: r.payment_method ?? '',
      transaction_id: r.transaction_id ?? '',
      notes: r.notes ?? '',
    });
  }, [record.data, reset]);

  // New invoices use the platform currency from Settings (not a fixed USD), unless changed by hand.
  const platformSettings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const platformCurrency = platformSettings.data?.currency ?? null;
  useEffect(() => {
    if (platformCurrency && !id && !getFieldState('currency').isDirty) setValue('currency', platformCurrency);
  }, [platformCurrency, id, setValue, getFieldState]);

  // Auto-fill amount from plan + cycle, and due date from start + cycle, unless edited by hand.
  const [planId, cycle, start, status] = useWatch({ control, name: ['billing_plan_id', 'billing_cycle', 'start_date', 'payment_status'] });
  useEffect(() => {
    const plan = plans.data?.find((p) => p.id === planId);
    if (plan && !getFieldState('amount').isDirty) setValue('amount', planPrice(plan, cycle));
  }, [planId, cycle, plans.data, setValue, getFieldState]);
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') && !getFieldState('due_date').isDirty) setValue('due_date', dueDateFor(start, cycle));
  }, [start, cycle, setValue, getFieldState]);

  const schoolOptions = useMemo(
    () => (schools.data ?? []).map((s) => ({ value: s.id, label: s.parent_school_id ? `↳ ${s.name}` : s.name })),
    [schools.data],
  );
  const planOptions = useMemo(
    () =>
      (plans.data ?? [])
        .filter((p) => p.is_active || p.id === record.data?.billing_plan_id)
        .map((p) => ({ value: p.id, label: p.name })),
    [plans.data, record.data],
  );

  const save = useAction(
    (values: FormValues) => {
      const body: BillingRecordInput = {
        ...values,
        payment_date: values.payment_status === 'paid' ? values.payment_date || todayIso() : null,
        payment_method: values.payment_method || null,
        transaction_id: values.transaction_id || null,
        notes: values.notes || null,
      };
      return editing ? platform.updateRecord(id!, body) : platform.createRecord(body);
    },
    { success: editing ? t('app.saved') : t('app.bl_created') },
  );

  if ((editing && record.isLoading) || (schools.isLoading && !schools.data) || (plans.isLoading && !plans.data)) return <LoadingList rows={5} />;

  const onSubmit = handleSubmit(async (values) => {
    const result = await save.run(values);
    if (result.ok) {
      refreshAll();
      if (!editing && result.data) router.replace({ pathname: '/superadmin/billing/record/[id]', params: { id: result.data.id } });
      else router.back();
    }
  });

  return (
    <>
      <Stack.Screen options={{ title: editing ? record.data?.invoice_number ?? '' : t('app.bl_new_invoice') }} />
      <Screen scroll edges={['bottom']}>
        <SelectField control={control} name="school_id" label={t('app.bl_school')} options={schoolOptions} placeholder={t('app.bl_pick_school')} />
        <SelectField control={control} name="billing_plan_id" label={t('app.bl_plan')} options={planOptions} placeholder={t('app.bl_pick_plan')} />
        <SelectField
          control={control}
          name="billing_cycle"
          label={t('app.bl_cycle')}
          options={CYCLES.map((c) => ({ value: c, label: t(`app.bl_cycle_${c}`) }))}
        />
        <NumberField control={control} name="amount" label={t('app.bl_amount')} />
        <TextField control={control} name="currency" label={t('app.bl_currency')} autoCapitalize="characters" maxLength={3} />
        <TextField control={control} name="start_date" label={t('app.bl_start_date')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
        <TextField control={control} name="due_date" label={t('app.bl_due_date')} placeholder={t('app.bl_date_hint')} keyboardType="numbers-and-punctuation" />
        <SelectField
          control={control}
          name="payment_status"
          label={t('app.bl_status')}
          options={STATUSES.map((s) => ({ value: s, label: t(`app.sa_pay_status_${s}`) }))}
        />
        {status === 'paid' ? (
          <>
            <TextField control={control} name="payment_date" label={t('app.bl_payment_date')} placeholder={todayIso()} keyboardType="numbers-and-punctuation" />
            <TextField control={control} name="payment_method" label={t('app.bl_payment_method')} />
            <TextField control={control} name="transaction_id" label={t('app.bl_transaction_id')} autoCapitalize="none" />
          </>
        ) : null}
        <TextField control={control} name="notes" label={t('app.bl_notes')} multiline />
        <Button onPress={onSubmit} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
      </Screen>
    </>
  );
}
