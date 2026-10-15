import { Stack } from 'expo-router';
import { Award, TrendingUp, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const SCALE = [
  { label: 'A (93–100%)', min: 93, gpa: '4.0' },
  { label: 'A- (90–92%)', min: 90, gpa: '3.7' },
  { label: 'B+ (87–89%)', min: 87, gpa: '3.3' },
  { label: 'B (83–86%)', min: 83, gpa: '3.0' },
  { label: 'B- (80–82%)', min: 80, gpa: '2.7' },
  { label: 'C+ (77–79%)', min: 77, gpa: '2.3' },
  { label: 'C (73–76%)', min: 73, gpa: '2.0' },
  { label: 'D (60–69%)', min: 60, gpa: '1.0' },
  { label: 'F (< 60%)', min: 0, gpa: '0.0' },
];

/** Cumulative GPA, class rank and overall percentage with the grade scale (web: /student/grades/gpa-rank-list). */
export default function StudentGpaRank() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_gpa_${key}`, o);
  const data = useApi(['student', 'gpa-rank'], () => student.getStudentGpaRank());

  if (data.isLoading) return <LoadingList rows={4} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const g = data.data;
  const noData = !g || g.gpa === null;
  const pct = g?.percentage ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {noData ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={TrendingUp} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground text-center">{k('empty')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="items-center p-5">
                <Icon as={Award} className="text-primary mb-2 size-12" />
                <Text className="text-muted-foreground mb-1 text-sm">{k('cumulative')}</Text>
                <Text className="text-primary text-6xl font-bold">{g?.gpa?.toFixed(2)}</Text>
                <Text className="text-muted-foreground mt-1 text-sm">{k('out_of')}</Text>
                {g?.grade ? (
                  <Badge className="mt-3 px-4 py-1">
                    <Text className="text-base">{g.grade}</Text>
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
            <View className="flex-row gap-3">
              <Card className="flex-1">
                <CardContent className="items-center p-4">
                  <Icon as={Users} className="mb-2 size-8 text-blue-500" />
                  <Text className="text-muted-foreground mb-1 text-sm">{k('rank')}</Text>
                  {g?.rank ? (
                    <>
                      <Text className="text-4xl font-bold">{`#${g.rank}`}</Text>
                      <Text className="text-muted-foreground mt-1 text-xs">{k('of', { count: g.total_students ?? 0 })}</Text>
                    </>
                  ) : (
                    <Text className="text-muted-foreground">{k('na')}</Text>
                  )}
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="items-center p-4">
                  <Icon as={TrendingUp} className="mb-2 size-8 text-green-500" />
                  <Text className="text-muted-foreground mb-1 text-sm">{k('overall')}</Text>
                  <Text className="text-4xl font-bold">{`${g?.percentage ?? 0}%`}</Text>
                </CardContent>
              </Card>
            </View>
          </>
        )}
        {!noData && g?.percentage != null ? (
          <Card>
            <CardHeader>
              <CardTitle>{k('scale')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-1">
              {SCALE.map((row) => {
                const on = pct >= row.min && (row.min === 0 || pct < row.min + 10);
                return (
                  <View key={row.label} className={cn('flex-row items-center justify-between rounded p-2', on && 'bg-primary/10')}>
                    <Text className={cn('text-sm', on && 'font-semibold')}>{row.label}</Text>
                    <Text className="text-muted-foreground text-sm">{k('row', { gpa: row.gpa })}</Text>
                  </View>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
