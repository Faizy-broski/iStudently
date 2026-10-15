import type { HostelRoomAssignment } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { Plus, UserMinus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { scopeKey, useHostelScope } from '@/features/admin/hostel';
import { StudentSearchSelect, type PickedStudent } from '@/features/admin/student-search';
import { adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Who lives in which room: assign, release, filter by building and active/all (web: /admin/hostel/assignments). */
export default function HostelAssignments() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.assignments.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const [activeOnly, setActiveOnly] = useState(true);
  const [building, setBuilding] = useState('');
  const list = useApi(key ? ['admin', 'hostel-assignments', key, activeOnly ? 'active' : 'all', building] : null, ([, , , act, bid]) =>
    adminHostel.assignments(scope!, { active_only: act === 'active', building_id: (bid as string) || undefined }),
  );
  const rooms = useApi(key ? ['admin', 'hostel-rooms', key, ''] : null, () => adminHostel.rooms(scope!));
  const buildings = useApi(key ? ['admin', 'hostel-buildings', key] : null, () => adminHostel.buildings(scope!));

  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && ['hostel-assignments', 'hostel-rooms', 'hostel-stats', 'hostel-buildings'].includes(k[1]));

  async function assign() {
    if (!scope || !roomId || !student) return;
    setSaving(true);
    try {
      const r = await adminHostel.assign(scope, { room_id: roomId, student_id: student.id, notes: notes || undefined });
      if (!r.success) return toast.error(r.error || a('msg_save_error'));
      toast.success(a('msg_save_success'));
      setOpen(false);
      setRoomId('');
      setStudent(null);
      setNotes('');
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function release(x: HostelRoomAssignment) {
    if (!scope || !(await confirm({ title: a('msg_release_confirm'), confirmLabel: a('btn_release'), destructive: true }))) return;
    const r = await adminHostel.release(scope, x.id);
    if (!r.success) return toast.error(r.error || a('msg_save_error'));
    refresh();
  }

  const available = (rooms.data ?? []).filter((r) => r.is_active && (r.occupancy ?? 0) < r.capacity);
  const data = list.data ?? [];
  const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString(i18n.language) : '');

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('header_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{a('header_subtitle')}</Text>
          <Button size="sm" onPress={() => setOpen(true)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{a('btn_add')}</Text>
          </Button>
        </View>
        <View className="gap-1.5">
          <Label>{a('filter_building')}</Label>
          <Picker value={building || 'ALL'} onChange={(v) => setBuilding(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: a('filter_all') }, ...(buildings.data ?? []).map((b) => ({ value: b.id, label: b.name }))]} />
        </View>
        <FilterChips
          value={activeOnly ? 'active' : 'all'}
          onChange={(v) => setActiveOnly(v === 'active')}
          options={[
            { value: 'active', label: a('tab_active') },
            { value: 'all', label: a('tab_all') },
          ]}
        />
        {list.isLoading || !scope ? (
          <LoadingList />
        ) : !data.length ? (
          <EmptyState icon={Users} title={a('msg_no_data')} body={a('msg_no_data_desc')} />
        ) : (
          <Card className="py-0">
            {data.map((x, i) => (
              <View key={x.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-2 px-4 py-3">
                  <View className="flex-1 gap-1">
                    <Text className="font-medium">{x.student_name || x.student_id}</Text>
                    <Text className="text-muted-foreground text-sm">
                      {[x.building_name, x.room_number ? `${a('th_room')} ${x.room_number}` : null, `${a('th_assigned')}: ${date(x.assigned_date)}`].filter(Boolean).join(' · ')}
                    </Text>
                    <View className={`self-start rounded-full px-2 py-0.5 ${x.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-secondary'}`}>
                      <Text className={`text-xs ${x.is_active ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                        {x.is_active ? a('status_active') : `${a('status_released')} ${date(x.released_date)}`.trim()}
                      </Text>
                    </View>
                  </View>
                  {x.is_active ? (
                    <Button size="sm" variant="ghost" onPress={() => release(x)}>
                      <Icon as={UserMinus} className="size-4 text-red-500" />
                      <Text className="text-red-500">{a('btn_release')}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{a('dialog_add_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{a('label_room')}</Label>
            <Picker
              value={roomId}
              onChange={setRoomId}
              placeholder={a('placeholder_room')}
              options={available.map((r) => ({ value: r.id, label: `${r.building_name ?? ''} — ${a('th_room')} ${r.room_number} (${r.occupancy ?? 0}/${r.capacity})` }))}
            />
          </View>
          <View className="gap-1.5">
            <Label>{a('label_student')}</Label>
            <StudentSearchSelect value={student} onChange={setStudent} />
          </View>
          <View className="gap-1.5">
            <Label>{a('label_notes')}</Label>
            <Input value={notes} onChangeText={setNotes} placeholder={a('placeholder_notes')} />
          </View>
          <Button onPress={assign} disabled={saving || !roomId || !student}>
            <Text>{saving ? a('btn_assigning') : a('btn_assign')}</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </View>
  );
}
