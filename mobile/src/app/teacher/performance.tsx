import { Stack } from 'expo-router';
import { AlertTriangle, FileText, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/lib/colors';
import { IconTile, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { PortalError } from '@/features/portal/ui';
import { adminPerformance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const ESCALATION: Record<string, [string, ChipTone]> = {
  none: ['escalationNone', 'muted'],
  verbal_alert: ['escalationVerbalAlert', 'warning'],
  written_warning: ['escalationWrittenWarning', 'warning'],
  final_warning: ['escalationFinalWarning', 'destructive'],
};

/** The teacher's performance score with demerits / redemptions and incident history (web: /teacher/performance). */
export default function TeacherPerformance() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.performance.${key}`, o);
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const score = useApi(staffId ? ['teacher', 'my-score'] : null, () => adminPerformance.myScore());
  const logs = useApi(staffId ? ['teacher', 'my-perf-logs', staffId] : null, ([, , s]) => adminPerformance.staffLogs(s as string, 100));
  const ar = i18n.language === 'ar';

  if (score.isLoading || logs.isLoading) return <LoadingList rows={5} />;
  if (score.error) return <PortalError title={k('failedToLoadPerformanceData')} message={score.error.message} />;
  const s = score.data;
  const tone = !s ? '' : s.score >= 80 ? 'text-success' : s.score >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([score.mutate(), logs.mutate()])} />}>
        <Text variant="muted" className="text-sm">
          {k('pageSubtitleArabic')}
        </Text>
        {s ? (
          <>
            <Panel className="items-center gap-3 p-5">
              <View className="size-28 items-center justify-center">
                <Svg width={112} height={112} viewBox="0 0 100 100" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={50} cy={50} r={38} fill="none" stroke={colors.printBorder} strokeWidth={12} />
                  <Circle cx={50} cy={50} r={38} fill="none" stroke={s.score >= 80 ? colors.success : s.score >= 60 ? colors.warning : colors.destructive} strokeWidth={12} strokeDasharray={`${(s.score / 100) * 238.8} 238.8`} strokeLinecap="round" />
                </Svg>
                <Text className="text-brand dark:text-foreground text-4xl font-bold">{String(s.score)}</Text>
              </View>
              <StatusChip label={s.score >= 80 ? k('excellent') : s.score >= 60 ? k('good') : k('needsImprovement')} tone={s.score >= 80 ? 'success' : s.score >= 60 ? 'warning' : 'destructive'} />
              <Text variant="muted" className="text-center text-xs">
                <Text className="text-foreground text-xs font-semibold">{`${k('scoreFormulaLabel')} `}</Text>
                {`${k('scoreFormulaExplanation')} ${k('yourCurrentScore', { demerit: s.total_demerit, redemption: s.total_redemption })} `}
                <Text className={cn('text-xs font-semibold', tone)}>{String(s.score)}</Text>
              </Text>
            </Panel>
            <StatTiles>
              <StatTile icon={TrendingDown} tone="destructive" label={k('demeritPoints')} value={`-${s.total_demerit}`} />
              <StatTile icon={TrendingUp} tone="success" label={k('redemptionPoints')} value={`+${s.total_redemption}`} />
              <StatTile icon={AlertTriangle} label={k('totalIncidents')} value={String(s.log_count)} />
            </StatTiles>
          </>
        ) : null}
        <Section title={k('incidentHistory')}>
          {!(logs.data ?? []).length ? (
            <EmptyState icon={AlertTriangle} title={k('noIncidentsOnRecord')} />
          ) : (
            <Panel>
              {(logs.data ?? []).map((log, i, all) => {
                const pts = log.custom_points ?? log.action?.default_points ?? 0;
                const demerit = log.action?.action_type === 'violation_demerit';
                const [escKey, escTone] = ESCALATION[log.action?.escalation_stage ?? 'none'] ?? ESCALATION.none;
                return (
                  <RowItem
                    key={log.id}
                    leading={<IconTile icon={demerit ? TrendingDown : TrendingUp} tone={demerit ? 'destructive' : 'success'} size={40} round />}
                    title={(ar ? log.action?.action_name_ar : log.action?.action_name_en) || log.action?.action_name_en || '—'}
                    meta={log.created_at ? formatDate(log.created_at) : '—'}
                    trailing={<Text className={cn('text-lg font-bold', demerit ? 'text-destructive' : 'text-success')}>{`${demerit ? '-' : '+'}${pts}`}</Text>}
                    last={i === all.length - 1}>
                    <View className="flex-row flex-wrap items-center gap-1.5 ps-[52px]">
                      <StatusChip label={demerit ? k('violation') : k('reward')} tone={demerit ? 'destructive' : 'success'} />
                      <StatusChip label={k(escKey)} tone={escTone} />
                      {log.letter_generated ? <Icon as={FileText} className="text-warning size-3.5" accessibilityLabel={k('disciplinaryLetterIssued')} /> : null}
                    </View>
                    {log.notes ? (
                      <Text variant="muted" className="ps-[52px] text-xs">
                        {log.notes}
                      </Text>
                    ) : null}
                  </RowItem>
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
