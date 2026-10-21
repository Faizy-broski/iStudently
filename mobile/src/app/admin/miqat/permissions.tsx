import type { MiqatPermission } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';

const TYPE_LABEL: Record<MiqatPermission['type'], string> = { late_arrival: 'lateArrival', early_departure: 'earlyDeparture', full_day: 'fullDay' };

/** Pending late-arrival / early-departure / full-day requests: approve or reject (web: /admin/miqat/permissions). */
export default function MiqatPermissions() {
  const { t } = useTranslation();
  const p = (k: string) => t(`miqat.permissions.${k}`);
  const toast = useToast();
  const { campusId } = useCampus();
  const [deciding, setDeciding] = useState<string | null>(null);
  const list = useApi(['admin', 'miqat-permissions', campusId ?? 'school'], () => adminMiqat.permissions('pending', campusId));

  async function decide(id: string, status: 'approved' | 'rejected') {
    setDeciding(id);
    try {
      const res = await adminMiqat.decidePermission(id, status, campusId);
      if (!res.success) return toast.error(res.error || p('decideError'));
      toast.success(status === 'approved' ? p('approved') : p('rejected'));
      list.mutate((rows) => rows?.filter((r) => r.id !== id), { revalidate: false });
    } finally {
      setDeciding(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: p('title') }} />
      <View className="bg-background flex-1">
        <DataList
          items={list.data}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={p('noPending')}
          keyExtractor={(r) => r.id}
          renderItem={(r) => (
            <View className="gap-2 px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Initials name={(r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : r.person_id) || '?'} />
                <Text className="flex-1 text-sm font-semibold">{r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : r.person_id}</Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Text>{p(TYPE_LABEL[r.type])}</Text>
                </Badge>
                <Text className="text-muted-foreground text-sm">{r.date_from === r.date_to ? r.date_from : `${r.date_from} → ${r.date_to}`}</Text>
              </View>
              {r.reason ? <Text className="text-sm">{r.reason}</Text> : null}
              <View className="flex-row gap-2">
                <Button size="sm" className="flex-1" disabled={deciding === r.id} onPress={() => decide(r.id, 'approved')}>
                  <Icon as={Check} className="text-primary-foreground size-4" />
                  <Text>{p('approve')}</Text>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={deciding === r.id} onPress={() => decide(r.id, 'rejected')}>
                  <Icon as={X} className="text-foreground size-4" />
                  <Text>{p('reject')}</Text>
                </Button>
              </View>
            </View>
          )}
        />
      </View>
    </>
  );
}
