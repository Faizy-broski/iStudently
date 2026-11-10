import type { ScheduleRequestRow } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { InfoBanner } from '@/features/admin/settings-ui';
import { useSession } from '@/features/auth/session';
import { usePortalAcademic } from '@/features/portal/academic';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

const TONE: Record<ScheduleRequestRow['status'], ChipTone> = { pending: 'warning', fulfilled: 'success', unfilled: 'destructive', cancelled: 'muted' };

/** The student's course requests for the selected year, read-only; requests are made by the school (web: /student/scheduling/student-requests). */
export default function StudentRequestsPage() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.st_sr_${key}`);
  const { me } = useSession();
  const studentId = me.status === 'ready' ? me.me.profile.student_id : null;
  const { year } = usePortalAcademic();
  const yearId = year?.id ?? null;
  const res = useApi(studentId && yearId ? ['student', 'schedule-requests', studentId, yearId] : null, ([, , s, y]) => adminScheduling.requestsForYear(y as string, { student_id: s as string }));
  const rows = res.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <Panel>
          <View className="flex-row items-center gap-3 px-4 pt-4">
            <IconTile icon={ClipboardList} size={40} />
            <Text className="flex-1 text-base font-semibold">{k('card')}</Text>
          </View>
          {res.isLoading ? (
            <View className="p-4">
              <LoadingList rows={3} />
            </View>
          ) : res.error && !rows.length ? (
            <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
          ) : !rows.length ? (
            <EmptyState icon={ClipboardList} title={k('none')} body={k('none_body')} />
          ) : (
            <View className="gap-2 p-4">
              {rows.map((r, i) => (
                <View key={r.id} className={i < rows.length - 1 ? 'border-info-soft dark:border-border flex-row items-center gap-3 border-b pb-2' : 'flex-row items-center gap-3'}>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{r.course?.title ?? '—'}</Text>
                    {r.fulfilled_course_period ? (
                      <Text className="text-muted-foreground text-xs">{[r.fulfilled_course_period.course?.short_name, r.fulfilled_course_period.room].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                  </View>
                  <StatusChip label={t(`app.st_sr_status_${r.status}`)} tone={TONE[r.status] ?? 'muted'} />
                </View>
              ))}
            </View>
          )}
        </Panel>
        <InfoBanner>{k('contact')}</InfoBanner>
      </ScrollView>
    </>
  );
}
