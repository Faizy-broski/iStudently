import { Stack } from 'expo-router';
import { AlertCircle, BedDouble, Building2, CheckCircle, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {data.isLoading ? (
          <LoadingList rows={3} />
        ) : data.error ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={AlertCircle} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{k('failed')}</Text>
            </CardContent>
          </Card>
        ) : !a ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={BedDouble} className="text-muted-foreground mb-3 size-14" />
              <Text className="text-lg font-semibold">{k('none')}</Text>
              <Text className="text-muted-foreground mt-1 text-center">{k('none_body')}</Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">{k('contact')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-primary/30">
              <CardContent className="gap-4 p-4">
                <View className="flex-row items-start gap-3">
                  <View className="bg-primary/10 rounded-xl p-3">
                    <Icon as={BedDouble} className="text-primary size-7" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-xl font-bold">{k('room', { n: room?.room_number || '—' })}</Text>
                      <View className="flex-row items-center gap-1 rounded-full border border-green-400 px-2 py-0.5">
                        <Icon as={CheckCircle} className="size-3 text-green-600" />
                        <Text className="text-xs text-green-600">{k('assigned')}</Text>
                      </View>
                    </View>
                    {room?.room_type ? <Text className="text-muted-foreground text-sm capitalize">{room.room_type.replace(/_/g, ' ')}</Text> : null}
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {building?.name ? <Tile icon={Building2} label={k('building')} value={building.name} /> : null}
                  {room?.floor ? <Tile icon={BedDouble} label={k('floor')} value={String(room.floor)} /> : null}
                  {room?.capacity ? <Tile icon={Users} label={k('capacity')} value={k('persons', { count: room.capacity })} /> : null}
                  {building?.gender ? <Tile icon={Users} label={k('block')} value={building.gender} /> : null}
                </View>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-2 p-4">
                <Text className="mb-1 font-semibold">{k('details')}</Text>
                {a.check_in_date ? <Row label={k('check_in')} value={longDate(a.check_in_date)} /> : null}
                {a.check_out_date ? <Row label={k('check_out')} value={longDate(a.check_out_date)} /> : null}
                {a.notes ? (
                  <View className="border-border border-t pt-2">
                    <Text className="text-muted-foreground mb-1 text-xs">{k('notes')}</Text>
                    <Text className="text-sm">{a.notes}</Text>
                  </View>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </>
  );
}

function Tile({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="bg-muted/50 min-w-[45%] flex-1 rounded-lg p-3">
      <Icon as={icon} className="text-muted-foreground mb-1 size-4" />
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className="text-sm font-semibold capitalize">{value}</Text>
    </View>
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
