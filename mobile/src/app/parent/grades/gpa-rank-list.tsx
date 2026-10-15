import { Stack } from 'expo-router';
import { Award, TrendingUp, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const SCALE = [
  ['93–100', 'A', '4.0'],
  ['90–92', 'A-', '3.7'],
  ['87–89', 'B+', '3.3'],
  ['83–86', 'B', '3.0'],
  ['80–82', 'B-', '2.7'],
  ['77–79', 'C+', '2.3'],
  ['73–76', 'C', '2.0'],
  ['70–72', 'C-', '1.7'],
  ['60–69', 'D', '1.0'],
  ['< 60', 'F', '0.0'],
];

/** The selected child's GPA, class rank, class size and percentage, with the GPA scale (web: /parent/grades/gpa-rank-list). */
export default function ParentGpaRank() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_gpa_${key}`);
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'gpa-rank', childId] : null, ([, , id]) => parent.getGpaRank(id as string));

  if (!childId) return <NoChild />;
  if (data.isLoading) return <LoadingList rows={5} />;
  if (data.error) return <PortalError title={t('app.st_gpa_error')} message={data.error.message} />;
  const g = data.data;

  return (
    <>
      <Stack.Screen options={{ title: t('app.st_gpa_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {!g || g.gpa === null ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={TrendingUp} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground">{k('empty')}</Text>
            </CardContent>
          </Card>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            <Stat icon={Award} iconClass="text-primary" label={k('gpa')} value={g.gpa.toFixed(2)} valueClass="text-primary">
              {g.grade ? (
                <Badge className="mt-2">
                  <Text>{g.grade}</Text>
                </Badge>
              ) : null}
            </Stat>
            <Stat icon={TrendingUp} iconClass="text-blue-500" label={t('app.st_gpa_rank')} value={g.rank !== null ? `#${g.rank}` : '—'} valueClass="text-blue-600" />
            <Stat icon={Users} iconClass="text-muted-foreground" label={k('class_size')} value={g.total_students != null ? String(g.total_students) : '—'} />
            <Stat label={k('percentile')} value={g.percentage !== null ? `${g.percentage.toFixed(1)}%` : '—'} valueClass="text-green-600" />
          </View>
        )}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={TrendingUp} className="size-5" />
            <CardTitle>{k('scale')}</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="border-border flex-row border-b pb-2">
              <Text className="text-muted-foreground flex-1 text-xs font-semibold uppercase">{k('col_pct')}</Text>
              <Text className="text-muted-foreground w-20 text-center text-xs font-semibold uppercase">{k('col_letter')}</Text>
              <Text className="text-muted-foreground w-20 text-center text-xs font-semibold uppercase">{k('col_gpa')}</Text>
            </View>
            {SCALE.map(([range, letter, gpa]) => (
              <View key={letter} className="border-border flex-row border-b py-2 last:border-b-0">
                <Text className="flex-1 text-sm">{range}</Text>
                <Text className="w-20 text-center text-sm font-semibold">{letter}</Text>
                <Text className="w-20 text-center text-sm">{gpa}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Stat({ icon, iconClass, label, value, valueClass, children }: { icon?: LucideIcon; iconClass?: string; label: string; value: string; valueClass?: string; children?: React.ReactNode }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="items-center p-4">
        {icon ? <Icon as={icon} className={cn('mb-2 size-8', iconClass)} /> : null}
        <Text className="text-muted-foreground text-center text-sm">{label}</Text>
        <Text className={cn('mt-1 text-3xl font-bold', valueClass)}>{value}</Text>
        {children}
      </CardContent>
    </Card>
  );
}
