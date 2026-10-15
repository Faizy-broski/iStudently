import type { HostelRoom } from '@studently/shared-types';
import { router, Stack } from 'expo-router';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { scopeKey, useHostelScope } from '@/features/admin/hostel';
import { useCurrency } from '@/features/admin/use-currency';
import { adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Hostel rooms with occupancy, filtered by building: add, edit, delete (web: /admin/hostel/rooms). */
export default function HostelRooms() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.rooms.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const [building, setBuilding] = useState('');
  const buildings = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));
  const rooms = useApi(key ? ['admin', 'hostel-rooms', key, building] : null, ([, , , bid]) => adminHostel.rooms(scope!, (bid as string) || undefined));

  async function remove(x: HostelRoom) {
    if (!scope || !(await confirm({ title: r('msg_delete_confirm'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const res = await adminHostel.deleteRoom(scope, x.id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    rooms.mutate();
  }

  const list = rooms.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: r('header_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => rooms.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{r('header_subtitle')}</Text>
          <Button size="sm" onPress={() => router.push('/admin/hostel/room-form')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{r('btn_add')}</Text>
          </Button>
        </View>
        <View className="gap-1.5">
          <Label>{r('filter_label')}</Label>
          <Picker value={building || 'ALL'} onChange={(v) => setBuilding(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: r('filter_all') }, ...(buildings.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
        </View>
        {rooms.isLoading || !scope ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={DoorOpen} title={r('msg_no_data')} body={r('msg_no_data_desc')} />
        ) : (
          <Card className="py-0">
            {list.map((x, i) => {
              const occ = x.occupancy ?? 0;
              const full = occ >= x.capacity;
              return (
                <View key={x.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-start gap-2 px-4 py-3">
                    <View className="flex-1 gap-1">
                      <Text className="font-semibold">
                        {r('th_room')} {x.room_number}
                      </Text>
                      <Text className="text-muted-foreground text-sm">
                        {[x.building_name, `${r('th_floor')} ${x.floor}`, r(`type_${x.room_type}`, { defaultValue: x.room_type })].filter(Boolean).join(' · ')}
                      </Text>
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <View className={`rounded-full px-2 py-0.5 ${full ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                          <Text className={`text-xs ${full ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {r('th_occupancy')}: {occ}/{x.capacity}
                          </Text>
                        </View>
                        <View className="bg-muted rounded-full px-2 py-0.5">
                          <Text className="text-xs">{money(x.price_per_month)}</Text>
                        </View>
                        <View className={`rounded-full px-2 py-0.5 ${x.is_active ? 'bg-secondary' : 'bg-destructive'}`}>
                          <Text className={`text-xs ${x.is_active ? '' : 'text-white'}`}>{x.is_active ? r('status_active') : r('status_inactive')}</Text>
                        </View>
                      </View>
                    </View>
                    <Button size="icon" variant="ghost" onPress={() => router.push({ pathname: '/admin/hostel/room-form', params: { id: x.id } })} accessibilityLabel={t('common.edit')}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onPress={() => remove(x)} accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
