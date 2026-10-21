import type { AbsenceStatus } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { CheckRow, useAttendanceScope } from '@/features/admin/attendance';
import { adminStaffAbsences } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Add absences for one or more staff, or edit one (web: /admin/staff-absences/add-absence, /edit/[id]). */
export default function StaffAbsenceForm() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`staffAbsences.${k}`, o);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ?? null;
  const { schoolId, campusId } = useAttendanceScope();
  const [form, setForm] = useState({ start_date: todayYmd(), end_date: todayYmd(), reason: '', notes: '', status: 'pending' as AbsenceStatus });
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [cps, setCps] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const existing = useApi(editId ? ['admin', 'staff-absence', editId] : null, ([, , aid]) => adminStaffAbsences.get(aid as string));
  const staff = useApi(!editId && schoolId ? ['admin', 'absence-staff', schoolId, campusId ?? 'school'] : null, () => adminStaffAbsences.staffMembers(schoolId, campusId));
  const staffList = staff.data ?? [];
  const absence = existing.data ?? null;
  const cpStaffId = editId ? (absence?.staff_id ?? null) : staffIds.length === 1 ? staffIds[0] : null;
  const coursePeriods = useApi(cpStaffId && schoolId ? ['admin', 'absence-cps', cpStaffId, schoolId, campusId ?? 'school'] : null, ([, , sid]) =>
    adminStaffAbsences.staffCoursePeriods(sid as string, schoolId, campusId),
  );

  useEffect(() => {
    if (!absence) return;
    setForm({ start_date: absence.start_date?.slice(0, 10) || '', end_date: absence.end_date?.slice(0, 10) || '', reason: absence.reason || '', notes: absence.notes || '', status: absence.status });
    setCps(new Set(absence.cancelled_course_periods || []));
  }, [absence]);
  useEffect(() => {
    if (!editId) setCps(new Set());
  }, [cpStaffId, editId]);

  async function save() {
    if (!editId && staffIds.length === 0) return toast.error(s('validation.selectStaff'));
    if (!form.start_date || !form.end_date) return toast.error(s(editId ? 'validation.datesRequired' : 'validation.startEndRequired'));
    if (form.start_date > form.end_date) return toast.error(s('validation.endAfterStart'));
    setSaving(true);
    try {
      const common = {
        start_date: `${form.start_date}T00:00:00`,
        end_date: `${form.end_date}T23:59:59`,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
        status: form.status,
      };
      if (editId) {
        const res = await adminStaffAbsences.update(editId, { ...common, cancelled_course_period_ids: [...cps] });
        if (!res.success) return toast.error(res.error || t('app.error_title'));
        toast.success(s('toasts.absenceUpdated'));
        return router.back();
      }
      const results = await Promise.all(
        staffIds.map((sid) => adminStaffAbsences.create({ school_id: schoolId, campus_id: campusId, staff_id: sid, ...common, cancelled_course_period_ids: staffIds.length === 1 ? [...cps] : [] })),
      );
      const failures = results.filter((r) => !r.success);
      const ok = results.length - failures.length;
      if (ok > 0) toast.success(ok === 1 ? s('toasts.absenceAdded') : s('toasts.absencesAdded', { count: ok }));
      if (failures.length) toast.error(failures[0].error || s('validation.selectStaff'));
      if (ok > 0) router.back();
    } finally {
      setSaving(false);
    }
  }

  if (editId && existing.isLoading) return <LoadingList />;
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const cpList = coursePeriods.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: editId ? `${s('editAbsence')}${absence?.staff_name ? ` — ${absence.staff_name}` : ''}` : s('addAbsence') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader>
            <CardTitle>{s('absenceDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            {!editId ? (
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Label>{`${s('fields.staffMember')} *`}</Label>
                  {staffList.length ? (
                    <Button size="sm" variant="outline" onPress={() => setStaffIds((p) => (p.length === staffList.length ? [] : staffList.map((x) => x.id)))}>
                      <Text className="text-xs">{staffIds.length === staffList.length ? s('deselectAll') : s('selectAll')}</Text>
                    </Button>
                  ) : null}
                </View>
                <MultiSelect
                  options={staffList.map((x) => ({ id: x.id, label: `${x.name} (${x.role})` }))}
                  value={staffIds}
                  onChange={setStaffIds}
                  placeholder={s('placeholders.selectStaff')}
                  emptyMessage={s('placeholders.selectStaff')}
                />
                {staffIds.length > 1 ? <Text className="text-muted-foreground text-xs">{s('multipleStaffHint', { count: staffIds.length })}</Text> : null}
              </View>
            ) : null}
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={`${s('fields.startDate')} *`} value={form.start_date} onChange={(v) => set({ start_date: v })} />
              <DateField className="flex-1" label={`${s('fields.endDate')} *`} value={form.end_date} onChange={(v) => set({ end_date: v })} />
            </View>
            <View className="gap-1.5">
              <Label>{s('fields.reason')}</Label>
              <Input value={form.reason} onChangeText={(v) => set({ reason: v })} placeholder={s('placeholders.reason')} />
            </View>
            <View className="gap-1.5">
              <Label>{s('fields.notes')}</Label>
              <Textarea value={form.notes} onChangeText={(v) => set({ notes: v })} placeholder={s('placeholders.notes')} />
            </View>
            <View className="gap-1.5">
              <Label>{s('fields.status')}</Label>
              <Picker value={form.status} onChange={(v) => set({ status: v as AbsenceStatus })} options={['pending', 'approved', 'rejected'].map((v) => ({ value: v, label: s(`statuses.${v}`) }))} />
            </View>
          </CardContent>
        </Card>

        {!editId && staffIds.length > 1 ? <Text className="text-muted-foreground text-xs">{s('cancelledClasses.hiddenForMultiple')}</Text> : null}
        {cpStaffId && (!editId || cpList.length > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle>{s('cancelledClasses.title')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-1">
              {coursePeriods.isLoading ? (
                <Text variant="muted">…</Text>
              ) : cpList.length === 0 ? (
                <Text variant="muted">{s('cancelledClasses.noCoursePeriods')}</Text>
              ) : (
                <>
                  <Text className="text-muted-foreground mb-2 text-sm">{s('cancelledClasses.selectCoursePeriods')}</Text>
                  {cpList.map((cp) => (
                    <CheckRow
                      key={cp.id}
                      checked={cps.has(cp.id)}
                      onPress={() =>
                        setCps((p) => {
                          const n = new Set(p);
                          if (n.has(cp.id)) n.delete(cp.id);
                          else n.add(cp.id);
                          return n;
                        })
                      }
                      label={cp.short_name ? `${cp.title} (${cp.short_name})` : cp.title}
                    />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        <View className="flex-row gap-3">
          <Button className="flex-1" onPress={save} disabled={saving}>
            <Text>{saving ? s('saving') : s('saveAbsence')}</Text>
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>{s('cancel')}</Text>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
