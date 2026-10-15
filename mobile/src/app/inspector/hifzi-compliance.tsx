import { Stack } from 'expo-router';
import { Building2, TrendingUp, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CompletionBars } from '@/features/admin/hifzi';
import { adminAcademics, inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Ministerial Decree 1205: syllabus completion across every campus the inspector holds a Hifzi compliance grant for (web: /inspector/hifzi-compliance). */
export default function InspectorHifziCompliance() {
  const { t } = useTranslation();
  const h = (key: string) => t(`hifzi.compliance.${key}`);
  const year = useApi(['inspector', 'academic-year'], () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;
  const res = useApi(yearId ? ['inspector', 'hifzi-compliance', yearId] : null, ([, , y]) => inspector.hifziCompliance(y as string));
  const s = res.data;
  return (
    <>
      <Stack.Screen options={{ title: h('inspectorTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{h('inspectorSubtitle')}</Text>
        {year.isLoading || res.isLoading ? (
          <LoadingList rows={3} />
        ) : !yearId ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{h('noAcademicYear')}</Text>
        ) : res.error || !s ? (
          <Text className="py-8 text-center text-sm text-red-600">{res.error?.message || h('loadError')}</Text>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              <Stat icon={Users} label={h('studentsTracked')} value={String(s.studentsTracked)} />
              <Stat icon={TrendingUp} label={h('avgCompletion')} value={s.avgCompletionPercent !== null ? `${s.avgCompletionPercent.toFixed(1)}%` : '—'} />
              <Stat icon={Building2} label={h('schoolsCovered')} value={String(s.heatmap.length)} />
            </View>
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{h('completionBySchool')}</Text>
                <CompletionBars rows={s.heatmap} emptyLabel={h('noData')} />
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </>
  );
}

function Stat({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="min-w-[30%] flex-1">
      <CardContent className="gap-1 pt-4">
        <View className="flex-row items-center gap-1.5">
          <Icon as={icon} className="text-muted-foreground size-4" />
          <Text className="text-muted-foreground flex-1 text-xs">{label}</Text>
        </View>
        <Text className="text-2xl font-bold">{value}</Text>
      </CardContent>
    </Card>
  );
}
