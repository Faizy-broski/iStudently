import { Stack } from 'expo-router';
import { AlertTriangle, BookOpen, Check, ClipboardList, GraduationCap, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { gradeTone, PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const monthDay = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' });

/** Every graded item per subject with score, type, due date and late/missing/exempt (web: /student/grades/transcripts). */
export default function StudentTranscript() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_tr_${key}`, o);
  const data = useApi(['student', 'grades'], () => student.getStudentGrades());

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const groups = data.data ?? [];
  const graded = groups.filter((g) => g.graded_count > 0);
  const overall = graded.length ? Math.round(graded.reduce((s, g) => s + (g.average || 0), 0) / graded.length) : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {overall !== null ? (
          <HeroCard>
            <View className="flex-row items-center gap-3">
              <View className="size-11 items-center justify-center rounded-full bg-white/15">
                <Icon as={GraduationCap} className="size-5 text-white" />
              </View>
              <Text className="flex-1 text-sm font-semibold text-white/85">{k('cumulative')}</Text>
              <Text className="text-3xl font-bold text-white">{`${overall}%`}</Text>
            </View>
          </HeroCard>
        ) : null}
        {groups.length ? (
          <StatTiles>
            <StatTile icon={BookOpen} label={k('subjects')} value={String(groups.length)} />
            <StatTile icon={ClipboardList} label={k('items')} value={String(groups.reduce((s, g) => s + g.graded_count, 0))} />
            <StatTile icon={TrendingUp} tone="success" label={k('above80')} value={String(graded.filter((g) => (g.average || 0) >= 80).length)} />
            <StatTile icon={AlertTriangle} tone="destructive" label={k('below70')} value={String(graded.filter((g) => (g.average || 0) < 70).length)} />
          </StatTiles>
        ) : null}
        {groups.length === 0 ? (
          <EmptyState icon={GraduationCap} title={k('empty')} body={k('empty_body')} />
        ) : (
          groups.map((group) => (
            <Panel key={group.course_period_id}>
              <View className={cn('flex-row items-center gap-3 px-4 py-3', group.grades.length > 0 && 'border-info-soft dark:border-border border-b')}>
                <IconTile icon={BookOpen} size={40} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{group.subject?.name || t('app.st_rc_unknown')}</Text>
                  {group.subject?.code ? <StatusChip label={group.subject.code} tone="muted" className="self-start px-2 py-0.5" /> : null}
                </View>
                <View className="items-end">
                  <View className="flex-row items-center gap-2">
                    {group.letter_grade ? <Text className="text-brand dark:text-brand-secondary text-lg font-bold">{group.letter_grade}</Text> : null}
                    <Text className={cn('text-xl font-bold', gradeTone(group.average).text)}>{group.average !== null ? `${group.average}%` : '—'}</Text>
                  </View>
                  <Text className="text-muted-foreground text-[11px]">{k('graded', { done: group.graded_count, total: group.total_assignments })}</Text>
                </View>
              </View>
              {group.grades.map((g, i) => {
                const max = g.assignment?.points;
                const score = g.is_exempt ? '—' : g.points !== null ? `${g.points}/${max ?? '?'}` : k('not_graded');
                const pct = max && g.points !== null && !g.is_exempt ? Math.round((g.points / max) * 100) : null;
                const status: [ChipTone, string] | null = g.is_exempt ? ['muted', k('exempt')] : g.is_missing ? ['destructive', k('missing')] : g.is_late ? ['warning', k('late')] : null;
                return (
                  <View key={g.id} className={cn('gap-1 px-4 py-2.5', i < group.grades.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="flex-row items-start gap-2">
                      <Text className="flex-1 text-sm font-semibold">{g.assignment?.title || '—'}</Text>
                      <View className="items-end">
                        <Text className={cn('text-sm font-semibold', gradeTone(pct).text)}>{score}</Text>
                        {pct !== null ? <Text className="text-muted-foreground text-xs">{`(${pct}%)`}</Text> : null}
                      </View>
                    </View>
                    {g.comment ? (
                      <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                        {g.comment}
                      </Text>
                    ) : null}
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-muted-foreground text-xs">{`${k('type')}: ${g.assignment?.assignment_type?.title || '—'}`}</Text>
                      <Text className="text-muted-foreground text-xs">{`${k('due')}: ${g.assignment?.due_date ? monthDay(g.assignment.due_date) : '—'}`}</Text>
                      {status ? (
                        <StatusChip label={status[1]} tone={status[0]} className="px-2 py-0.5" />
                      ) : (
                        <View className="bg-success-soft size-5 items-center justify-center rounded-full" accessibilityLabel={k('ok')}>
                          <Icon as={Check} className="text-success size-3" />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </Panel>
          ))
        )}
      </ScrollView>
    </>
  );
}
