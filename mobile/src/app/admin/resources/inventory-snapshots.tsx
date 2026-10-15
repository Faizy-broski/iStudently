import type { InventorySnapshot } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Camera, ChevronLeft, Package, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

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

/** Read-only copies of the inventory at a point in time: create, view, delete (web: /admin/resources/inventory-snapshots). */
export default function InventorySnapshots() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.resources.snapshots.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId, campus } = useCampus();
  const list = useApi(['admin', 'inventory-snapshots', campusId ?? 'school'], () => adminResources.snapshots(campusId));
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useApi(selected ? ['admin', 'inventory-snapshot', selected] : null, ([, , sid]) => adminResources.snapshot(sid as string));
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const date = (d: string, long = false) => new Date(d).toLocaleDateString(i18n.language, long ? { year: 'numeric', month: 'long', day: 'numeric' } : undefined);

  async function create() {
    if (!title.trim()) return toast.error(s('input_placeholder'));
    setCreating(true);
    try {
      const r = await adminResources.createSnapshot(title.trim(), campusId);
      if (!r.success || !r.data) return toast.error(r.error || s('msg_create_error'));
      setTitle('');
      toast.success(s('msg_create_success', { title: r.data.title }));
      list.mutate();
    } finally {
      setCreating(false);
    }
  }

  async function remove(x: InventorySnapshot) {
    if (!(await confirm({ title: s('delete_dialog_title'), body: s('delete_confirm', { title: x.title }), destructive: true, confirmLabel: s('btn_confirm') }))) return;
    const r = await adminResources.deleteSnapshot(x.id);
    if (!r.success) return toast.error(r.error || s('msg_delete_error'));
    if (selected === x.id) setSelected(null);
    toast.success(s('msg_delete_success'));
    list.mutate();
  }

  if (selected) {
    const d = detail.data;
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ title: d?.title ?? s('title') }} />
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
          <Button size="sm" variant="outline" className="self-start" onPress={() => setSelected(null)}>
            <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
            <Text>{s('back_button')}</Text>
          </Button>
          {detail.isLoading ? (
            <LoadingList />
          ) : !d ? (
            <Text className="text-muted-foreground">{s('snapshot_not_found')}</Text>
          ) : (
            <>
              <Text className="text-muted-foreground text-sm">
                {s('detail_title')} {date(d.created_at, true)}
                {campus ? ` — ${campus.name}` : ''}
              </Text>
              <View className="flex-row items-center gap-2">
                <Icon as={Package} className="text-foreground size-4" />
                <Text className="font-semibold">{d.items.length > 1 ? s('detail_items_count', { count: d.items.length }) : s('detail_items_header')}</Text>
              </View>
              {!d.items.length ? (
                <Text className="text-muted-foreground py-6 text-center">{s('no_items')}</Text>
              ) : (
                <Card className="py-0">
                  {d.items.map((it, i) => (
                    <View key={it.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="gap-1 px-4 py-3">
                        <View className="flex-row">
                          <Text className="flex-1 font-medium">{it.title}</Text>
                          <Text className="text-sm">
                            {s('qty_short')}: {it.quantity}
                          </Text>
                        </View>
                        {it.comments ? <Text className="text-muted-foreground text-sm">{it.comments}</Text> : null}
                        <View className="flex-row flex-wrap gap-1">
                          {it.categories.length ? (
                            it.categories.map((c) => (
                              <View key={c.id} className="border-border rounded border px-1.5">
                                <Text className="text-[11px]">
                                  {s(`category_type_${c.category_type.toLowerCase()}`)}: {c.title}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text className="text-muted-foreground text-xs">{s('no_assignments')}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  const rows = list.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={Camera} className="text-primary size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">
            {s('subtitle')} {campus ? s('campus_label', { name: campus.name }) : ''}
          </Text>
        </View>
        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{s('create_section_title')}</Text>
            <View className="flex-row gap-2">
              <Input className="flex-1" value={title} onChangeText={setTitle} onSubmitEditing={create} placeholder={s('input_placeholder')} />
              <Button onPress={create} disabled={creating || !title.trim()}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{creating ? s('creating_button') : s('create_button')}</Text>
              </Button>
            </View>
            {campus ? <Text className="text-muted-foreground text-xs">{s('capture_note', { name: campus.name })}</Text> : null}
          </CardContent>
        </Card>
        <Text className="font-semibold">{list.isLoading ? s('loading') : rows.length === 1 ? s('snapshots_found_singular') : s('snapshots_found', { count: rows.length })}</Text>
        {list.isLoading ? (
          <LoadingList />
        ) : !rows.length ? (
          <View className="items-center gap-1 py-8">
            <Text className="text-muted-foreground">{s('no_snapshots')}</Text>
            <Text className="text-muted-foreground text-center text-xs">{s('no_snapshots_desc')}</Text>
          </View>
        ) : (
          <Card className="py-0">
            {rows.map((x, i) => (
              <View key={x.id}>
                {i > 0 ? <Separator /> : null}
                <Pressable onPress={() => setSelected(x.id)} className="active:bg-muted flex-row items-center gap-2 px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-primary font-medium">{x.title}</Text>
                    <Text className="text-muted-foreground text-xs">{date(x.created_at)}</Text>
                  </View>
                  <Button size="icon" variant="ghost" onPress={() => remove(x)} accessibilityLabel={t('common.delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Button>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
