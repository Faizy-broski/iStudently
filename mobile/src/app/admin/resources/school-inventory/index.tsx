import type { InventoryCategoryType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronRight, Minus, Package, Plus, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

const INVENTORY_TYPES: InventoryCategoryType[] = ['CATEGORY', 'STATUS', 'LOCATION', 'PERSON'];
type Editable = { id?: string; title: string; color?: string };

/** Inventory categories, statuses, locations and people; edits saved together (web: /admin/resources/school-inventory). */
export default function SchoolInventory() {
  const { t } = useTranslation();
  const v = (k: string, o?: Record<string, unknown>) => t(`school.resources.inventory.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId, campus } = useCampus();
  const server = useApi(['admin', 'inventory-cats', campusId ?? 'school'], () => adminResources.inventoryCategories(campusId), { revalidateOnFocus: false });
  const [edit, setEdit] = useState<Record<InventoryCategoryType, Editable[]>>({ CATEGORY: [], STATUS: [], LOCATION: [], PERSON: [] });
  const [drafts, setDrafts] = useState<Record<InventoryCategoryType, string>>({ CATEGORY: '', STATUS: '', LOCATION: '', PERSON: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!server.data) return;
    const g: Record<InventoryCategoryType, Editable[]> = { CATEGORY: [], STATUS: [], LOCATION: [], PERSON: [] };
    for (const c of server.data) g[c.category_type]?.push({ id: c.id, title: c.title, color: c.color });
    setEdit(g);
  }, [server.data]);

  const add = (type: InventoryCategoryType) => {
    const title = drafts[type].trim();
    if (!title) return;
    setEdit((p) => ({ ...p, [type]: [...p[type], { title }] }));
    setDrafts((p) => ({ ...p, [type]: '' }));
  };
  async function remove(type: InventoryCategoryType, idx: number) {
    if (!(await confirm({ title: v('delete_confirm_category'), destructive: true, confirmLabel: v('btn_remove') }))) return;
    setEdit((p) => ({ ...p, [type]: p[type].filter((_, i) => i !== idx) }));
  }

  async function save() {
    setSaving(true);
    try {
      for (const type of INVENTORY_TYPES) {
        const existing = (server.data ?? []).filter((c) => c.category_type === type).map((c) => c.id);
        const r = await adminResources.saveInventoryCategories(
          edit[type].map((c) => ({ id: c.id, category_type: type, title: c.title, color: c.color })),
          existing,
          campusId,
        );
        if (!r.success) return toast.error(r.error || v('msg_save_error'));
      }
      toast.success(v('msg_save_success'));
      server.mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: v('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-2">
          <Icon as={Package} className="text-primary size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">
            {v('subtitle')} {campus ? v('campus_label', { name: campus.name }) : ''}
          </Text>
        </View>
        {server.isLoading ? (
          <LoadingList />
        ) : (
          INVENTORY_TYPES.map((type) => {
            const rows = edit[type];
            return (
              <Card key={type}>
                <CardContent className="gap-2 pt-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold">{v(`category_type_${type.toLowerCase()}`)}</Text>
                    <Text className="text-muted-foreground text-xs">{rows.length === 1 ? `1 ${v('entry_singular')}` : v('entries_found', { count: rows.length })}</Text>
                  </View>
                  {rows.map((c, i) => {
                    const count = (server.data ?? []).find((x) => x.id === c.id)?.item_count ?? 0;
                    return (
                      <View key={c.id ?? `n${i}`}>
                        {i > 0 ? <Separator /> : null}
                        <View className="flex-row items-center gap-2 py-1.5">
                          <Pressable
                            className="flex-1 flex-row items-center gap-1"
                            disabled={!c.id}
                            onPress={() => router.push({ pathname: '/admin/resources/school-inventory/items', params: { type, categoryId: c.id!, categoryTitle: c.title } })}>
                            <Text className={c.id ? 'text-primary' : ''}>{c.title}</Text>
                            {c.id ? <Icon as={ChevronRight} className="text-muted-foreground size-3.5 rtl:rotate-180" /> : null}
                          </Pressable>
                          <Text className="text-muted-foreground w-10 text-end text-sm">{count}</Text>
                          <Button size="icon" variant="ghost" onPress={() => remove(type, i)} accessibilityLabel={v('btn_remove')}>
                            <Icon as={Minus} className="text-destructive size-4" />
                          </Button>
                        </View>
                      </View>
                    );
                  })}
                  <View className="flex-row items-center gap-2">
                    <Input className="flex-1" value={drafts[type]} onChangeText={(x) => setDrafts((p) => ({ ...p, [type]: x }))} onSubmitEditing={() => add(type)} placeholder={v('input_placeholder')} />
                    <Button size="icon" variant="outline" onPress={() => add(type)} accessibilityLabel={v('btn_add')}>
                      <Icon as={Plus} className="text-foreground size-4" />
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
      <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t p-4">
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{saving ? v('saving_button') : v('save_button')}</Text>
        </Button>
      </View>
    </View>
  );
}
