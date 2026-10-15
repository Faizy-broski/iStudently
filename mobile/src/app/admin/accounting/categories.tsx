import type { AccountingCategory, AccountingCategoryType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

type Draft = { id?: string; name: string; category_type: AccountingCategoryType; is_active: boolean; description: string; order: string };
const TYPE_KEY: Record<AccountingCategoryType, string> = { incomes: 'incomeOnly', expenses: 'expensesOnly', common: 'both' };

/** Income/expense categories for the campus (web: /admin/accounting/categories). */
export default function AccountingCategories() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { scopeId } = useCampus();
  const list = useApi(scopeId ? ['admin', 'acc-categories-all', scopeId] : null, () => adminAccounting.categories(scopeId!, undefined, false));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    list.mutate();
  };

  async function save() {
    if (!draft?.name.trim()) return toast.error(t('app.v_required'));
    setBusy(true);
    const res = draft.id
      ? await adminAccounting.updateCategory(scopeId!, draft.id, { name: draft.name.trim(), category_type: draft.category_type, is_active: draft.is_active, description: draft.description.trim() || undefined, display_order: Number(draft.order) || 0 })
      : await adminAccounting.createCategory(scopeId!, { name: draft.name.trim(), category_type: draft.category_type, description: draft.description.trim() || undefined, display_order: Number(draft.order) || 0 });
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    setDraft(null);
    refresh();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('accounting.categories.title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => setDraft({ name: '', category_type: 'common', is_active: true, description: '', order: '0' })} accessibilityLabel={t('accounting.categories.addCategory')}>
              <Icon as={Plus} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList<AccountingCategory>
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          onRefresh={refresh}
          emptyTitle={t('accounting.categories.noCategories')}
          keyExtractor={(c) => c.id}
          renderItem={(c) => (
            <Pressable onPress={() => setDraft({ id: c.id, name: c.name, category_type: c.category_type, is_active: c.is_active, description: c.description ?? '', order: String(c.display_order ?? 0) })} className="flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-1">
                <Text className={c.is_active ? 'font-medium' : 'text-muted-foreground font-medium'}>{c.name}</Text>
                <Badge variant="outline" className="self-start">
                  <Text>{t(`accounting.transactions.${TYPE_KEY[c.category_type]}`)}</Text>
                </Badge>
                <Text className="text-muted-foreground text-xs">{[`${t('admin.accounting.categories.col_order')}: ${c.display_order ?? 0}`, c.description].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pressable
                hitSlop={8}
                accessibilityLabel={t('accounting.categories.deleteCategory')}
                onPress={async () => {
                  if (!(await confirm({ title: t('accounting.categories.deleteCategory'), body: c.name, destructive: true, confirmLabel: t('app.bl_delete') }))) return;
                  const res = await adminAccounting.deleteCategory(scopeId!, c.id);
                  if (!res.success) return toast.error(res.error || t('app.error_title'));
                  refresh();
                }}>
                <Icon as={Trash2} className="text-muted-foreground size-5" />
              </Pressable>
            </Pressable>
          )}
        />
      </View>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t('app.edit') : t('accounting.categories.addCategory')}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <View className="gap-3">
              <Label>{t('app.be_name')}</Label>
              <Input value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} autoFocus />
              <Label>{t('accounting.categories.categoryType')}</Label>
              <FilterChips<AccountingCategoryType>
                value={draft.category_type}
                onChange={(category_type) => setDraft({ ...draft, category_type })}
                options={(['incomes', 'expenses', 'common'] as const).map((k) => ({ value: k, label: t(`accounting.transactions.${TYPE_KEY[k]}`) }))}
              />
              <Text className="text-muted-foreground text-xs">{t('admin.accounting.categories.form_type_hint')}</Text>
              <Label>{t('admin.accounting.categories.form_desc')}</Label>
              <Input value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} placeholder={t('admin.accounting.categories.form_desc_placeholder')} multiline />
              <Label>{t('admin.accounting.categories.form_order')}</Label>
              <Input value={draft.order} onChangeText={(order) => setDraft({ ...draft, order: order.replace(/\D/g, '') })} keyboardType="number-pad" />
              <Text className="text-muted-foreground text-xs">{t('admin.accounting.categories.form_order_hint')}</Text>
              {draft.id ? (
                <View className="flex-row items-center justify-between">
                  <Text>{t('school.students.fields.active')}</Text>
                  <Switch checked={draft.is_active} onCheckedChange={(is_active) => setDraft({ ...draft, is_active })} />
                </View>
              ) : null}
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={save} disabled={busy}>
              <Text>{t('app.bl_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
