import type { TodayClass } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, FileText, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { HeaderButton, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';

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
          `<h3 style="text-transform:uppercase;color:${colors.printMuted};font-size:12px;margin:16px 0 6px">${escapeHtml(dayName(n))}</h3>` +
          list
            .map((e) => `<div style="display:flex;gap:16px;border:1px solid ${colors.printBorder};border-radius:8px;padding:8px;margin-bottom:4px"><span style="width:110px;color:${colors.printMuted}">${hm(e.start_time)} – ${hm(e.end_time)}</span><span style="flex:1;font-weight:600">${escapeHtml(e.subject?.name || '—')}${e.subject?.code ? ` <small>(${escapeHtml(e.subject.code)})</small>` : ''}</span><span style="color:${colors.printMuted}">${escapeHtml(teacherOf(e))}</span></div>`)
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
        <View className="border-destructive/30 bg-destructive-soft flex-row items-center gap-3 rounded-2xl border p-4">
          <Icon as={AlertCircle} className="text-destructive size-8" />
          <View className="flex-1">
            <Text className="text-destructive font-semibold">{k('error')}</Text>
            <Text className="text-destructive text-sm">{week.error.message}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title'), headerRight: () => <HeaderButton icon={Printer} label={k('print')} onPress={print} /> }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => week.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <Text className="text-base font-semibold">{k('weekly')}</Text>
        {days.length === 0 ? (
          <EmptyState icon={FileText} title={k('empty')} />
        ) : (
          days.map(([n, list]) => (
            <Section key={n} title={dayName(n)}>
              <Panel>
                {list.map((e, i) => (
                  <View key={e.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="bg-info-soft min-w-[64px] items-center rounded-xl px-2 py-1.5">
                      <Text className="text-brand dark:text-brand-secondary text-xs font-bold">{hm(e.start_time)}</Text>
                      <Text className="text-muted-foreground text-[10px]">{hm(e.end_time)}</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{e.subject?.name || '—'}</Text>
                      <Text className="text-muted-foreground text-xs">{teacherOf(e)}</Text>
                    </View>
                    {e.subject?.code ? <StatusChip label={e.subject.code} tone="muted" className="px-2 py-0.5" /> : null}
                  </View>
                ))}
              </Panel>
            </Section>
          ))
        )}
      </ScrollView>
    </>
  );
}
