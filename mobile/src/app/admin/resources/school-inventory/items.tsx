import type { InventoryCategoryType } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

const TYPES: InventoryCategoryType[] = ['CATEGORY', 'STATUS', 'LOCATION', 'PERSON'];
type Item = { key: string; id?: string; title: string; quantity: string; comments: string; category_ids: string[] };

/** Items under one inventory category: quantity, comments, category/status/location/person (web: school-inventory/inventory). */
export default function InventoryItems() {
  const { t } = useTranslation();
  const v = (k: string, o?: Record<string, unknown>) => t(`school.resources.inventory.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const { type, categoryId, categoryTitle } = useLocalSearchParams<{ type?: InventoryCategoryType; categoryId?: string; categoryTitle?: string }>();
  const cats = useApi(['admin', 'inventory-cats', campusId ?? 'school'], () => adminResources.inventoryCategories(campusId));
  const items = useApi(['admin', 'inventory-items', campusId ?? 'school', categoryId ?? ''], ([, , , cid]) => adminResources.inventoryItems(campusId, (cid as string) || undefined), { revalidateOnFocus: false });
  const [rows, setRows] = useState<Item[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!items.data) return;
    setRows(items.data.map((i) => ({ key: i.id, id: i.id, title: i.title, quantity: String(i.quantity ?? 0), comments: i.comments ?? '', category_ids: (i.categories ?? []).map((c) => c.id) })));
  }, [items.data]);

  const ofType = (ty: InventoryCategoryType) => (cats.data ?? []).filter((c) => c.category_type === ty);
  const patch = (key: string, p: Partial<Item>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const setCat = (r: Item, ty: InventoryCategoryType, id: string) => {
    const same = new Set(ofType(ty).map((c) => c.id));
    patch(r.key, { category_ids: [...r.category_ids.filter((x) => !same.has(x)), ...(id ? [id] : [])] });
  };

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setRows((p) => [...p, { key: `n${Date.now()}`, title, quantity: '0', comments: '', category_ids: categoryId ? [categoryId] : [] }]);
    setDraft('');
  };

  async function remove(r: Item) {
    if (!(await confirm({ title: t('app.inv_delete_item'), destructive: true, confirmLabel: v('btn_remove') }))) return;
    // Like the web, a saved item is deleted right away.
    if (r.id) {
      const res = await adminResources.deleteInventoryItem(r.id);
      if (!res.success) return toast.error(res.error || t('app.inv_delete_failed'));
      toast.success(t('app.inv_deleted'));
    }
    setRows((p) => p.filter((x) => x.key !== r.key));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await adminResources.saveInventoryItems(
        rows.map((r) => ({ id: r.id, title: r.title, quantity: parseInt(r.quantity, 10) || 0, comments: r.comments, category_ids: r.category_ids })),
        rows.filter((r) => r.id).map((r) => r.id!),
        campusId,
      );
      if (!res.success) return toast.error(res.error || t('app.inv_save_failed'));
      toast.success(t('app.inv_saved'));
      items.mutate();
      cats.mutate();
    } finally {
      setSaving(false);
    }
  }

  const title = type && categoryTitle ? `${v(`category_type_${type.toLowerCase()}`)}: ${categoryTitle}` : t('app.inv_inventory');
  if (items.isLoading || cats.isLoading) return <LoadingList />;

  return (
    <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
        {rows.map((r) => (
          <Card key={r.key}>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <Input className="flex-1" value={r.title} onChangeText={(x) => patch(r.key, { title: x })} />
                <Input className="w-20" value={r.quantity} onChangeText={(x) => patch(r.key, { quantity: x })} keyboardType="number-pad" />
                <Button size="icon" variant="ghost" onPress={() => remove(r)} accessibilityLabel={v('btn_remove')}>
                  <Icon as={Minus} className="text-destructive size-4" />
                </Button>
              </View>
              <Input value={r.comments} onChangeText={(x) => patch(r.key, { comments: x })} placeholder={t('app.inv_comments')} />
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((ty) => (
                  <View key={ty} className="min-w-[46%] flex-1 gap-1" pointerEvents={type === ty ? 'none' : 'auto'} style={{ opacity: type === ty ? 0.6 : 1 }}>
                    <Label className="text-xs">{v(`category_type_${ty.toLowerCase()}`)}</Label>
                    <Picker
                      value={r.category_ids.find((x) => ofType(ty).some((c) => c.id === x)) ?? '__none__'}
                      onChange={(x) => setCat(r, ty, x === '__none__' ? '' : x)}
                      options={[{ value: '__none__', label: '-' }, ...ofType(ty).map((c) => ({ value: c.id, label: c.title }))]}
                    />
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        ))}
        <View className="flex-row items-center gap-2">
          <Input className="flex-1" value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder={t('app.inv_add_item')} />
          <Button size="icon" variant="outline" onPress={add} accessibilityLabel={v('btn_add')}>
            <Icon as={Plus} className="text-foreground size-4" />
          </Button>
        </View>
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? v('saving_button') : v('save_button')}</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
