import type { HostelVisit } from '@studently/shared-types';
import { Stack } from 'expo-router';
import { Eye, LogOut, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
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

/** Visitor log: record a visit, check visitors out, filter by active and date (web: /admin/hostel/visits). */
export default function HostelVisits() {
  const { t, i18n } = useTranslation();
  const v = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.visits.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const [activeOnly, setActiveOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const list = useApi(key ? ['admin', 'hostel-visits', key, activeOnly ? 'active' : 'all', from, to] : null, ([, , , act, f, tt]) =>
    adminHostel.visits(scope!, { active_only: act === 'active', date_from: (f as string) || undefined, date_to: (tt as string) || undefined }),
  );

  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'hostel-visits' || k[1] === 'hostel-stats'));
  const reset = () => {
    setStudent(null);
    setName('');
    setPhone('');
    setRelation('');
    setPurpose('');
    setNotes('');
  };

  async function create() {
    if (!scope || !student || !name.trim()) return;
    setSaving(true);
    try {
      const r = await adminHostel.createVisit(scope, {
        student_id: student.id,
        visitor_name: name,
        visitor_phone: phone || undefined,
        visitor_relation: relation || undefined,
        purpose: purpose || undefined,
        notes: notes || undefined,
      });
      if (!r.success) return toast.error(r.error || t('app.error_title'));
      setOpen(false);
      reset();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function checkOut(x: HostelVisit) {
    if (!(await confirm({ title: v('msg_checkout_confirm'), confirmLabel: v('btn_checkout') }))) return;
    const r = await adminHostel.checkOut(x.id);
    if (!r.success) return toast.error(r.error || v('msg_checkout_error'));
    toast.success(v('msg_checkout_success'));
    refresh();
  }

  const data = list.data ?? [];
  const when = (d?: string | null) => (d ? new Date(d).toLocaleString(i18n.language) : '—');
  const field = (label: string, node: React.ReactNode) => (
    <View className="gap-1.5">
      <Label>{label}</Label>
      {node}
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: v('header_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{v('header_subtitle')}</Text>
          <Button size="sm" onPress={() => setOpen(true)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{v('btn_add')}</Text>
          </Button>
        </View>
        <FilterChips
          value={activeOnly ? 'active' : 'all'}
          onChange={(x) => setActiveOnly(x === 'active')}
          options={[
            { value: 'all', label: v('tab_all') },
            { value: 'active', label: v('tab_active') },
          ]}
        />
        <View className="flex-row gap-3">
          <DateField className="flex-1" label={v('label_from')} value={from} onChange={setFrom} clearable />
          <DateField className="flex-1" label={v('label_to')} value={to} onChange={setTo} clearable />
        </View>
        {list.isLoading || !scope ? (
          <LoadingList />
        ) : !data.length ? (
          <EmptyState icon={Eye} title={v('msg_no_data')} body={v('msg_no_data_desc')} />
        ) : (
          <Card className="py-0">
            {data.map((x, i) => (
              <View key={x.id}>
                {i > 0 ? <Separator /> : null}
                <View className="flex-row items-center gap-2 px-4 py-3">
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="font-medium">{x.visitor_name}</Text>
                      <View className={`rounded-full px-2 py-0.5 ${x.check_out ? 'bg-secondary' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                        <Text className={`text-xs ${x.check_out ? '' : 'text-emerald-700 dark:text-emerald-400'}`}>{x.check_out ? v('status_checked_out') : v('status_active')}</Text>
                      </View>
                    </View>
                    <Text className="text-muted-foreground text-sm">
                      {[`${v('th_student')}: ${x.student_name || x.student_id}`, x.room_number ? `${v('th_room')} ${x.room_number}` : null, x.visitor_relation].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {v('th_check_in')}: {when(x.check_in)} · {v('th_check_out')}: {when(x.check_out)}
                    </Text>
                  </View>
                  {!x.check_out ? (
                    <Button size="sm" variant="ghost" onPress={() => checkOut(x)}>
                      <Icon as={LogOut} className="text-foreground size-4" />
                      <Text>{v('btn_checkout')}</Text>
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}>
        <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              <DialogHeader>
                <DialogTitle>{v('dialog_add_title')}</DialogTitle>
              </DialogHeader>
              {field(v('label_student'), <StudentSearchSelect value={student} onChange={setStudent} />)}
              {field(v('label_visitor_name'), <Input value={name} onChangeText={setName} placeholder={v('placeholder_visitor_name')} />)}
              <View className="flex-row gap-3">
                <View className="flex-1">{field(v('label_phone'), <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={v('placeholder_phone')} />)}</View>
                <View className="flex-1">{field(v('label_relation'), <Input value={relation} onChangeText={setRelation} placeholder={v('placeholder_relation')} />)}</View>
              </View>
              {field(v('label_purpose'), <Input value={purpose} onChangeText={setPurpose} placeholder={v('placeholder_purpose')} />)}
              {field(v('label_notes'), <Input value={notes} onChangeText={setNotes} placeholder={v('placeholder_notes')} />)}
              <Button onPress={create} disabled={saving || !student || !name.trim()}>
                <Text>{saving ? v('btn_saving') : v('btn_save')}</Text>
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
