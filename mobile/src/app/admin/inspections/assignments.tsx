import type { InspectorProfile } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Building2, Pencil, Plus, Power, Trash2, UserCog, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Form = { first_name: string; last_name: string; email: string; phone: string };
const EMPTY: Form = { first_name: '', last_name: '', email: '', phone: '' };

/** Inspector directory and campus assignments (web: /admin/inspections/assignments). */
export default function InspectorAssignments() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`inspections.assignments.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { me } = useSession();
  const homeSchoolId = me.status === 'ready' ? me.me.profile.school_id : null;
  const { campuses } = useCampus();
  const inspectors = useApi(['admin', 'inspectors'], () => adminInspections.inspectors());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const assignments = useApi(selectedId ? ['admin', 'inspector-assignments', selectedId] : null, ([, , id]) => adminInspections.inspectorAssignments(id as string));
  const [create, setCreate] = useState<Form | null>(null);
  const [edit, setEdit] = useState<(Form & { id: string }) | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [campusId, setCampusId] = useState('');
  const [busy, setBusy] = useState(false);

  const list = inspectors.data ?? [];
  const selected = list.find((i) => i.id === selectedId) ?? null;
  const assigned = new Set((assignments.data ?? []).map((x) => x.school_id));
  const available = campuses.filter((c) => !assigned.has(c.id));
  const name = (i: Pick<InspectorProfile, 'first_name' | 'last_name'>) => `${i.first_name} ${i.last_name}`;

  async function run<T>(p: Promise<{ success: boolean; error?: string; data?: T }>, okKey: string, after?: () => void) {
    setBusy(true);
    try {
      const res = await p;
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      toast.success(a(okKey));
      after?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: a('inspectors_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon as={UserCog} className="size-5 text-[#022172]" />
              <CardTitle className="flex-1">{a('inspectors_title')}</CardTitle>
              <Button size="sm" onPress={() => setCreate(EMPTY)}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{a('btn_new_inspector')}</Text>
              </Button>
            </View>
            <CardDescription>{a('inspectors_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            {inspectors.isLoading ? (
              <LoadingList rows={3} />
            ) : !list.length ? (
              <Text variant="muted" className="py-6 text-center text-sm">{a('no_inspectors')}</Text>
            ) : (
              list.map((i) => (
                <Pressable key={i.id} onPress={() => setSelectedId(i.id)} className={cn('border-border gap-2 rounded-lg border p-3', selectedId === i.id && 'border-primary bg-primary/5', !i.is_active && 'opacity-60')}>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Text className="font-medium">{name(i)}</Text>
                      <Text className="text-muted-foreground text-xs">{[i.email, i.phone].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {!i.is_active ? (
                      <Badge variant="outline">
                        <Text className="text-[10px]">{a('inactive_badge')}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <View className="flex-row justify-end gap-4">
                    <Pressable onPress={() => setEdit({ id: i.id, first_name: i.first_name, last_name: i.last_name, email: i.email ?? '', phone: i.phone ?? '' })} hitSlop={8} className="flex-row items-center gap-1">
                      <Icon as={Pencil} className="text-muted-foreground size-4" />
                      <Text className="text-xs">{a('btn_edit')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => run(i.is_active ? adminInspections.deactivateInspector(i.id) : adminInspections.reactivateInspector(i.id), i.is_active ? 'msg_deactivated' : 'msg_reactivated', () => inspectors.mutate())}
                      hitSlop={8}
                      className="flex-row items-center gap-1">
                      <Icon as={Power} className="text-muted-foreground size-4" />
                      <Text className="text-xs">{i.is_active ? a('btn_deactivate') : a('btn_reactivate')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (!(await confirm({ title: a('dialog_delete_title'), body: a('dialog_delete_desc', { name: name(i) }), destructive: true, confirmLabel: a('btn_delete_permanently') }))) return;
                        run(adminInspections.deleteInspector(i.id), 'msg_deleted', () => {
                          if (selectedId === i.id) setSelectedId(null);
                          inspectors.mutate();
                        });
                      }}
                      hitSlop={8}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-2">
            <View className="flex-row items-center gap-2">
              <Icon as={Building2} className="size-5 text-[#022172]" />
              <CardTitle className="flex-1">{a('assignments_title')}</CardTitle>
              {selected ? (
                <Button size="sm" variant="outline" onPress={() => setAssignOpen(true)} disabled={!available.length}>
                  <Icon as={Plus} className="text-foreground size-4" />
                  <Text>{a('btn_assign_campus')}</Text>
                </Button>
              ) : null}
            </View>
            <CardDescription>{selected ? a('assignments_subtitle_for', { name: name(selected) }) : a('assignments_subtitle_empty')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            {!selected ? (
              <Text variant="muted" className="py-6 text-center text-sm">{a('select_inspector_prompt')}</Text>
            ) : assignments.isLoading ? (
              <LoadingList rows={2} />
            ) : !(assignments.data ?? []).length ? (
              <Text variant="muted" className="py-6 text-center text-sm">{a('no_assignments')}</Text>
            ) : (
              (assignments.data ?? []).map((x) => (
                <View key={x.id} className="border-border flex-row items-center gap-2 rounded-lg border p-3">
                  <Text className="flex-1 text-sm">{x.school?.name ?? x.school_id}</Text>
                  <Pressable onPress={() => run(adminInspections.revokeCampus(x.id), 'msg_revoked', () => assignments.mutate())} hitSlop={8}>
                    <Icon as={X} className="text-destructive size-4" />
                  </Pressable>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>

      <Dialog open={!!create} onOpenChange={(o) => !o && setCreate(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{a('dialog_create_title')}</DialogTitle>
            <DialogDescription>{a('dialog_create_desc')}</DialogDescription>
          </DialogHeader>
          {create ? (
            <View className="gap-3">
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{a('field_first_name')}</Label>
                  <Input value={create.first_name} onChangeText={(v) => setCreate({ ...create, first_name: v })} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{a('field_last_name')}</Label>
                  <Input value={create.last_name} onChangeText={(v) => setCreate({ ...create, last_name: v })} />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{a('field_email')}</Label>
                <Input value={create.email} onChangeText={(v) => setCreate({ ...create, email: v })} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View className="gap-1.5">
                <Label>{a('field_phone')}</Label>
                <Input value={create.phone} onChangeText={(v) => setCreate({ ...create, phone: v })} keyboardType="phone-pad" />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button
              disabled={busy || !create?.first_name.trim() || !create?.last_name.trim() || !create?.email.trim() || !homeSchoolId}
              onPress={() => {
                if (!create || !homeSchoolId) return;
                run(
                  adminInspections.createInspector({ first_name: create.first_name.trim(), last_name: create.last_name.trim(), email: create.email.trim(), phone: create.phone.trim() || undefined, home_school_id: homeSchoolId }),
                  'msg_created',
                  () => {
                    setCreate(null);
                    inspectors.mutate();
                  },
                );
              }}>
              <Text>{a('btn_create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{a('dialog_edit_title')}</DialogTitle>
            <DialogDescription>{a('dialog_edit_desc')}</DialogDescription>
          </DialogHeader>
          {edit ? (
            <View className="gap-3">
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1.5">
                  <Label>{a('field_first_name')}</Label>
                  <Input value={edit.first_name} onChangeText={(v) => setEdit({ ...edit, first_name: v })} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{a('field_last_name')}</Label>
                  <Input value={edit.last_name} onChangeText={(v) => setEdit({ ...edit, last_name: v })} />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{a('field_phone')}</Label>
                <Input value={edit.phone} onChangeText={(v) => setEdit({ ...edit, phone: v })} keyboardType="phone-pad" />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button
              disabled={busy || !edit?.first_name.trim() || !edit?.last_name.trim()}
              onPress={() => {
                if (!edit) return;
                run(adminInspections.updateInspector(edit.id, { first_name: edit.first_name.trim(), last_name: edit.last_name.trim(), phone: edit.phone.trim() || null }), 'msg_updated', () => {
                  setEdit(null);
                  inspectors.mutate();
                });
              }}>
              <Text>{a('btn_save')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{a('dialog_assign_title')}</DialogTitle>
            <DialogDescription>{a('dialog_assign_desc')}</DialogDescription>
          </DialogHeader>
          <View className="gap-1.5">
            <Label>{a('field_campus')}</Label>
            <Picker value={campusId} onChange={setCampusId} placeholder={a('field_campus_placeholder')} options={available.map((c) => ({ value: c.id, label: c.name }))} />
          </View>
          <DialogFooter>
            <Button
              disabled={busy || !campusId || !selectedId}
              onPress={() => {
                if (!selectedId) return;
                run(adminInspections.assignCampus({ inspector_profile_id: selectedId, school_id: campusId }), 'msg_assigned', () => {
                  setAssignOpen(false);
                  setCampusId('');
                  assignments.mutate();
                });
              }}>
              <Text>{a('btn_assign')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
