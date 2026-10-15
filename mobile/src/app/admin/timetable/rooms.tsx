import { ROOM_TYPES, type Room, type RoomType } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Eye, EyeOff, Plus, Power, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ROOM_TYPE_TONE } from '@/features/admin/timetable';
import { useCampus } from '@/features/campus/campus';
import { adminGenerator } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Rooms used by the auto-generator for room clashes and room-type matching (web: /admin/rooms). */
export default function Rooms() {
  const { t } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`app.rm_${k}`, o);
  const typeLabel = (x: RoomType) => t(`app.rm_type_${x}`);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const res = useApi(['admin', 'rooms', campusId ?? 'school', showInactive ? 'all' : 'active'], ([, , , s]) => adminGenerator.rooms(campusId, s !== 'all'));
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('classroom');
  const [capacity, setCapacity] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [saving, setSaving] = useState(false);

  const q = search.trim().toLowerCase();
  const rooms = (res.data ?? []).filter((x) => !q || x.name.toLowerCase().includes(q) || (x.building || '').toLowerCase().includes(q) || typeLabel(x.room_type).toLowerCase().includes(q));

  async function add() {
    if (!name.trim()) return toast.error(r('err_name'));
    setSaving(true);
    try {
      const out = await adminGenerator.createRoom({ name: name.trim(), campus_id: campusId, room_type: type, capacity: capacity ? parseInt(capacity, 10) : undefined, building: building.trim() || undefined, floor: floor.trim() || undefined });
      if (!out.success) return toast.error(out.error || r('add_failed'));
      toast.success(r('added', { name: name.trim() }));
      setName('');
      setCapacity('');
      setBuilding('');
      setFloor('');
      setType('classroom');
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(room: Room) {
    const out = await adminGenerator.updateRoom(room.id, { is_active: !room.is_active });
    if (!out.success) return toast.error(out.error || r('update_failed'));
    toast.success(room.is_active ? r('deactivated', { name: room.name }) : r('reactivated', { name: room.name }));
    res.mutate();
  }

  async function remove(room: Room) {
    if (!(await confirm({ title: r('delete_title', { name: room.name }), body: r('delete_body'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const out = await adminGenerator.deleteRoom(room.id);
    if (!out.success) return toast.error(out.error || r('delete_failed'));
    toast.success(r('deleted', { name: room.name }));
    res.mutate();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: r('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="text-muted-foreground text-sm">{r('subtitle')}</Text>
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{r('add_title')}</Text>
            <Text className="text-muted-foreground text-xs">{r('add_desc')}</Text>
            <View className="gap-1.5">
              <Label>{r('f_name')} *</Label>
              <Input value={name} onChangeText={setName} placeholder={r('ph_name')} />
            </View>
            <View className="gap-1.5">
              <Label>{r('f_type')}</Label>
              <Picker value={type} onChange={(v) => setType(v as RoomType)} options={ROOM_TYPES.map((x) => ({ value: x, label: typeLabel(x) }))} />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{r('f_capacity')}</Label>
                <Input value={capacity} onChangeText={(v) => setCapacity(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="30" />
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{r('f_building')}</Label>
                <Input value={building} onChangeText={setBuilding} placeholder={r('ph_building')} />
              </View>
              <View className="w-20 gap-1.5">
                <Label>{r('f_floor')}</Label>
                <Input value={floor} onChangeText={setFloor} placeholder="1" />
              </View>
            </View>
            <Button onPress={add} disabled={saving} className="self-end">
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{r('add_btn')}</Text>
            </Button>
          </CardContent>
        </Card>

        <View className="flex-row items-center justify-between">
          <Text className="font-semibold">{r('list_title', { count: rooms.length })}</Text>
          <Button size="sm" variant="outline" onPress={() => setShowInactive((v) => !v)}>
            <Icon as={showInactive ? EyeOff : Eye} className="text-foreground size-4" />
            <Text>{showInactive ? r('hide_inactive') : r('show_inactive')}</Text>
          </Button>
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder={r('search_ph')} />
        {res.isLoading && !res.data ? (
          <LoadingList />
        ) : rooms.length === 0 ? (
          <EmptyState title={q ? r('no_match') : r('none')} body={q ? undefined : r('none_hint')} />
        ) : (
          <Card>
            {rooms.map((room, i) => (
              <View key={room.id}>
                {i > 0 ? <Separator /> : null}
                <View className={cn('gap-1.5 px-4 py-3', !room.is_active && 'opacity-60')}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 font-medium" numberOfLines={1}>
                      {room.name}
                    </Text>
                    <View className={cn('rounded-full px-2 py-0.5', ROOM_TYPE_TONE[room.room_type])}>
                      <Text className={cn('text-xs', ROOM_TYPE_TONE[room.room_type])}>{typeLabel(room.room_type)}</Text>
                    </View>
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {r('capacity_short')}: {room.capacity ?? '—'} · {r('f_building')}: {room.building || '—'} · {r('f_floor')}: {room.floor || '—'}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className={cn('text-xs font-medium', room.is_active ? 'text-green-600' : 'text-muted-foreground')}>{room.is_active ? t('common.active') : t('common.inactive')}</Text>
                    <View className="flex-row gap-1">
                      <Button size="sm" variant="ghost" onPress={() => toggle(room)}>
                        <Icon as={Power} className="text-foreground size-4" />
                        <Text>{room.is_active ? r('deactivate') : r('reactivate')}</Text>
                      </Button>
                      <Button size="icon" variant="ghost" onPress={() => remove(room)} accessibilityLabel={t('common.delete')}>
                        <Icon as={Trash2} className="text-destructive size-4" />
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
