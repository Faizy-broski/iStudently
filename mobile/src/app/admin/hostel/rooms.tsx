import type { HostelRoom } from '@studently/shared-types';
import { router, Stack } from 'expo-router';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View, Pressable } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, UsageBar } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Text } from '@/components/ui/text';
import { StatusChip } from '@/components/app/status-chip';
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
        <FilterChips value={building || 'ALL'} onChange={(v) => setBuilding(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: r('filter_all') }, ...(buildings.data ?? []).map((x) => ({ value: x.id, label: x.name }))]} />
        {rooms.isLoading || !scope ? (
          <LoadingList />
        ) : !list.length ? (
          <EmptyState icon={DoorOpen} title={r('msg_no_data')} body={r('msg_no_data_desc')} />
        ) : (
          <Panel>
            {list.map((x, i) => {
              const occ = x.occupancy ?? 0;
              const full = occ >= x.capacity;
              return (
                <View key={x.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-start gap-3 px-4 py-3">
                    <IconTile icon={DoorOpen} tone={full ? 'destructive' : 'success'} size={40} />
                    <View className="flex-1 gap-1">
                      <Text className="text-sm font-semibold">
                        {r('th_room')} {x.room_number}
                      </Text>
                      <Text className="text-muted-foreground text-sm">
                        {[x.building_name, `${r('th_floor')} ${x.floor}`, r(`type_${x.room_type}`, { defaultValue: x.room_type })].filter(Boolean).join(' · ')}
                      </Text>
                      <UsageBar used={occ} total={x.capacity} label={`${r('th_occupancy')}: ${occ}/${x.capacity}`} />
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <StatusChip label={String(money(x.price_per_month))} tone="muted" className="px-2 py-0.5" />
                        <StatusChip label={x.is_active ? r('status_active') : r('status_inactive')} tone={x.is_active ? 'success' : 'destructive'} className="px-2 py-0.5" />
                      </View>
                    </View>
                    <Pressable onPress={() => router.push({ pathname: '/admin/hostel/room-form', params: { id: x.id } })} accessibilityLabel={t('common.edit')} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-4" />
                    </Pressable>
                    <Pressable onPress={() => remove(x)} accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </View>
  );
}
