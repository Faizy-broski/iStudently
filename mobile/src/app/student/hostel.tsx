import { Stack } from 'expo-router';
import { AlertCircle, BedDouble, Building2, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { DetailHeader, StatTile, StatTiles } from '@/components/app/layout';
import { Panel, PanelTitle } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

const titleCase = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const longDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' });

/** The student's hostel room and assignment (web: /student/hostel). */
export default function StudentHostel() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ho_${key}`, o);
  const data = useApi(['student', 'hostel'], () => student.getHostelAssignment());
  const a = data.data;
  const room = a?.room;
  const building = room?.building;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {data.isLoading ? (
          <LoadingList rows={3} />
        ) : data.error ? (
          <EmptyState icon={AlertCircle} title={k('failed')} />
        ) : !a ? (
          <EmptyState icon={BedDouble} title={k('none')} body={`${k('none_body')}\n${k('contact')}`} />
        ) : (
          <>
            <DetailHeader
              icon={BedDouble}
              name={k('room', { n: room?.room_number || '—' })}
              subtitle={room?.room_type ? titleCase(room.room_type) : null}
              chips={<StatusChip label={k('assigned')} tone="success" />}
            />
            <StatTiles>
              {building?.name ? <StatTile icon={Building2} label={k('building')} value={building.name} /> : null}
              {room?.floor ? <StatTile icon={BedDouble} label={k('floor')} value={String(room.floor)} /> : null}
              {room?.capacity ? <StatTile icon={Users} label={k('capacity')} value={k('persons', { count: room.capacity })} /> : null}
              {building?.gender ? <StatTile icon={Users} label={k('block')} value={titleCase(building.gender)} /> : null}
            </StatTiles>
            <Panel className="pb-2">
              <PanelTitle title={k('details')} />
              <View className="gap-2 px-4 pt-1">
                {a.check_in_date ? <Row label={k('check_in')} value={longDate(a.check_in_date)} /> : null}
                {a.check_out_date ? <Row label={k('check_out')} value={longDate(a.check_out_date)} /> : null}
                {a.notes ? (
                  <View className="border-info-soft dark:border-border border-t pt-2">
                    <Text className="text-muted-foreground mb-1 text-xs">{k('notes')}</Text>
                    <Text className="text-sm">{a.notes}</Text>
                  </View>
                ) : null}
              </View>
            </Panel>
          </>
        )}
      </ScrollView>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}
