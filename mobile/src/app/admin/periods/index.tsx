import { router, Stack } from 'expo-router';
import { CalendarRange, Minus, Plus, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminPeriods } from '@/lib/api';
import { useApi } from '@/lib/data';

type Row = { id?: string; title: string; short_name: string; sort_order: number; start_time: string; end_time: string; length_minutes: number; block: string; course_periods_count: number };

const len = (s: string, e: string) => {
  if (!s || !e) return 0;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

/** Bell periods: inline edit, add, remove, bulk save; open a period's classes (web: /admin/periods). */
export default function Periods() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`school.periods.${k}`, o);
  const toast = useToast();
  const { campusId, campus } = useCampus();
  const res = useApi(['admin', 'bell-periods', campusId ?? 'school'], () => adminPeriods.list(campusId));
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!res.data) return;
    setRows(
      res.data.map((x) => ({
        id: x.id,
        title: x.title || x.period_name || '',
        short_name: x.short_name || '',
        sort_order: x.sort_order || x.period_number || 1,
        start_time: x.start_time?.slice(0, 5) || '',
        end_time: x.end_time?.slice(0, 5) || '',
        length_minutes: x.length_minutes || 0,
        block: x.block || '',
        course_periods_count: x.course_periods_count || 0,
      })),
    );
  }, [res.data]);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () =>
    setRows((r) => [...r, { title: '', short_name: '', sort_order: r.length ? Math.max(...r.map((x) => x.sort_order)) + 1 : 1, start_time: r[r.length - 1]?.end_time || '', end_time: '', length_minutes: 0, block: '', course_periods_count: 0 }]);
  const remove = (i: number) => {
    const row = rows[i];
    if (row.course_periods_count > 0) return toast.error(p('delete_error', { count: row.course_periods_count }));
    setRows((r) => r.filter((_, j) => j !== i));
  };

  async function save() {
    if (rows.some((x) => !x.title || !x.short_name)) return toast.error(p('validation_required'));
    const orders = rows.map((x) => x.sort_order);
    if (orders.some((v, i) => orders.indexOf(v) !== i)) return toast.error(p('validation_unique'));
    setSaving(true);
    try {
      const r = await adminPeriods.saveBulk(
        campusId,
        rows.map((x) => ({ title: x.title, short_name: x.short_name, sort_order: x.sort_order, start_time: x.start_time || null, end_time: x.end_time || null, length_minutes: x.start_time && x.end_time ? len(x.start_time, x.end_time) : x.length_minutes, block: x.block })),
      );
      if (!r.success) return toast.error(r.error || p('save_error'));
      toast.success(p('save_success'));
      res.mutate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: p('title') }} />
      <View className="bg-background flex-1">
        {res.isLoading && !rows.length ? (
          <LoadingList />
        ) : (
          <ScrollView contentContainerClassName="gap-3 p-4 pb-28" keyboardShouldPersistTaps="handled">
            <Text variant="muted">{p('subtitle', { campus: campus ? ` - ${campus.name}` : '' })}</Text>
            <Button variant="outline" className="self-start" onPress={() => router.push('/admin/marking-periods')}>
              <Icon as={CalendarRange} className="text-foreground size-4" />
              <Text>{p('marking_periods_link')}</Text>
            </Button>
            {rows.map((x, i) => (
              <Card key={x.id ?? `new-${i}`}>
                <CardContent className="gap-3 pt-4">
                  <View className="flex-row gap-2">
                    <View className="flex-1 gap-1">
                      <Label>{p('table_title')}</Label>
                      <Input value={x.title} onChangeText={(v) => update(i, { title: v })} placeholder={p('placeholder_name')} />
                    </View>
                    <View className="w-20 gap-1">
                      <Label>{p('table_short')}</Label>
                      <Input value={x.short_name} onChangeText={(v) => update(i, { short_name: v })} placeholder={p('placeholder_short')} />
                    </View>
                    <View className="w-14 gap-1">
                      <Label>{p('table_order')}</Label>
                      <Input value={String(x.sort_order)} onChangeText={(v) => update(i, { sort_order: parseInt(v, 10) || 1 })} keyboardType="number-pad" />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <TimeField className="flex-1" label={p('table_start')} value={x.start_time || '08:00'} onChange={(v) => update(i, { start_time: v })} />
                    <TimeField className="flex-1" label={p('table_end')} value={x.end_time || '08:45'} onChange={(v) => update(i, { end_time: v })} />
                  </View>
                  <View className="flex-row items-end gap-2">
                    <View className="flex-1 gap-1">
                      <Label>{p('table_block')}</Label>
                      <Input value={x.block} onChangeText={(v) => update(i, { block: v })} />
                    </View>
                    <View className="w-20 items-center gap-1">
                      <Text className="text-muted-foreground text-xs">{p('table_length')}</Text>
                      <Text className="py-2 font-medium">{x.start_time && x.end_time ? len(x.start_time, x.end_time) : x.length_minutes}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    {x.short_name && x.id ? (
                      <Pressable className="bg-info-soft rounded-full px-3 py-1.5 active:opacity-70" onPress={() => router.push({ pathname: '/admin/periods/[name]', params: { name: x.short_name } })}>
                        <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{`${p('table_courses')}: ${x.course_periods_count}`}</Text>
                      </Pressable>
                    ) : (
                      <Text className="text-muted-foreground text-sm">{`${p('table_courses')}: ${x.course_periods_count}`}</Text>
                    )}
                    <Pressable onPress={() => remove(i)} hitSlop={8} accessibilityLabel={x.course_periods_count ? p('delete_disabled_tooltip', { count: x.course_periods_count }) : p('remove_tooltip')} className="flex-row items-center gap-1">
                      <Icon as={Minus} className={x.course_periods_count ? 'text-muted-foreground size-4' : 'text-destructive size-4'} />
                      <Text className={x.course_periods_count ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'}>{p('remove_tooltip')}</Text>
                    </Pressable>
                  </View>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onPress={add}>
              <Icon as={Plus} className="text-foreground size-4" />
              <Text>{p('placeholder_new')}</Text>
            </Button>
          </ScrollView>
        )}
        <View className="border-border bg-background absolute inset-x-0 bottom-0 border-t px-4 pb-6 pt-3">
          <Button onPress={save} disabled={saving}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{saving ? p('saving') : p('save')}</Text>
          </Button>
        </View>
      </View>
    </>
  );
}
