import { router } from 'expo-router';
import { BookOpen, CalendarCheck, ChevronRight, ClipboardList, CreditCard, GraduationCap, User, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { ChildSwitcher, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { FinancialWidget } from '@/features/portal/fees';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminWeather, parent } from '@/lib/api';
import { useApi } from '@/lib/data';

const LINKS: { key: string; icon: LucideIcon; href: string; tone: string }[] = [
  { key: 'academics', icon: BookOpen, href: '/parent/academics', tone: 'bg-blue-500' },
  { key: 'attendance', icon: CalendarCheck, href: '/parent/attendance', tone: 'bg-green-500' },
  { key: 'homework', icon: ClipboardList, href: '/parent/homework', tone: 'bg-purple-500' },
  { key: 'fees', icon: CreditCard, href: '/parent/fees', tone: 'bg-orange-500' },
];

/** The selected child, quick links, fees and weather (web: /parent/dashboard). */
export default function ParentDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pd_${key}`, o);
  const { children: kids, child, childId, isLoading, error, refresh } = useChild();
  const { campusId } = useCampus();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const { money } = usePortalCurrency();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  const weatherOn = plugins.includes('weather_alerts');
  const weather = useApi(weatherOn ? ['parent', 'weather', campusId ?? 'school'] : null, () => adminWeather.widget(campusId));
  const open = (href: string, title: string) => openPortalPage('parent', { href, title });

  if (isLoading) {
    return (
      <View className="bg-background flex-1 gap-4 p-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </View>
    );
  }
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            refresh();
            fees.mutate();
            weather.mutate();
          }}
        />
      }>
      {error ? <Text className="text-red-600">{k('failed', { message: error.message })}</Text> : null}
      <View>
        <Text className="text-2xl font-bold">{k('title')}</Text>
        <Text variant="muted">{k('welcome')}</Text>
      </View>
      <ChildSwitcher />
      <SetupAssistantPanel role="parent" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={open} />

      {child ? (
        <View className="flex-row items-center gap-4 rounded-xl bg-indigo-600 p-5">
          <View className="rounded-full border-2 border-white/30">
            <PersonAvatar url={child.profile_photo_url} name={`${child.first_name} ${child.last_name}`} size={64} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-white">{`${child.first_name} ${child.last_name}`}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-x-3">
              <View className="flex-row items-center gap-1">
                <Icon as={GraduationCap} className="size-4 text-white/90" />
                <Text className="text-sm text-white/90">{child.grade_level}</Text>
              </View>
              <Text className="text-sm text-white/90">{k('section', { section: child.section })}</Text>
              <Text className="text-sm text-white/90">{k('id', { number: child.student_number })}</Text>
            </View>
            <Text className="mt-1 text-sm text-white/70">{child.campus_name}</Text>
          </View>
          <Pressable onPress={() => open('/parent/id-card', 'id_card')} className="rounded-lg bg-white/10 p-3" accessibilityRole="button" accessibilityLabel={k('id_card')}>
            <Icon as={CreditCard} className="size-7 text-white" />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {LINKS.map((l) => (
          <Pressable key={l.key} onPress={() => open(l.href, l.key)} accessibilityRole="button" className="min-w-[45%] flex-1">
            <Card className="py-4">
              <CardContent className="gap-3 px-4">
                <View className="flex-row items-start justify-between">
                  <View className={`rounded-lg p-3 ${l.tone}`}>
                    <Icon as={l.icon} className="size-6 text-white" />
                  </View>
                  <Icon as={ChevronRight} className="text-muted-foreground size-5 rtl:rotate-180" />
                </View>
                <View>
                  <Text className="font-semibold">{k(l.key)}</Text>
                  <Text className="text-muted-foreground text-sm">{k(`${l.key}_d`)}</Text>
                </View>
              </CardContent>
            </Card>
          </Pressable>
        ))}
      </View>

      {child ? <FinancialWidget fees={fees.data ?? []} isLoading={fees.isLoading} money={money} onViewAll={() => open('/parent/fees', 'fees')} /> : null}
      {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

      {!child && kids.length === 0 ? (
        <Card>
          <CardContent className="items-center p-8">
            <Icon as={User} className="text-muted-foreground mb-3 size-14" />
            <Text className="mb-1 text-lg font-semibold">{k('no_students')}</Text>
            <Text className="text-muted-foreground text-center">{k('no_students_body')}</Text>
          </CardContent>
        </Card>
      ) : null}
      {kids.length > 1 ? (
        <View className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
          <Text className="text-sm text-blue-700 dark:text-blue-300">{k('tip', { count: kids.length })}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
