import { zodResolver } from '@hookform/resolvers/zod';
import { v } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleCheck, DollarSign, ListChecks, Tag, Trash2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useConfirm } from '@/components/app/confirm';
import { NumberField, SwitchField, TextField } from '@/components/app/form';
import { FormSection } from '@/components/app/layout';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';
import { useSWRConfig } from 'swr';

const schema = z.object({
  name: v.required(120),
  description: v.optional(2000),
  monthly_price: v.money(),
  quarterly_price: v.money(),
  yearly_price: v.money(),
  max_students: z.number().int().min(0, 'app.v_min_zero').nullable(),
  features: z.string().max(5000, 'app.v_too_long'),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export default function PlanForm() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const plans = useApi(editing ? ['platform', 'plans', 'all'] : null, () => platform.listPlans(true));
  const plan = plans.data?.find((p) => p.id === id);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', monthly_price: 0, quarterly_price: 0, yearly_price: 0, max_students: null, features: '', is_active: true },
  });

  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name,
        description: plan.description ?? '',
        monthly_price: plan.monthly_price,
        quarterly_price: plan.quarterly_price,
        yearly_price: plan.yearly_price,
        max_students: plan.max_students,
        features: (plan.features ?? []).join('\n'),
        is_active: plan.is_active,
      });
    }
  }, [plan, reset]);

  const refreshPlans = () => mutate((key) => Array.isArray(key) && key.includes('plans'));
  const save = useAction(
    (values: FormValues) => {
      const body = {
        ...values,
        description: values.description || null,
        features: values.features.split('\n').map((f) => f.trim()).filter(Boolean),
      };
      return editing ? platform.updatePlan(id!, body) : platform.createPlan(body);
    },
    { success: editing ? t('app.saved') : t('app.bl_created') },
  );
  const remove = useAction(platform.deletePlan, { success: t('app.bl_deleted') });

  if (editing && plans.isLoading && !plan) return <LoadingList rows={4} />;

  const onSubmit = handleSubmit(async (values) => {
    if ((await save.run(values)).ok) {
      refreshPlans();
      router.back();
    }
  });

  async function onDelete() {
    if (!plan) return;
    const ok = await confirm({
      title: t('app.bl_delete_plan_title', { name: plan.name }),
      body: t('app.bl_delete_plan_body'),
      destructive: true,
      confirmLabel: t('app.bl_delete'),
    });
    if (ok && (await remove.run(plan.id)).ok) {
      refreshPlans();
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? plan?.name ?? '' : t('app.bl_new_plan') }} />
      <Screen scroll edges={['bottom']}>
        <FormSection title={t('app.bl_plan')} icon={Tag}>
          <TextField control={control} name="name" label={t('app.bl_plan_name')} />
          <TextField control={control} name="description" label={t('app.bl_description')} multiline />
        </FormSection>
        <FormSection title={t('app.bl_amount')} icon={DollarSign}>
          <NumberField control={control} name="monthly_price" label={t('app.bl_monthly_price')} />
          <NumberField control={control} name="quarterly_price" label={t('app.bl_quarterly_price')} />
          <NumberField control={control} name="yearly_price" label={t('app.bl_yearly_price')} />
        </FormSection>
        <FormSection title={t('app.bl_features')} icon={ListChecks}>
          <NumberField control={control} name="max_students" label={t('app.bl_max_students_label')} keyboardType="number-pad" />
          <TextField control={control} name="features" label={t('app.bl_features')} hint={t('app.bl_features_hint')} multiline />
        </FormSection>
        <FormSection title={t('app.bl_status')} icon={CircleCheck}>
          <SwitchField control={control} name="is_active" label={t('app.bl_active')} hint={t('app.bl_active_hint')} />
        </FormSection>
        <Button onPress={onSubmit} disabled={save.running}>
          <Text>{t('app.bl_save')}</Text>
        </Button>
        {editing ? (
          <Button variant="ghost" className="bg-destructive-soft rounded-full" onPress={onDelete} disabled={remove.running}>
            <Icon as={Trash2} className="text-destructive size-4" />
            <Text className="text-destructive">{t('app.bl_delete')}</Text>
          </Button>
        ) : null}
      </Screen>
    </>
  );
}
