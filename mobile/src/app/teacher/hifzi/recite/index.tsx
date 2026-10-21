import { router, Stack } from 'expo-router';
import { Users } from 'lucide-react-native';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useHz } from '@/features/admin/hifzi';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The teacher's circles; pick one to record recitations (web: /teacher/hifzi/recite). */
export default function TeacherReciteCircles() {
  const { h, isAr } = useHz();
  const circles = useApi(['teacher', 'hifzi-circles'], () => adminHifzi.circles());
  const list = (circles.data ?? []).filter((c) => c.is_active);
  return (
    <>
      <Stack.Screen options={{ title: h('recitation.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => circles.mutate()} />}>
        {circles.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState icon={Users} title={h('circles.noCircles')} />
        ) : (
          <Panel>
            {list.map((c, i) => (
              <RowItem
                key={c.id}
                title={(isAr ? c.name_ar : c.name_en) || c.name_ar}
                leading={<IconTile icon={Users} size={40} />}
                onPress={() => router.push({ pathname: '/teacher/hifzi/recite/[circleId]', params: { circleId: c.id } })}
                last={i === list.length - 1}
              />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
