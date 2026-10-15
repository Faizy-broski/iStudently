import { Stack } from 'expo-router';
import { AlertTriangle, Archive, CheckCircle2, Clock, Search, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { PieChart } from '@/components/app/charts';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PRIORITY_HEX } from '@/features/grievances/ui';
import { complaints } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Complaint counts by state and a priority pie (web: /admin/grievances/dashboard). */
export default function GrievanceDashboard() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`grievances.dashboard.${k}`, o);
  const stats = useApi(['grievance-dashboard'], () => complaints.getDashboardStats());
  if (stats.isLoading) return <LoadingList rows={4} />;
  const s = stats.data;
  if (!s) return <ErrorState message={d('failed_to_load')} onRetry={() => stats.mutate()} />;
  const cards = [
    { title: d('stat_pending'), value: s.pending, icon: Clock, fg: 'text-blue-600', bg: 'bg-blue-100' },
    { title: d('stat_under_investigation'), value: s.under_investigation, icon: Search, fg: 'text-purple-600', bg: 'bg-purple-100' },
    { title: d('stat_overdue'), value: s.overdue, icon: AlertTriangle, fg: 'text-red-600', bg: 'bg-red-100' },
    { title: d('stat_resolved'), value: s.resolved, icon: CheckCircle2, fg: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: d('stat_closed'), value: s.closed, icon: Archive, fg: 'text-gray-600', bg: 'bg-gray-100' },
    { title: d('stat_escalated'), value: s.escalated, icon: TrendingUp, fg: 'text-orange-600', bg: 'bg-orange-100' },
  ];
  const pie = Object.entries(s.by_priority)
    .filter(([, v]) => v > 0)
    .map(([p, v]) => ({ name: t(`grievances.priority.${p}`), value: v, color: PRIORITY_HEX[p] ?? '#94a3b8' }));
  return (
    <>
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">{d('total_complaints', { count: s.total })}</Text>
        <View className="flex-row flex-wrap gap-3">
          {cards.map((c) => (
            <View key={c.title} className="border-border bg-card flex-row items-center gap-3 rounded-xl border p-3" style={{ width: '47.5%' }}>
              <View className={cn('size-10 items-center justify-center rounded-lg', c.bg)}>
                <Icon as={c.icon} className={cn('size-5', c.fg)} />
              </View>
              <View className="flex-1">
                <Text className="text-muted-foreground text-xs">{c.title}</Text>
                <Text className="text-xl font-bold">{c.value}</Text>
              </View>
            </View>
          ))}
        </View>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{d('by_priority')}</CardTitle>
          </CardHeader>
          <CardContent>{pie.length ? <PieChart data={pie} donut={false} /> : <Text variant="muted" className="text-sm">{d('no_complaints_yet')}</Text>}</CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
