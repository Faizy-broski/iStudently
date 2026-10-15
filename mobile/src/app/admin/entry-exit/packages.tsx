import { Stack } from 'expo-router';
import { Clock, Package, PackageCheck, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { PersonPicker, type PickedPerson } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Packages received for students: register, filter, mark collected (web: /admin/entry-exit/packages). */
export default function Packages() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.entry_exit.packages.${k}`, o);
  const toast = useToast();
  const { schoolId } = useAttendanceScope();
  const [status, setStatus] = useState('all');
  const list = useApi(schoolId ? ['admin', 'ee-packages', schoolId, status] : null, () => adminEntryExit.packages({ school_id: schoolId, status: status !== 'all' ? status : undefined }));
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const [description, setDescription] = useState('');
  const [sender, setSender] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = (list.data ?? []).filter((x) => x.status === 'pending').length;
  const when = (iso: string) => new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  async function register() {
    if (!student) return;
    setSaving(true);
    try {
      const res = await adminEntryExit.createPackage({ school_id: schoolId, student_id: student.id, description: description || undefined, sender: sender || undefined });
      if (!res.success) return toast.error(res.error || t('app.error_title'));
      setOpen(false);
      setStudent(null);
      setDescription('');
      setSender('');
      list.mutate();
    } finally {
      setSaving(false);
    }
  }

  async function pickup(id: string) {
    const res = await adminEntryExit.pickupPackage(id);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: p('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text variant="muted">{p('page_subtitle')}</Text>
                {pending ? (
                  <View className="rounded-full bg-amber-100 px-2 py-0.5">
                    <Text className="text-xs font-medium text-amber-700">{p('stat_pending', { count: pending })}</Text>
                  </View>
                ) : null}
              </View>
              <Button onPress={() => setOpen(true)}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{p('btn_add')}</Text>
              </Button>
              <Picker
                value={status}
                onChange={setStatus}
                placeholder={p('filter_status')}
                options={[
                  { value: 'all', label: p('status_all') },
                  { value: 'pending', label: p('status_pending') },
                  { value: 'collected', label: p('status_collected') },
                ]}
              />
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={p('msg_no_data')}
          keyExtractor={(x) => x.id}
          renderItem={(x) => {
            const isPending = x.status === 'pending';
            const name = x.student_name || (x.students?.profiles ? `${x.students.profiles.first_name} ${x.students.profiles.last_name}` : x.student_id.slice(0, 8));
            return (
              <View className="gap-1.5 px-4 py-3">
                <View className="flex-row items-start gap-2">
                  <Text className="flex-1 font-medium">{name}</Text>
                  <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', isPending ? 'bg-amber-100' : 'bg-emerald-100')}>
                    <Icon as={isPending ? Package : PackageCheck} className={cn('size-3', isPending ? 'text-amber-700' : 'text-emerald-700')} />
                    <Text className={cn('text-xs', isPending ? 'text-amber-700' : 'text-emerald-700')}>{isPending ? p('status_pending') : p('status_collected')}</Text>
                  </View>
                </View>
                <Text className="text-sm">{`${p('table_col_description')}: ${x.description || '—'}`}</Text>
                <Text className="text-sm">{`${p('table_col_sender')}: ${x.sender || '—'}`}</Text>
                <View className="flex-row items-center gap-1">
                  <Icon as={Clock} className="text-muted-foreground size-3" />
                  <Text className="text-muted-foreground text-xs">{`${p('table_col_received')}: ${when(x.received_at)} · ${p('table_col_collected')}: ${x.collected_at ? when(x.collected_at) : '—'}`}</Text>
                </View>
                {isPending ? (
                  <Button size="sm" variant="outline" className="self-end" onPress={() => pickup(x.id)}>
                    <Icon as={PackageCheck} className="text-foreground size-3.5" />
                    <Text>{p('btn_mark_collected')}</Text>
                  </Button>
                ) : null}
              </View>
            );
          }}
        />
      </View>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{p('dialog_add_title')}</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            <View className="gap-1.5">
              <Label>{p('label_student')}</Label>
              <PersonPicker type="STUDENT" value={student} onChange={setStudent} />
            </View>
            <View className="gap-1.5">
              <Label>{p('label_description')}</Label>
              <Input value={description} onChangeText={setDescription} placeholder={p('placeholder_description')} />
            </View>
            <View className="gap-1.5">
              <Label>{p('label_sender')}</Label>
              <Input value={sender} onChangeText={setSender} placeholder={p('placeholder_sender')} />
            </View>
            <Button onPress={register} disabled={saving || !student}>
              <Text>{saving ? p('btn_registering') : p('btn_register')}</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>
    </>
  );
}
