import type { TodayClass } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, FileText, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';

const hm = (v?: string) => (v ? v.slice(0, 5) : '—');
const teacherOf = (e: TodayClass) => (e.teacher?.profile ? `${e.teacher.profile.first_name} ${e.teacher.profile.last_name}` : '—');

/** The weekly timetable grouped by day, printable (web: /student/scheduling/print-schedules). */
export default function StudentPrintSchedules() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ps_${key}`, o);
  const toast = useToast();
  const { campus } = useCampus();
  const week = useApi(['student', 'timetable-week'], () => student.getWeeklyTimetable());

  // day_of_week 1 = Monday … 7 = Sunday; common.days is 0 = Sunday.
  const dayName = (n: number) => (n >= 1 && n <= 7 ? t(`common.days.${n % 7}`) : k('day', { n }));
  const byDay = new Map<number, TodayClass[]>();
  for (const e of week.data ?? []) byDay.set(e.day_of_week, [...(byDay.get(e.day_of_week) ?? []), e]);
  const days = [...byDay.entries()].sort(([a], [b]) => a - b).map(([n, list]) => [n, [...list].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))] as const);

  async function print() {
    const body = days
      .map(
        ([n, list]) =>
          `<h3 style="text-transform:uppercase;color:#666;font-size:12px;margin:16px 0 6px">${escapeHtml(dayName(n))}</h3>` +
          list
            .map((e) => `<div style="display:flex;gap:16px;border:1px solid #ddd;border-radius:8px;padding:8px;margin-bottom:4px"><span style="width:110px;color:#666">${hm(e.start_time)} – ${hm(e.end_time)}</span><span style="flex:1;font-weight:600">${escapeHtml(e.subject?.name || '—')}${e.subject?.code ? ` <small>(${escapeHtml(e.subject.code)})</small>` : ''}</span><span style="color:#666">${escapeHtml(teacherOf(e))}</span></div>`)
            .join(''),
      )
      .join('');
    const html = buildPrintHtml({ title: k('title'), school: { name: campus?.name ?? '' }, pages: [`<h1>${escapeHtml(k('title'))}</h1><h2>${escapeHtml(k('weekly'))}</h2>${body || `<p>${escapeHtml(k('empty'))}</p>`}`] });
    try {
      await printHtml(html);
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  if (week.isLoading) return <LoadingList rows={6} />;
  if (week.error) {
    return (
      <View className="bg-background flex-1 p-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="flex-row items-center gap-3 p-4">
            <Icon as={AlertCircle} className="size-8 text-red-600" />
            <View className="flex-1">
              <Text className="font-semibold text-red-900 dark:text-red-200">{k('error')}</Text>
              <Text className="text-sm text-red-700 dark:text-red-300">{week.error.message}</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => week.mutate()} />}>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1">
            {k('subtitle')}
          </Text>
          <Button variant="outline" onPress={print}>
            <Icon as={Printer} className="size-4" />
            <Text>{k('print')}</Text>
          </Button>
        </View>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={FileText} className="size-5" />
            <CardTitle>{k('weekly')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            {days.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={FileText} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('empty')}</Text>
              </View>
            ) : (
              days.map(([n, list]) => (
                <View key={n} className="gap-1">
                  <Text className="text-muted-foreground mb-1 text-sm font-semibold uppercase">{dayName(n)}</Text>
                  {list.map((e) => (
                    <View key={e.id} className="border-border bg-card gap-1 rounded-lg border p-3">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 font-medium">{e.subject?.name || '—'}</Text>
                        {e.subject?.code ? (
                          <Badge variant="outline">
                            <Text className="text-xs">{e.subject.code}</Text>
                          </Badge>
                        ) : null}
                      </View>
                      <View className="flex-row justify-between">
                        <Text className="text-muted-foreground text-sm">{`${hm(e.start_time)} – ${hm(e.end_time)}`}</Text>
                        <Text className="text-muted-foreground text-sm">{teacherOf(e)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
