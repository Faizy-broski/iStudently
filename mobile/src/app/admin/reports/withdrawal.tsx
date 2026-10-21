import { Stack } from 'expo-router';
import { Calendar, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { LineChart } from '@/components/app/charts';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { StatTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminAnalytics } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatNumber } from '@/lib/format';

/** Students leaving over the year or a semester, cumulative, optionally against another year (web: /admin/students/withdrawal-chart). */
export default function WithdrawalReport() {
  const { t } = useTranslation();
  const w = (k: string) => t(`withdrawal.${k}`);
  const { campusId } = useCampus();
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const [picked, setPicked] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<'annual' | 'semester'>('annual');
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const [compare, setCompare] = useState(false);
  const [compareId, setCompareId] = useState('');
  const yearId = picked ?? years.data?.find((y) => y.is_current)?.id ?? years.data?.[0]?.id ?? null;
  const key = campusId ?? 'school';
  const points = useApi(yearId ? ['admin', 'withdrawal', key, yearId, granularity, semester] : null, ([, , , y, g, s]) => adminAnalytics.withdrawalCumulative(campusId, y as string, g as 'annual' | 'semester', s as '1' | '2'));
  const summary = useApi(yearId ? ['admin', 'withdrawal-summary', key, yearId] : null, ([, , , y]) => adminAnalytics.withdrawalSummary(campusId, y as string));
  const comparison = useApi(compare && yearId && compareId && compareId !== yearId ? ['admin', 'withdrawal-compare', key, yearId, compareId, granularity] : null, ([, , , a, b, g]) =>
    adminAnalytics.withdrawalComparison(campusId, [a as string, b as string], g as 'annual' | 'semester'),
  );

  if (years.error) return <ErrorState message={years.error.message} onRetry={() => years.mutate()} />;
  if (years.isLoading) return <LoadingList rows={4} />;
  const s = summary.data;
  const comp = Object.entries(comparison.data ?? {});
  const isComparison = compare && comp.length >= 2;
  const len = isComparison ? Math.max(comp[0][1].length, comp[1][1].length) : 0;
  const trendIcon = s?.trend === 'up' ? TrendingUp : s?.trend === 'down' ? TrendingDown : Minus;

  return (
    <>
      <Stack.Screen options={{ title: w('chartTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{w('chartSubtitle')}</Text>
        <Picker value={yearId} onChange={setPicked} placeholder={w('academicYear')} options={(years.data ?? []).map((y) => ({ value: y.id, label: y.name }))} />
        <FilterChips
          value={granularity}
          onChange={setGranularity}
          options={[
            { value: 'annual', label: w('granularityAnnual') },
            { value: 'semester', label: w('granularitySemester') },
          ]}
        />
        {granularity === 'semester' && !compare ? (
          <FilterChips
            value={semester}
            onChange={setSemester}
            options={[
              { value: '1', label: w('semesterOne') },
              { value: '2', label: w('semesterTwo') },
            ]}
          />
        ) : null}
        <View className="flex-row items-center gap-3">
          <Switch checked={compare} onCheckedChange={setCompare} />
          <Text className="flex-1 text-sm">{w('comparisonMode')}</Text>
        </View>
        {compare ? <Picker value={compareId} onChange={setCompareId} placeholder={w('compareWith')} options={(years.data ?? []).filter((y) => y.id !== yearId).map((y) => ({ value: y.id, label: y.name }))} /> : null}
        {s ? (
          <View className="flex-row flex-wrap gap-3">
            <StatTile icon={Users} label={w('totalWithdrawals')} value={formatNumber(s.total)} />
            <StatTile
              icon={trendIcon}
              label={w('vsLastYear')}
              value={s.vsLastYear === null ? '—' : `${s.vsLastYear > 0 ? '+' : ''}${s.vsLastYear}%`}
              note={s.vsLastYear === null ? undefined : w(s.trend === 'up' ? 'trendUp' : s.trend === 'down' ? 'trendDown' : 'trendStable')}
            />
            <StatTile icon={Calendar} label={w('peakMonth')} value={s.peakMonth ?? '—'} />
          </View>
        ) : null}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{w('tooltipCumulative')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            {points.isLoading || comparison.isLoading ? <LoadingList rows={3} /> : null}
            {isComparison ? (
              <LineChart
                categories={Array.from({ length: len }, (_, i) => comp[0][1][i]?.label ?? comp[1][1][i]?.label ?? String(i + 1))}
                series={comp.slice(0, 2).map(([name, pts], i) => ({ name, values: Array.from({ length: len }, (_, k) => pts[k]?.cumulative ?? null), color: i === 0 ? colors.destructive : colors.brandSecondary }))}
              />
            ) : points.data && points.data.every((p) => p.cumulative === 0) ? (
              <EmptyState title={w('emptyTitle')} body={w('emptyDesc')} />
            ) : points.data ? (
              <>
                <LineChart area categories={points.data.map((p) => p.label)} series={[{ name: w('tooltipCumulative'), values: points.data.map((p) => p.cumulative), color: colors.destructive }]} />
                {points.data.map((p) => (p.count ? <Text key={p.date} className="text-muted-foreground text-xs">{`${p.label}: ${w('tooltipNew')} +${p.count} · ${w('tooltipCumulative')} ${p.cumulative}`}</Text> : null))}
              </>
            ) : null}
            <Text className="text-muted-foreground pt-2 text-xs">{w('chartNote')}</Text>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
