import { router, Stack } from 'expo-router';
import { BookOpen, Globe, GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { FilterChips } from '@/components/app/filter-chips';
import { HeroCard, IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { readingBadge } from '@/features/speed-reading/badge';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Own reading stats, texts to read (by grade) and the leaderboard (web: /student/speed-reading). */
export default function StudentSpeedReading() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.srs_${k}`, o);
  const { me } = useSession();
  const pid = me.status === 'ready' ? me.me.profile.id : null;
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? undefined) : undefined;
  const texts = useApi(['student', 'sr-texts', schoolId ?? ''], () => adminSpeedReading.texts(schoolId));
  const board = useApi(['student', 'sr-board', schoolId ?? ''], () => adminSpeedReading.leaderboard(schoolId));
  const stats = useApi(['student', 'sr-stats'], () => adminSpeedReading.myStats());
  const [grade, setGrade] = useState('all');
  const loading = texts.isLoading || board.isLoading || stats.isLoading;
  const st = stats.data;
  const mine = readingBadge(st?.best_wpm ?? 0);
  const grades = new Map<string, string>();
  for (const x of texts.data ?? []) if (x.grade_level_id && x.grade_level_name) grades.set(x.grade_level_id, x.grade_level_name);
  const shown = (texts.data ?? []).filter((x) => grade === 'all' || x.grade_level_id === grade);

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              texts.mutate();
              board.mutate();
              stats.mutate();
            }}
          />
        }>
        <HeroCard>
          {loading ? (
            <Skeleton className="h-14 w-full rounded-2xl bg-white/20" />
          ) : (
            <View className="flex-row flex-wrap justify-around gap-4">
              <Stat value={String(st?.total_points ?? 0)} label={s('totalPoints')} />
              <Stat value={String(st?.best_wpm ?? 0)} label={s('bestWpm')} />
              <Stat value={String(st?.sessions ?? 0)} label={s('totalSessions')} />
              <View className="items-center">
                <Text className="text-2xl">{mine.emoji}</Text>
                <Text className="mt-1 text-xs text-white/80">{a(`badge_${mine.key}`)}</Text>
              </View>
            </View>
          )}
        </HeroCard>

        <Section title={a('texts')}>
          <FilterChips value={grade} onChange={setGrade} options={[{ value: 'all', label: a('all_grades') }, ...[...grades.entries()].map(([id, name]) => ({ value: id, label: name }))]} />
          {loading ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : shown.length === 0 ? (
            <EmptyState icon={BookOpen} title={s('noTexts')} />
          ) : (
            shown.map((x) => (
              <Pressable key={x.id} onPress={() => router.push({ pathname: '/student/speed-reading/[textId]', params: { textId: x.id } })} accessibilityRole="button" className="active:opacity-80">
                <Panel className="gap-2 p-4">
                  <View className="flex-row items-start gap-3">
                    <IconTile icon={BookOpen} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{x.title}</Text>
                      <Text className="text-muted-foreground text-xs">{a('words', { count: x.word_count })}</Text>
                    </View>
                    <View className="bg-muted flex-row items-center gap-1 rounded-full px-2.5 py-1">
                      <Icon as={Globe} className="text-muted-foreground size-3" />
                      <Text className="text-muted-foreground text-[11px] font-semibold">{x.language === 'ar' ? s('languageAr') : s('languageEn')}</Text>
                    </View>
                  </View>
                  {x.grade_level_name || x.quiz_questions?.length ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {x.grade_level_name ? (
                        <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                          <Icon as={GraduationCap} className="text-brand dark:text-brand-secondary size-3" />
                          <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{x.grade_level_name}</Text>
                        </View>
                      ) : null}
                      {x.quiz_questions?.length ? <StatusChip label={a('quiz')} tone="success" /> : null}
                    </View>
                  ) : null}
                  <Button size="sm" onPress={() => router.push({ pathname: '/student/speed-reading/[textId]', params: { textId: x.id } })}>
                    <Text>{s('startReading')}</Text>
                  </Button>
                </Panel>
              </Pressable>
            ))
          )}
        </Section>

        <Section title={s('leaderboard')}>
          {loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : !(board.data ?? []).length ? (
            <EmptyState title={s('noSessions')} />
          ) : (
            <Panel>
              {(board.data ?? []).slice(0, 10).map((e, i, arr) => {
                const me2 = e.student_id === pid;
                return (
                  <View key={e.student_id} className={cn('flex-row items-center gap-2.5 px-4 py-2.5', i < arr.length - 1 && 'border-info-soft dark:border-border border-b', me2 && 'bg-info-soft')}>
                    <View className={cn('size-7 items-center justify-center rounded-full', i < 3 ? 'bg-warning-soft' : 'bg-muted')}>
                      <Text className={cn('text-[11px] font-bold', i < 3 ? 'text-warning' : 'text-muted-foreground')}>{String(i + 1)}</Text>
                    </View>
                    <PersonAvatar url={e.profile_photo_url} name={`${e.first_name} ${e.last_name}`} size={32} />
                    <View className="flex-1">
                      <Text className={cn('text-sm', me2 ? 'text-brand dark:text-brand-secondary font-semibold' : 'font-medium')} numberOfLines={1}>{`${e.first_name} ${e.last_name}`}</Text>
                      <Text className="text-muted-foreground text-[11px]">{a('wpm', { wpm: e.best_wpm })}</Text>
                    </View>
                    <Text className="text-brand dark:text-brand-secondary text-xs font-bold">{a('pts', { count: e.total_points })}</Text>
                    <Text>{readingBadge(e.best_wpm).emoji}</Text>
                  </View>
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text className="text-3xl font-bold text-white">{value}</Text>
      <Text className="mt-1 text-xs text-white/80">{label}</Text>
    </View>
  );
}
