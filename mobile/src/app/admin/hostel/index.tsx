import { router, Stack, type Href } from 'expo-router';
import { BedDouble, Building2, DoorOpen, Eye, TrendingUp, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, Initials, RowItem, Section, StatTile, StatTiles, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
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

  const cards: { label: string; value: string; icon: LucideIcon; tone: Tone }[] = [
    { label: d('stat_buildings'), value: String(s?.total_buildings ?? 0), icon: Building2, tone: 'brand' },
    { label: d('stat_rooms'), value: String(s?.total_rooms ?? 0), icon: DoorOpen, tone: 'success' },
    { label: d('stat_occupied_beds'), value: `${s?.occupied_beds ?? 0}/${s?.total_capacity ?? 0}`, icon: BedDouble, tone: 'brand' },
    { label: d('stat_occupancy_rate'), value: `${s?.occupancy_rate ?? 0}%`, icon: TrendingUp, tone: 'warning' },
    { label: d('stat_active_visitors'), value: String(s?.active_visitors ?? 0), icon: Eye, tone: 'destructive' },
  ];
  const links: { title: string; href: Href; icon: LucideIcon; tone: Tone }[] = [
    { title: d('stat_buildings'), href: '/admin/hostel/buildings', icon: Building2, tone: 'brand' },
    { title: d('stat_rooms'), href: '/admin/hostel/rooms', icon: DoorOpen, tone: 'success' },
    { title: d('card_assignments'), href: '/admin/hostel/assignments', icon: Users, tone: 'warning' },
    { title: d('card_visits'), href: '/admin/hostel/visits', icon: Eye, tone: 'destructive' },
    { title: d('card_fees'), href: '/admin/hostel/fees', icon: TrendingUp, tone: 'brand' },
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
        <HeroCard>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-white/85">{d('stat_occupancy_rate')}</Text>
            <Text className="text-2xl font-bold text-white">{loading ? '—' : `${s?.occupancy_rate ?? 0}%`}</Text>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <View className="h-2.5 rounded-full bg-white" style={{ width: `${Math.min(s?.occupancy_rate ?? 0, 100)}%` }} />
          </View>
          <Text className="text-xs text-white/80">{d('header_subtitle')}</Text>
        </HeroCard>
        <StatTiles>
          {cards.map((c) => (
            <StatTile key={c.label} icon={c.icon} tone={c.tone} label={c.label} value={loading ? '—' : c.value} />
          ))}
        </StatTiles>
        <Panel>
          {links.map((l, i) => (
            <RowItem key={l.title} title={l.title} leading={<IconTile icon={l.icon} tone={l.tone} size={40} />} onPress={() => router.push(l.href)} last={i === links.length - 1} />
          ))}
        </Panel>
        <Section title={d('stat_active_visitors')} action={d('btn_view_all')} onAction={() => router.push('/admin/hostel/visits')}>
          {visits.isLoading ? (
            <LoadingList rows={3} />
          ) : !recent.length ? (
            <EmptyState icon={Eye} title={d('msg_no_active_visitors')} />
          ) : (
            <Panel>
              {recent.map((v, i) => (
                <RowItem
                  key={v.id}
                  leading={<Initials name={v.visitor_name || '?'} />}
                  title={v.visitor_name}
                  meta={[`${d('th_student')}: ${v.student_name || v.student_id}`, v.room_number ? `${d('th_room')}: ${v.room_number}` : null, v.visitor_relation].filter(Boolean).join(' · ')}
                  trailing={
                    <Text variant="muted" className="text-[11px]">
                      {new Date(v.check_in).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  }
                  last={i === recent.length - 1}
                />
              ))}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}
