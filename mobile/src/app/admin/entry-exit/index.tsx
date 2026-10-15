import { router, Stack } from 'expo-router';
import { DoorClosed, DoorOpen, Package, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { QuickRecordDialog, RecordRow } from '@/features/admin/entry-exit';
import { adminEntryExit } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Entry/exit dashboard: today's stats, recent records, quick record (web: /admin/entry-exit). */
export default function EntryExitDashboard() {
  const { t } = useTranslation();
  const e = (k: string) => t(`school.entry_exit.dashboard.${k}`);
  const { schoolId } = useAttendanceScope();
  const stats = useApi(schoolId ? ['admin', 'ee-stats', schoolId] : null, () => adminEntryExit.stats(schoolId));
  const recent = useApi(schoolId ? ['admin', 'ee-recent', schoolId] : null, () => adminEntryExit.records({ school_id: schoolId, limit: 10 }));
  const [open, setOpen] = useState(false);

  const s = stats.data;
  const tiles = [
    { title: e('stat_entries_today'), value: s?.entries, icon: DoorOpen, fg: 'text-emerald-500', bg: 'bg-emerald-50' },
    { title: e('stat_exits_today'), value: s?.exits, icon: DoorClosed, fg: 'text-orange-500', bg: 'bg-orange-50' },
    { title: e('stat_inside'), value: s?.inside, icon: Users, fg: 'text-blue-500', bg: 'bg-blue-50' },
    { title: e('stat_packages'), value: s?.packages, icon: Package, fg: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: e('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-4 p-4">
              <Text variant="muted">{e('page_subtitle')}</Text>
              <Button onPress={() => setOpen(true)}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{e('btn_quick_record')}</Text>
              </Button>
              <View className="flex-row flex-wrap gap-3">
                {tiles.map((c) => (
                  <View key={c.title} className="border-border bg-card flex-row items-center justify-between rounded-xl border p-4" style={{ width: '47.5%' }}>
                    <View className="flex-1">
                      <Text className="text-muted-foreground text-xs font-medium">{c.title}</Text>
                      <Text className="mt-1 text-2xl font-bold">{stats.isLoading ? '—' : (c.value ?? 0)}</Text>
                    </View>
                    <View className={cn('rounded-xl p-2.5', c.bg)}>
                      <Icon as={c.icon} className={cn('size-5', c.fg)} />
                    </View>
                  </View>
                ))}
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold">{e('recent_records')}</Text>
                <Button size="sm" variant="ghost" onPress={() => router.push('/admin/entry-exit/report')}>
                  <Text className="text-primary">{e('btn_view_all')}</Text>
                </Button>
              </View>
            </View>
          }
          items={recent.data}
          error={recent.error}
          isLoading={recent.isLoading}
          isRefreshing={recent.isValidating && !recent.isLoading}
          onRefresh={() => {
            stats.mutate();
            recent.mutate();
          }}
          emptyTitle={e('msg_no_records')}
          emptyBody={e('msg_records_appear_here')}
          keyExtractor={(r) => r.id}
          renderItem={(r) => <RecordRow r={r} />}
        />
      </View>

      <QuickRecordDialog
        schoolId={schoolId}
        open={open}
        onOpenChange={setOpen}
        onDone={() => {
          stats.mutate();
          recent.mutate();
        }}
      />
    </>
  );
}
