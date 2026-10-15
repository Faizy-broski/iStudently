import { Stack } from 'expo-router';
import { AlertTriangle, BarChart3, FileText, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { PortalError } from '@/features/portal/ui';
import { adminPerformance } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const ESCALATION: Record<string, [string, string]> = {
  none: ['escalationNone', 'bg-gray-100 text-gray-700'],
  verbal_alert: ['escalationVerbalAlert', 'bg-yellow-100 text-yellow-800'],
  written_warning: ['escalationWrittenWarning', 'bg-orange-100 text-orange-800'],
  final_warning: ['escalationFinalWarning', 'bg-red-100 text-red-800'],
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
  const tone = !s ? '' : s.score >= 80 ? 'text-green-600' : s.score >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([score.mutate(), logs.mutate()])} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={BarChart3} className="size-6 text-[#022172] dark:text-blue-400" />
          <Text variant="muted">{k('pageSubtitleArabic')}</Text>
        </View>
        {s ? (
          <Card>
            <CardContent className="items-center gap-4 p-5">
              <View className="size-28 items-center justify-center">
                <Svg width={112} height={112} viewBox="0 0 100 100" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={50} cy={50} r={38} fill="none" stroke="#e5e7eb" strokeWidth={12} />
                  <Circle
                    cx={50}
                    cy={50}
                    r={38}
                    fill="none"
                    stroke={s.score >= 80 ? '#16a34a' : s.score >= 60 ? '#d97706' : '#dc2626'}
                    strokeWidth={12}
                    strokeDasharray={`${(s.score / 100) * 238.8} 238.8`}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text className="text-4xl font-bold">{String(s.score)}</Text>
              </View>
              <Text className={cn('text-base font-semibold', tone)}>{s.score >= 80 ? k('excellent') : s.score >= 60 ? k('good') : k('needsImprovement')}</Text>
              <View className="w-full flex-row gap-2">
                <Metric icon={TrendingDown} label={k('demeritPoints')} value={`-${s.total_demerit}`} tone="text-red-600" />
                <Metric icon={TrendingUp} label={k('redemptionPoints')} value={`+${s.total_redemption}`} tone="text-green-600" />
                <Metric icon={AlertTriangle} label={k('totalIncidents')} value={String(s.log_count)} tone="text-blue-600" />
              </View>
              <Text className="text-muted-foreground text-xs">
                <Text className="text-foreground text-xs font-semibold">{`${k('scoreFormulaLabel')} `}</Text>
                {`${k('scoreFormulaExplanation')} ${k('yourCurrentScore', { demerit: s.total_demerit, redemption: s.total_redemption })} `}
                <Text className="text-xs font-semibold">{String(s.score)}</Text>
              </Text>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>{k('incidentHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {!(logs.data ?? []).length ? (
              <Text className="text-muted-foreground py-6 text-center">{k('noIncidentsOnRecord')}</Text>
            ) : (
              (logs.data ?? []).map((log) => {
                const pts = log.custom_points ?? log.action?.default_points ?? 0;
                const demerit = log.action?.action_type === 'violation_demerit';
                const [escKey, escTone] = ESCALATION[log.action?.escalation_stage ?? 'none'] ?? ESCALATION.none;
                return (
                  <View key={log.id} className="border-border gap-1.5 border-b pb-2 last:border-b-0">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="font-medium">{(ar ? log.action?.action_name_ar : log.action?.action_name_en) || log.action?.action_name_en || '—'}</Text>
                        <Text className="text-muted-foreground text-xs">{log.created_at ? formatDate(log.created_at) : '—'}</Text>
                      </View>
                      <Text className={cn('text-lg font-bold', demerit ? 'text-red-600' : 'text-green-600')}>{`${demerit ? '-' : '+'}${pts}`}</Text>
                    </View>
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="flex-row items-center gap-1">
                        <Icon as={demerit ? TrendingDown : TrendingUp} className={cn('size-3', demerit ? 'text-red-600' : 'text-green-600')} />
                        <Text className="text-xs">{demerit ? k('violation') : k('reward')}</Text>
                      </Badge>
                      <View className={cn('rounded-full px-2 py-0.5', escTone)}>
                        <Text className={cn('text-xs', escTone.split(' ')[1])}>{k(escKey)}</Text>
                      </View>
                      {log.letter_generated ? <Icon as={FileText} className="size-3.5 text-orange-500" accessibilityLabel={k('disciplinaryLetterIssued')} /> : null}
                    </View>
                    {log.notes ? <Text className="text-muted-foreground text-sm">{log.notes}</Text> : null}
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

function Metric({ icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: string }) {
  return (
    <View className="border-border flex-1 items-center gap-1 rounded-lg border p-2">
      <Icon as={icon} className={cn('size-4', tone)} />
      <Text className={cn('text-xl font-bold', tone)}>{value}</Text>
      <Text className="text-muted-foreground text-center text-[10px]">{label}</Text>
    </View>
  );
}
