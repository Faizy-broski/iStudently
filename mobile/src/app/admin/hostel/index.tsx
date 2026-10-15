import { router, Stack, type Href } from 'expo-router';
import { BedDouble, Building2, DoorOpen, Eye, TrendingUp, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { scopeKey, useHostelScope } from '@/features/admin/hostel';
import { adminHostel } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Hostel overview: buildings, rooms, beds, occupancy, active visitors, quick links (web: /admin/hostel). */
export default function HostelDashboard() {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`admin.hostel.dashboard.${k}`, o);
  const scope = useHostelScope();
  const key = scopeKey(scope);
  const stats = useApi(key ? ['admin', 'hostel-stats', key] : null, () => adminHostel.stats(scope!));
  const visits = useApi(key ? ['admin', 'hostel-visits', key, 'active'] : null, () => adminHostel.visits(scope!, { active_only: true }));
  const s = stats.data;
  const loading = stats.isLoading;

  const cards: { label: string; value: string; icon: LucideIcon; tone: string }[] = [
    { label: d('stat_buildings'), value: String(s?.total_buildings ?? 0), icon: Building2, tone: 'text-blue-600' },
    { label: d('stat_rooms'), value: String(s?.total_rooms ?? 0), icon: DoorOpen, tone: 'text-emerald-600' },
    { label: d('stat_occupied_beds'), value: `${s?.occupied_beds ?? 0}/${s?.total_capacity ?? 0}`, icon: BedDouble, tone: 'text-purple-600' },
    { label: d('stat_occupancy_rate'), value: `${s?.occupancy_rate ?? 0}%`, icon: TrendingUp, tone: 'text-orange-600' },
    { label: d('stat_active_visitors'), value: String(s?.active_visitors ?? 0), icon: Eye, tone: 'text-rose-600' },
  ];
  const links: { title: string; href: Href; icon: LucideIcon }[] = [
    { title: d('stat_buildings'), href: '/admin/hostel/buildings', icon: Building2 },
    { title: d('stat_rooms'), href: '/admin/hostel/rooms', icon: DoorOpen },
    { title: d('card_assignments'), href: '/admin/hostel/assignments', icon: Users },
    { title: d('card_visits'), href: '/admin/hostel/visits', icon: Eye },
    { title: d('card_fees'), href: '/admin/hostel/fees', icon: TrendingUp },
  ];
  const recent = (visits.data ?? []).slice(0, 10);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: d('header_title') }} />
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              stats.mutate();
              visits.mutate();
            }}
          />
        }>
        <Text className="text-muted-foreground text-sm">{d('header_subtitle')}</Text>
        <View className="flex-row flex-wrap gap-3">
          {cards.map((c) => (
            <Card key={c.label} className="min-w-[46%] flex-1">
              <CardContent className="flex-row items-center gap-3 pt-4">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">{c.label}</Text>
                  <Text className="text-2xl font-bold">{loading ? '—' : c.value}</Text>
                </View>
                <Icon as={c.icon} className={`size-5 ${c.tone}`} />
              </CardContent>
            </Card>
          ))}
        </View>
        <Card className="py-0">
          {links.map((l, i) => (
            <View key={l.title}>
              {i > 0 ? <Separator /> : null}
              <ListRow title={l.title} leading={<Icon as={l.icon} className="text-primary size-5" />} onPress={() => router.push(l.href)} />
            </View>
          ))}
        </Card>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-semibold">{d('stat_active_visitors')}</Text>
              <Button size="sm" variant="ghost" onPress={() => router.push('/admin/hostel/visits')}>
                <Text>{d('btn_view_all')}</Text>
              </Button>
            </View>
            {visits.isLoading ? (
              <LoadingList rows={3} />
            ) : !recent.length ? (
              <Text className="text-muted-foreground py-6 text-center text-sm">{d('msg_no_active_visitors')}</Text>
            ) : (
              recent.map((v, i) => (
                <View key={v.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-0.5 py-2">
                    <Text className="font-medium">{v.visitor_name}</Text>
                    <Text className="text-muted-foreground text-sm">
                      {[`${d('th_student')}: ${v.student_name || v.student_id}`, v.room_number ? `${d('th_room')}: ${v.room_number}` : null, v.visitor_relation].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className="text-muted-foreground text-xs">{new Date(v.check_in).toLocaleString(i18n.language)}</Text>
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
