import type { JitsiRoom, JitsiRoomInput } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { KeyboardAvoidingView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RoomCard, RoomForm, useLc } from '@/features/admin/jitsi';
import { useCampus } from '@/features/campus/campus';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useRoleBase } from '@/features/portal/role-base';

/** Create, edit, delete and join your own rooms (web: /admin/jitsi-meet/rooms, MyRoomsManager). */
export default function MyRooms() {
  const role = useRoleBase();
  const l = useLc();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'jitsi-my-rooms'], () => jitsi.myRooms());
  const [mode, setMode] = useState<'none' | 'new' | JitsiRoom>('none');
  const [saving, setSaving] = useState(false);
  const rooms = res.data ?? [];

  async function submit(v: JitsiRoomInput) {
    setSaving(true);
    try {
      const r = typeof mode === 'object' ? await jitsi.updateRoom(mode.id, v) : await jitsi.createRoom({ ...v, campus_id: campusId ?? null });
      if (!r.success) return toast.error(r.error || '');
      toast.success(l(typeof mode === 'object' ? 'toast_room_updated' : 'toast_room_created'));
      setMode('none');
      res.mutate();
    } finally {
      setSaving(false);
    }
  }
  async function remove(room: JitsiRoom) {
    if (!(await confirm({ title: l('confirm_delete_room'), destructive: true, confirmLabel: l('delete') }))) return;
    const r = await jitsi.deleteRoom(room.id);
    if (!r.success) return toast.error(r.error || '');
    toast.success(l('toast_room_deleted'));
    res.mutate();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: l('my_rooms'),
          headerRight: () =>
            mode === 'none' ? (
              <Pressable onPress={() => setMode('new')} hitSlop={8} className="p-1" accessibilityLabel={l('new_room')}>
                <Icon as={Plus} className="text-foreground size-6" />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
          {mode !== 'none' ? (
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{typeof mode === 'object' ? l('edit_room') : l('new_room')}</Text>
                <RoomForm key={typeof mode === 'object' ? mode.id : 'new'} initial={typeof mode === 'object' ? mode : undefined} submitting={saving} onSubmit={submit} onCancel={() => setMode('none')} />
              </CardContent>
            </Card>
          ) : null}
          {res.isLoading ? (
            <LoadingList rows={3} />
          ) : !rooms.length && mode === 'none' ? (
            <EmptyState title={l('no_rooms_yet')} />
          ) : (
            rooms.map((r) => (
              <RoomCard key={r.id} room={r} onJoin={() => router.push(role.href('/jitsi-meet/rooms/[id]', { id: r.id }))} onEdit={() => setMode(r)} onDelete={() => remove(r)} />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
