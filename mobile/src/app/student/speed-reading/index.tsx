import { router, Stack } from 'expo-router';
import { BookOpen, Globe, GraduationCap, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Picker } from '@/components/app/picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
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
        <Card>
          <CardContent className="flex-row flex-wrap justify-around gap-4 pt-5">
            {loading ? (
              <Skeleton className="h-14 w-full" />
            ) : (
              <>
                <Stat value={String(st?.total_points ?? 0)} label={s('totalPoints')} />
                <Stat value={String(st?.best_wpm ?? 0)} label={s('bestWpm')} />
                <Stat value={String(st?.sessions ?? 0)} label={s('totalSessions')} />
                <View className="items-center">
                  <Text className="text-2xl">{mine.emoji}</Text>
                  <Text className="text-muted-foreground mt-1 text-xs">{a(`badge_${mine.key}`)}</Text>
                </View>
              </>
            )}
          </CardContent>
        </Card>

        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={BookOpen} className="text-muted-foreground size-5" />
            <Text className="flex-1 text-lg font-semibold">{a('texts')}</Text>
          </View>
          <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: a('all_grades') }, ...[...grades.entries()].map(([id, name]) => ({ value: id, label: name }))]} />
          {loading ? (
            <Skeleton className="h-32" />
          ) : shown.length === 0 ? (
            <Text className="text-muted-foreground py-6 text-center text-sm">{s('noTexts')}</Text>
          ) : (
            shown.map((x) => (
              <Pressable key={x.id} onPress={() => router.push({ pathname: '/student/speed-reading/[textId]', params: { textId: x.id } })} accessibilityRole="button">
                <Card className="py-4">
                  <CardContent className="gap-2 px-4">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="flex-1 font-semibold">{x.title}</Text>
                      <Badge variant="outline">
                        <Icon as={Globe} className="size-3" />
                        <Text className="text-xs">{x.language === 'ar' ? s('languageAr') : s('languageEn')}</Text>
                      </Badge>
                    </View>
                    <Text className="text-muted-foreground text-xs">{a('words', { count: x.word_count })}</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {x.grade_level_name ? (
                        <Badge variant="secondary">
                          <Icon as={GraduationCap} className="size-3" />
                          <Text className="text-xs">{x.grade_level_name}</Text>
                        </Badge>
                      ) : null}
                      {x.quiz_questions?.length ? (
                        <Badge>
                          <Text className="text-xs">{a('quiz')}</Text>
                        </Badge>
                      ) : null}
                    </View>
                    <Button size="sm" onPress={() => router.push({ pathname: '/student/speed-reading/[textId]', params: { textId: x.id } })}>
                      <Text>{s('startReading')}</Text>
                    </Button>
                  </CardContent>
                </Card>
              </Pressable>
            ))
          )}
        </View>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={Trophy} className="size-5 text-amber-500" />
            <CardTitle>{s('leaderboard')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {loading ? (
              <Skeleton className="h-40" />
            ) : !(board.data ?? []).length ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">{s('noSessions')}</Text>
            ) : (
              (board.data ?? []).slice(0, 10).map((e, i) => {
                const me2 = e.student_id === pid;
                return (
                  <View key={e.student_id} className={cn('flex-row items-center gap-2 rounded-lg p-2', me2 && 'bg-primary/10 border-primary/20 border')}>
                    <Text className="text-muted-foreground w-7 text-center text-sm font-bold">{`#${i + 1}`}</Text>
                    <PersonAvatar url={e.profile_photo_url} name={`${e.first_name} ${e.last_name}`} size={32} />
                    <Text className="flex-1 text-sm font-medium">{`${e.first_name} ${e.last_name}`}</Text>
                    <Text className="text-muted-foreground text-xs">{a('wpm', { wpm: e.best_wpm })}</Text>
                    <Text className="text-primary text-xs font-semibold">{a('pts', { count: e.total_points })}</Text>
                    <Text>{readingBadge(e.best_wpm).emoji}</Text>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text className="text-primary text-3xl font-bold">{value}</Text>
      <Text className="text-muted-foreground mt-1 text-xs">{label}</Text>
    </View>
  );
}
