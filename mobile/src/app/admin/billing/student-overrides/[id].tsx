import type { FeeOverride } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, DollarSign, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** One student's fee overrides: list, add, edit, activate/deactivate, delete (web: StudentFeeOverrideModal). */
export default function StudentFeeOverrides() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id, name, grade } = useLocalSearchParams<{ id: string; name?: string; number?: string; grade?: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const list = useApi(scopeId && id ? ['admin', 'student-overrides', scopeId, id] : null, ([, , sid, st]) => adminFees.studentOverrides(sid as string, st as string));
  const categories = useApi(scopeId ? ['admin', 'fee-categories', scopeId] : null, ([, , sid]) => adminFees.categories(sid as string));
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const [form, setForm] = useState<{ editingId: string | null; year: string; categoryId: string; amount: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const overrides = list.data ?? [];
  const currentYear = years.data?.find((y) => y.is_current)?.name ?? '';

  const refresh = () => {
    list.mutate();
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && k[1] === 'all-overrides');
  };

  function openNew() {
    setForm({ editingId: null, year: currentYear, categoryId: '', amount: '', reason: '' });
  }
  function openEdit(o: FeeOverride) {
    setForm({ editingId: o.id, year: o.academic_year, categoryId: o.fee_category_id, amount: String(o.override_amount), reason: o.reason ?? '' });
  }

  async function save() {
    if (!form || !scopeId || !id) return;
    if (!form.categoryId || !form.year || !form.amount) return toast.error(t('app.fr_ov_fill_required'));
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) return toast.error(t('app.fr_ov_bad_amount'));
    setBusy(true);
    const res = form.editingId
      ? await adminFees.updateOverride(scopeId, form.editingId, { override_amount: amount, reason: form.reason.trim() || undefined })
      : await adminFees.createOverride(scopeId, { student_id: id, fee_category_id: form.categoryId, academic_year: form.year, override_amount: amount, reason: form.reason.trim() || undefined });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.fr_ov_save_failed'));
    toast.success(t(form.editingId ? 'app.fr_ov_updated' : 'app.fr_ov_created'));
    setForm(null);
    refresh();
  }

  async function toggle(o: FeeOverride) {
    if (!scopeId) return;
    const res = await adminFees.updateOverride(scopeId, o.id, { is_active: !o.is_active });
    if (!res.success) return toast.error(res.error || t('app.fr_ov_save_failed'));
    toast.success(t(o.is_active ? 'app.fr_ov_deactivated' : 'app.fr_ov_activated'));
    refresh();
  }

  async function remove(o: FeeOverride) {
    if (!scopeId) return;
    if (!(await confirm({ title: t('app.fr_ov_delete_confirm'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const res = await adminFees.deleteOverride(scopeId, o.id);
    if (!res.success) return toast.error(res.error || t('app.fr_ov_save_failed'));
    toast.success(t('app.fr_ov_deleted'));
    refresh();
  }

  // Categories that already have an override for the chosen year are left out (except the one being edited).
  const available = (categories.data ?? []).filter((cat) =>
    form?.editingId
      ? true
      : !overrides.some((o) => o.fee_category_id === cat.id && o.academic_year === form?.year),
  );

  return (
    <>
      <Stack.Screen options={{ title: t('app.fr_ov_title') }} />
      <Screen scroll edges={['bottom']}>
        <View>
          <Text className="text-lg font-semibold">{name || '—'}</Text>
          {grade ? <Text className="text-muted-foreground text-sm">{grade}</Text> : null}
        </View>
        <View className="flex-row gap-3 rounded-xl border border-info-soft bg-info-soft p-3">
          <Icon as={AlertCircle} className="mt-0.5 size-4 text-brand dark:text-brand-secondary " />
          <View className="flex-1">
            <Text className="text-sm font-medium text-brand dark:text-brand-secondary ">{t('app.fr_ov_info_title')}</Text>
            <Text className="text-xs text-brand dark:text-brand-secondary ">{t('app.fr_ov_info_body')}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium">{t('app.fr_ov_current')}</Text>
          {!form ? (
            <Button size="sm" onPress={openNew}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{t('app.fr_ov_add')}</Text>
            </Button>
          ) : null}
        </View>

        {list.isLoading ? (
          <LoadingList rows={2} />
        ) : overrides.length === 0 ? (
          <EmptyState icon={DollarSign} title={t('app.fr_ov_none')} />
        ) : (
          overrides.map((o) => (
            <Card key={o.id} className={cn('py-3', !o.is_active && 'opacity-60')}>
              <CardContent className="flex-row items-start gap-3 px-4">
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-semibold">{o.fee_categories?.name ?? '—'}</Text>
                    {!o.is_active ? (
                      <Badge variant="secondary">
                        <Text>{t('common.inactive')}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <Text className="text-muted-foreground text-sm">{o.academic_year}</Text>
                  {o.reason ? <Text className="text-muted-foreground text-xs">{o.reason}</Text> : null}
                </View>
                <View className="items-end gap-2">
                  <Text className="font-semibold text-success ">{money(o.override_amount)}</Text>
                  <View className="flex-row gap-3">
                    <Pressable onPress={() => openEdit(o)} accessibilityRole="button" accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                    </Pressable>
                    <Pressable onPress={() => toggle(o)} accessibilityRole="button" accessibilityLabel={t(o.is_active ? 'app.fr_ov_deactivate' : 'app.fr_ov_activate')} hitSlop={8}>
                      <Icon as={o.is_active ? EyeOff : Eye} className="text-muted-foreground size-4" />
                    </Pressable>
                    <Pressable onPress={() => remove(o)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))
        )}

        {form ? (
          <Card className="gap-3 py-4">
            <CardContent className="gap-3 px-4">
              <Text className="text-sm font-medium">{t(form.editingId ? 'app.fr_ov_edit' : 'app.fr_ov_new')}</Text>
              <View className="gap-1.5">
                <Label>{`${t('app.fr_ov_year')} *`}</Label>
                {form.editingId ? (
                  <Text className="text-muted-foreground">{form.year}</Text>
                ) : (
                  <Picker
                    value={form.year}
                    onChange={(v) => setForm((f) => (f ? { ...f, year: v, categoryId: '' } : f))}
                    placeholder={t('app.fr_ov_select_year')}
                    options={(years.data ?? []).map((y) => ({ value: y.name, label: y.is_current ? `${y.name} (${t('app.fr_ov_current_year')})` : y.name }))}
                  />
                )}
              </View>
              <View className="gap-1.5">
                <Label>{`${t('app.fr_ov_category')} *`}</Label>
                {form.editingId ? (
                  <Text className="text-muted-foreground">{(categories.data ?? []).find((c) => c.id === form.categoryId)?.name ?? '—'}</Text>
                ) : (
                  <Picker
                    value={form.categoryId}
                    onChange={(v) => setForm((f) => (f ? { ...f, categoryId: v } : f))}
                    placeholder={t('app.fr_ov_select_category')}
                    options={available.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                  />
                )}
              </View>
              <View className="gap-1.5">
                <Label>{`${t('app.fr_ov_amount')} *`}</Label>
                <Input value={form.amount} onChangeText={(v) => setForm((f) => (f ? { ...f, amount: v.replace(/[^\d.]/g, '') } : f))} keyboardType="decimal-pad" placeholder={t('app.fr_ov_amount_ph')} />
                <Text className="text-muted-foreground text-xs">{t('app.fr_ov_amount_hint')}</Text>
              </View>
              <View className="gap-1.5">
                <Label>{t('app.fr_ov_reason')}</Label>
                <Textarea value={form.reason} onChangeText={(v) => setForm((f) => (f ? { ...f, reason: v } : f))} placeholder={t('app.fr_ov_reason_ph')} />
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setForm(null)}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button className="flex-1" onPress={save} disabled={busy}>
                  <Text>{busy ? t('app.fr_ov_saving') : t(form.editingId ? 'app.fr_ov_update' : 'app.fr_ov_create')}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
