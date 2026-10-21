import type { JgGridRow } from '@studently/api-client';
import { fmtMark, fmtPct, JG_RESULT_LABELS, learnerWord } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Initials, StatTile, StatTiles } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { JgBlocked, needText, resultChipTone, useJg, useJgGrid } from '@/features/jahbadh/shared';

/**
 * One subject of a section (web: the subject grid). On a phone the grid becomes a student list with
 * total, % and result; a student opens the entry form with every component of every stage.
 */
export default function JahbadhSubject() {
  const { t } = useTranslation();
  const { isAdmin, campusId, href } = useJg();
  const { section, subject } = useLocalSearchParams<{ section: string; subject: string }>();
  const grid = useJgGrid(section ?? null, subject ?? null, campusId);
  const g = grid.data;
  const s = g?.summary;
  const subjectMax = g?.subject.meta.subjectMax ?? 0;
  const word = g ? t('grades.studentName', { word: learnerWord(g.rule.grade_code) }) : '';

  return (
    <>
      <Stack.Screen options={{ title: g ? `${g.subject.short_name} — ${g.section.name}` : t('grades.title') }} />
      {grid.error ? (
        <View className="bg-background flex-1 p-4">
          <JgBlocked error={grid.error} isAdmin={isAdmin} />
        </View>
      ) : (
        <DataList
          className="bg-background"
          header={
            g && s ? (
              <View className="gap-3 p-4">
                <Text variant="muted" className="text-xs">
                  {`${g.rule.name} · ${g.rule.system_name} · ${t('grades.subjectMeta', { max: fmtMark(g.subject.meta.subjectMax), periods: g.subject.weekly_periods })}`}
                </Text>
                {g.locked_stages.length ? (
                  <View className="bg-warning-soft flex-row items-center gap-2 rounded-xl p-2.5">
                    <Icon as={Lock} className="text-warning size-4" />
                    <Text className="text-warning flex-1 text-xs">
                      {g.locked_stages.map((n) => g.rule.stage_names[n - 1]).join('، ')}
                    </Text>
                  </View>
                ) : null}
                {!g.can_enter ? <Text className="bg-muted rounded-xl p-2.5 text-xs">{t('grades.viewOnlyHint')}</Text> : null}
                <StatTiles>
                  <StatTile label={JG_RESULT_LABELS.pass} value={String(s.pass + s.passRound2 + s.promoted)} tone="success" />
                  <StatTile label={JG_RESULT_LABELS.round2} value={String(s.round2)} tone="warning" />
                  <StatTile label={t('grades.classAverage')} value={fmtPct(s.avgPct) || '—'} />
                </StatTiles>
                <Text variant="muted" className="text-xs">
                  {s.recorded
                    ? t('grades.summaryLine', {
                        recorded: s.recorded, pass: s.pass + s.passRound2, promoted: s.promoted, round2: s.round2, fail: s.fail,
                        incomplete: s.incomplete, avg: fmtPct(s.avgPct), follow: fmtPct(g.settings.follow_rate), support: s.needSupport,
                      })
                    : t('grades.noMarksYet')}
                </Text>
                <Text className="text-sm font-semibold">{word}</Text>
              </View>
            ) : undefined
          }
          items={g?.rows}
          error={grid.error}
          isLoading={grid.isLoading}
          isRefreshing={grid.isValidating && !grid.isLoading}
          onRefresh={() => grid.mutate()}
          emptyTitle={t('grades.noStudents')}
          keyExtractor={(r: JgGridRow) => r.student.id}
          renderItem={(r: JgGridRow, i) => {
            const need = needText(r.need, fmtMark, t('grades.impossible'));
            return (
              <Pressable
                className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
                accessibilityRole="button"
                onPress={() => router.push(href('/jahbadh/student', { section: section ?? '', subject: subject ?? '', index: String(i) }))}>
                <Initials name={r.student.name} tone={r.result.result === 'fail' ? 'destructive' : r.result.result === 'round2' ? 'warning' : 'brand'} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {r.student.name}
                  </Text>
                  <Text variant="muted" className="text-[11px]">
                    {r.result.total === null
                      ? t('grades.noMarksYet')
                      : `${fmtMark(r.result.final)} / ${fmtMark(subjectMax)} · ${fmtPct(r.result.pct)}${r.result.estimate ? ` · ${r.result.estimate}` : ''}`}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  {r.result.result ? <StatusChip label={JG_RESULT_LABELS[r.result.result]} tone={resultChipTone(r.result.result)} /> : null}
                  {need && r.result.result === 'round2' ? <Text className="text-warning text-[11px] font-semibold">{need.text}</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}
