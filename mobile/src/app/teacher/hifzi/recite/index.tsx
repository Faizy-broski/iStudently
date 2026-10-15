import { router, Stack } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
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
          <Text className="text-muted-foreground text-sm">{h('circles.noCircles')}</Text>
        ) : (
          list.map((c) => (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/teacher/hifzi/recite/[circleId]', params: { circleId: c.id } })} accessibilityRole="button">
              <Card>
                <CardContent className="flex-row items-center gap-3 p-4">
                  <Icon as={Users} className="size-5 text-[#022172] dark:text-blue-400" />
                  <Text className="flex-1 font-medium">{(isAr ? c.name_ar : c.name_en) || c.name_ar}</Text>
                  <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
                </CardContent>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}
