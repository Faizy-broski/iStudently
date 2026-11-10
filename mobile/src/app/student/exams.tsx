import type { UpcomingExam } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, Calendar, Clock, FileText, GraduationCap, MapPin, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import i18n from '@/i18n';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Urgency = { label: string; chip: ChipTone; tile: Tone; bar: string };
const DAY = 86400000;
const locale = () => (i18n.language === 'ar' ? 'ar' : 'en');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Upcoming exams with how soon each one is, time, room and instructions (web: /student/exams). */
export default function StudentExams() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ex_${key}`, o);
  const res = useApi(['student', 'exams', 'upcoming'], () => student.getUpcomingExams());
  const [now] = useState(() => Date.now());
  const exams = res.data ?? [];

  function urgency(examDate: string): Urgency {
    const date = new Date(examDate);
    const today = startOfDay(new Date(now));
    const day = startOfDay(date);
    if (date.getTime() < now && day !== today) return { label: k('completed'), chip: 'muted', tile: 'muted', bar: 'bg-border' };
    if (day === today) return { label: k('today'), chip: 'destructive', tile: 'destructive', bar: 'bg-destructive' };
    if (day === today + DAY) return { label: k('tomorrow'), chip: 'warning', tile: 'warning', bar: 'bg-warning' };
    const daysUntil = Math.ceil((date.getTime() - now) / DAY);
    if (daysUntil <= 7) return { label: k('in_days', { count: daysUntil }), chip: 'warning', tile: 'warning', bar: 'bg-brand-accent' };
    return { label: date.toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }), chip: 'info', tile: 'brand', bar: 'bg-brand' };
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error ? (
          <ErrorState message={k('error', { message: res.error.message })} onRetry={() => res.mutate()} />
        ) : !exams.length ? (
          <EmptyState icon={GraduationCap} title={k('empty')} body={k('empty_body')} />
        ) : (
          exams.map((e) => <ExamCard key={e.id} exam={e} u={urgency(e.exam_date)} />)
        )}
        <Panel className="gap-2 p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={AlertCircle} className="text-chart-6 size-5" />
            <Text className="text-sm font-bold">{k('tips_title')}</Text>
          </View>
          {(['tip_1', 'tip_2', 'tip_3', 'tip_4', 'tip_5', 'tip_6'] as const).map((tip) => (
            <View key={tip} className="flex-row gap-2">
              <Text className="text-muted-foreground text-sm">•</Text>
              <Text className="text-muted-foreground flex-1 text-sm">{k(tip)}</Text>
            </View>
          ))}
        </Panel>
      </ScrollView>
    </>
  );
}

function ExamCard({ exam, u }: { exam: UpcomingExam; u: Urgency }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_ex_${key}`);
  const date = new Date(exam.exam_date);
  const fullDate = Number.isNaN(date.getTime()) ? exam.exam_date : date.toLocaleDateString(locale(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <Panel className="flex-row overflow-hidden">
      <View className={cn('w-1.5', u.bar)} />
      <View className="flex-1 gap-3 p-4">
        <View className="flex-row items-start gap-3">
          <IconTile icon={GraduationCap} tone={u.tile} size={40} />
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold">{exam.title}</Text>
            <Text className="text-muted-foreground text-sm">{[exam.subject?.name, exam.subject?.code].filter(Boolean).join(' · ')}</Text>
            <StatusChip label={u.label} tone={u.chip} className="self-start" />
          </View>
          <View className="bg-info-soft items-center rounded-xl px-3 py-2">
            <Text className="text-muted-foreground text-xs">{k('total_marks')}</Text>
            <Text className="text-brand dark:text-brand-secondary text-2xl font-bold">{String(exam.total_marks ?? '—')}</Text>
          </View>
        </View>
        <View className="bg-muted/40 gap-2 rounded-xl p-3">
          <Detail icon={Calendar} label={k('date')} value={fullDate} />
          <Detail icon={Clock} label={k('time')} value={`${exam.start_time ?? '—'} - ${exam.end_time ?? '—'}`} />
          <Detail icon={MapPin} label={k('room')} value={exam.room_number || k('tba')} />
        </View>
        {exam.instructions ? (
          <View className="bg-info-soft flex-row items-start gap-2 rounded-xl p-3">
            <Icon as={FileText} className="text-brand dark:text-brand-secondary mt-0.5 size-4" />
            <View className="flex-1 gap-0.5">
              <Text className="text-brand dark:text-brand-secondary text-sm font-semibold">{k('instructions')}</Text>
              <Text className="text-sm">{exam.instructions}</Text>
            </View>
          </View>
        ) : null}
        <View className="border-info-soft dark:border-border flex-row flex-wrap justify-between gap-2 border-t pt-3">
          <Text className="text-muted-foreground text-xs">{`${k('exam_type')}: `}<Text className="text-foreground text-xs font-medium">{exam.exam_type || '—'}</Text></Text>
          <Text className="text-muted-foreground text-xs">{`${k('section')}: `}<Text className="text-foreground text-xs font-medium">{exam.section?.name || '—'}</Text></Text>
        </View>
      </View>
    </Panel>
  );
}

function Detail({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className="text-sm font-medium">{value}</Text>
      </View>
    </View>
  );
}
