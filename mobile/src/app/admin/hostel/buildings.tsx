import type { HostelBuilding } from '@studently/shared-types';
import { router, Stack } from 'expo-router';
import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View, Pressable } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { StatusChip } from '@/components/app/status-chip';
import { scopeKey, useHostelScope } from '@/features/admin/hostel';
import { adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Hostel buildings: list, add, edit, delete (web: /admin/hostel/buildings). */
export default function HostelBuildings() {
  const { t } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.buildings.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const res = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));

  async function remove(x: HostelBuilding) {
    if (!scope || !(await confirm({ title: b('msg_delete_confirm'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const r = await adminHostel.deleteBuilding(scope, x.id);
    if (!r.success) return toast.error(r.error || b('msg_save_error'));
    toast.success(b('msg_save_success'));
    res.mutate();
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: b('header_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{b('header_subtitle')}</Text>
          <Button size="sm" onPress={() => router.push('/admin/hostel/building-form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{b('btn_add')}</Text>
          </Button>
        </View>
        {res.isLoading || !scope ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={Building2} title={b('msg_no_data')} body={b('msg_no_data_desc')} />
        ) : (
          list.map((x) => (
            <Card key={x.id}>
              <CardContent className="gap-2 pt-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={Building2} className="text-primary size-5" />
                  <Text className="flex-1 text-base font-semibold">{x.name}</Text>
                  <Pressable onPress={() => router.push({ pathname: '/admin/hostel/building-form', params: { id: x.id } })} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(x)} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                {x.address ? (
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={MapPin} className="text-muted-foreground size-3.5" />
                    <Text className="text-muted-foreground text-sm">{x.address}</Text>
                  </View>
                ) : null}
                <View className="flex-row flex-wrap gap-1.5">
                  <View className="bg-secondary rounded-full px-2 py-0.5">
                    <Text className="text-xs">
                      {x.floors} {b('unit_floors')}
                    </Text>
                  </View>
                  <View className="border-border rounded-full border px-2 py-0.5">
                    <Text className="text-xs">
                      {x.room_count ?? 0} {b('unit_rooms')}
                    </Text>
                  </View>
                  <StatusChip label={x.is_active ? b('status_active') : b('status_inactive')} tone={x.is_active ? 'success' : 'destructive'} className="px-2 py-0.5" />
                </View>
                {x.description ? <Text className="text-muted-foreground text-sm">{x.description}</Text> : null}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
