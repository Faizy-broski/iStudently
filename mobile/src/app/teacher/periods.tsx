import { Stack } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminPeriods } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

const time12 = (v?: string | null) => {
  if (!v) return '—';
  const [h, m] = v.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(i18n.language === 'ar' ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' });
};

/** The campus's bell periods, read-only (web: /teacher/periods). */
export default function TeacherPeriods() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.periods.${key}`, o);
  const { campus, campusId } = useCampus();
  const res = useApi(['teacher', 'periods', campusId ?? 'school'], () => adminPeriods.list(campusId ?? undefined));
  const list = [...(res.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{campus ? k('schoolPeriodsWithCampus', { campus: campus.name }) : k('schoolPeriods')}</Text>
        {res.isLoading ? (
          <LoadingList rows={5} />
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Clock} className="text-muted-foreground mb-3 size-10" />
              <Text className="text-muted-foreground">{k('noPeriodsDefined')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((p) => (
            <Card key={p.id}>
              <CardContent className="gap-1 p-4">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-semibold">{p.title || p.period_name || '—'}</Text>
                  <Text className="text-muted-foreground text-xs">{`${k('order')}: ${p.sort_order ?? '—'}`}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">{`${k('shortName')}: ${p.short_name || '—'} · ${k('block')}: ${p.block || '—'}`}</Text>
                <Text className="text-sm">{`${time12(p.start_time)} – ${time12(p.end_time)} · ${k('lengthMin')}: ${p.length_minutes ?? '—'}`}</Text>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
