import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A teacher's timetable hours and pay for a period, with editable hourly rates (web: teacher-hours/[teacherId]). */
export default function TeacherHoursDetail() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const ay = useAcademicYear();
  const now = new Date();
  const [from, setFrom] = useState(`${now.toISOString().slice(0, 8)}01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const ok = !!scopeId && !!ay.id && DATE.test(from) && DATE.test(to);
  const hours = useApi(ok ? ['admin', 'acc-teacher-hours-detail', scopeId, id, ay.id, from, to] : null, () =>
    adminAccounting.teacherHours(scopeId!, id, { start_date: from, end_date: to, academic_year_id: ay.id! }),
  );
  const [rates, setRates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (hours.data) setRates(Object.fromEntries(hours.data.map((e) => [e.timetable_entry_id, String(e.hourly_rate ?? 0)])));
  }, [hours.data]);

  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  // Web: the search narrows the list and the totals; saving always sends every rate.
  const allRows = hours.data ?? [];
  const rows = allRows.filter((e) => !q || `${e.subject_name} ${e.period_name}`.toLowerCase().includes(q));
  const total = rows.reduce((s, e) => s + e.total_hours * (parseFloat(rates[e.timetable_entry_id] ?? '') || 0), 0);
  const totalHours = rows.reduce((s, e) => s + e.total_hours, 0);
  const changed = allRows.some((e) => String(e.hourly_rate ?? 0) !== (rates[e.timetable_entry_id] ?? ''));

  async function saveRates() {
    setBusy(true);
    const res = await adminAccounting.setTeacherRates(scopeId!, id, allRows.map((e) => ({ timetable_entry_id: e.timetable_entry_id, hourly_rate: parseFloat(rates[e.timetable_entry_id] ?? '') || 0 })));
    setBusy(false);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(t('app.saved'));
    hours.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: name ?? t('app.ac_teacher_hours') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Picker value={ay.id} onChange={ay.pick} options={ay.options} />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateField value={from} onChange={(v) => setFrom(v ?? from)} />
          </View>
          <View className="flex-1">
            <DateField value={to} onChange={(v) => setTo(v ?? to)} />
          </View>
        </View>
        {allRows.length ? <SearchBar value={search} onChangeText={setSearch} /> : null}
        {hours.isLoading ? <LoadingList rows={4} /> : null}
        {hours.data && allRows.length === 0 ? <EmptyState title={t('app.ac_no_hours')} /> : null}
        {rows.length ? (
          <>
            <Text className="font-semibold">{t('app.ac_hours_total', { hours: Math.round(totalHours * 10) / 10, amount: money(total) })}</Text>
            <Card className="py-2">
              <CardContent className="px-4">
                {rows.map((e, i) => (
                  <View key={e.timetable_entry_id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="flex-row items-center gap-3 py-2">
                      <View className="flex-1">
                        <Text className="font-medium">{e.subject_name}</Text>
                        <Text className="text-muted-foreground text-xs">{`${e.period_name} · ${e.total_hours} h`}</Text>
                      </View>
                      <Input
                        className="w-24"
                        value={rates[e.timetable_entry_id] ?? ''}
                        onChangeText={(v) => setRates((p) => ({ ...p, [e.timetable_entry_id]: v.replace(/[^0-9.]/g, '') }))}
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('app.ac_rate')}
                      />
                    </View>
                  </View>
                ))}
              </CardContent>
            </Card>
            <Button onPress={saveRates} disabled={busy || !changed}>
              <Text>{t('app.ac_save_rates')}</Text>
            </Button>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
