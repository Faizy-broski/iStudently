import { router, type Href } from 'expo-router';
import { Bell, BookOpen, Bookmark, Calendar, CalendarDays, CalendarRange, FileBarChart, Search, UserPlus, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { Panel } from '@/components/app/panel';
import { SchoolLogo } from '@/components/app/school-logo';
import { ErrorState } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { CampusSwitcher } from '@/features/campus/campus-switcher';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { AcademicPickers } from '@/features/portal/academic-pickers';
import { usePortalAcademic } from '@/features/portal/academic';
import { adminFees, adminWeather, campuses, events, schoolDashboard } from '@/lib/api';
import { chartPalette, useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const go = (href: string) => router.push(href as Href);

function Section({ title, onViewAll, children }: { title: string; onViewAll?: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">{title}</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8}>
            <Text className="text-brand-secondary text-sm font-medium">{t('app.sad_view_all')}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Tile({ label, value, note, chip }: { label: string; value: string; note?: string; chip?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 gap-1 rounded-2xl border p-4">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text className="text-brand dark:text-foreground text-2xl font-bold">{value}</Text>
      {chip ?? (note ? <Text className="text-muted-foreground text-xs">{note}</Text> : null)}
    </View>
  );
}

/** Ring showing a percentage (fee collection). */
function Ring({ pct, size = 76 }: { pct: number; size?: number }) {
  const c = useColors();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.infoSoft} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.brandSecondary} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(len * Math.min(100, pct)) / 100} ${len}`} />
      </Svg>
      <Text className="text-base font-bold">{`${Math.round(pct)}%`}</Text>
    </View>
  );
}

function QuickAction({ icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  const c = useColors();
  return (
    <Pressable onPress={() => go(href)} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 items-center gap-2 rounded-2xl border py-3 active:opacity-80" accessibilityRole="button">
      <Icon as={icon} strokeWidth={2.3} className="text-brand dark:text-brand-secondary size-5" />
      <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * School admin dashboard (Figma admin dashboard look) for the selected campus and academic year:
 * stats, attendance today, enrolment trend, fee collection, students by grade, upcoming events,
 * library and quick actions (web: /admin/dashboard).
 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`admin.${k}`, o);
  const c = useColors();
  const { campusId, campus, scopeId, isLoading: campusLoading } = useCampus();
  const { me } = useSession();
  const { money } = useCurrency();
  const plugins = me.status === 'ready' ? me.me.plugins : [];
  const profile = me.status === 'ready' ? me.me.profile : null;
  const school = me.status === 'ready' ? me.me.school : null;
  // The dashboard endpoints are admin-only; staff see a welcome instead (web: staff_welcome).
  const isStaff = profile?.role === 'staff';
  // Web DashboardLayout: admins (not staff, not super admins) go to the setup wizard until it is complete.
  const setup = useApi(profile?.role === 'admin' ? ['admin', 'setup-status'] : null, () => campuses.setupStatus());
  const setupIncomplete = setup.data ? !setup.data.isComplete : false;
  useEffect(() => {
    if (setupIncomplete) router.replace('/admin/setup');
  }, [setupIncomplete]);
  const academic = usePortalAcademic();
  const key = campusId ?? 'school';
  const ready = !campusLoading && !isStaff;
  const year = new Date().getFullYear();
  const yearId = academic.year?.id ?? '';
  const stats = useApi(ready ? ['admin', 'dash-stats', key, yearId] : null, ([, , , y]) => schoolDashboard.getStats(campusId, (y as string) || undefined));
  const attendance = useApi(ready ? ['admin', 'dash-attendance', key] : null, () => schoolDashboard.getAttendance(campusId));
  const classes = useApi(ready ? ['admin', 'dash-classes', key, yearId] : null, ([, , , y]) => schoolDashboard.getClassBreakdown(campusId, (y as string) || undefined));
  const growth = useApi(ready ? ['admin', 'dash-growth', key, year] : null, () => schoolDashboard.getStudentGrowth(campusId, year));
  const fees = useApi(ready && scopeId ? ['admin', 'fees-dashboard', scopeId] : null, ([, , sid]) => adminFees.dashboard(sid as string));
  const upcoming = useApi(ready ? ['admin', 'dash-events', key] : null, () => events.getUpcomingEvents(3, 'admin'));
  // Same as the web widget: only when the weather_alerts plugin is on.
  const weatherOn = plugins.includes('weather_alerts');
  const weather = useApi(ready && weatherOn ? ['admin', 'dash-weather', key] : null, () => adminWeather.widget(campusId));

  if (isStaff) {
    return (
      <AuthBackground>
        <SafeAreaView edges={['top']} className="flex-1 gap-2 p-4">
          <Text className="text-brand dark:text-brand-secondary text-2xl font-bold">{a('staff_welcome_title', { name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') })}</Text>
          <Text variant="muted">{a('staff_welcome_body')}</Text>
        </SafeAreaView>
      </AuthBackground>
    );
  }
  const refresh = () => Promise.all([stats.mutate(), attendance.mutate(), classes.mutate(), growth.mutate(), fees.mutate(), upcoming.mutate(), weather.mutate()]);
  if (stats.error && !stats.data) return <ErrorState message={stats.error.message} onRetry={refresh} />;
  const s = stats.data;
  const name = campus?.name ?? school?.name ?? '';
  const logo = campus?.logo_url ?? school?.logo_url;

  // Attendance today = the latest day in the last-7-days series.
  const today = attendance.data?.[attendance.data.length - 1];
  const presentToday = s?.todayPresentStudents ?? today?.present ?? 0;
  const absentToday = today?.absent ?? 0;
  const rate = s?.attendanceRate ?? today?.rate ?? 0;
  const attTotal = presentToday + absentToday;

  // Enrolment trend: last 6 months up to now.
  const months = (growth.data ?? []).slice(0, new Date().getMonth() + 1).slice(-6);
  const maxM = Math.max(1, ...months.map((m) => m.students));
  const firstM = months[0]?.students ?? 0;
  const lastM = months[months.length - 1]?.students ?? 0;
  const change = firstM ? ((lastM - firstM) / firstM) * 100 : null;

  const f = fees.data;
  const feePct = f && f.total_fees > 0 ? (f.total_collected / f.total_fees) * 100 : 0;
  const grades = classes.data ?? [];
  const maxG = Math.max(1, ...grades.map((g) => g.total));
  const classTotal = grades.reduce((sum, g) => sum + g.total, 0);
  const palette = chartPalette();

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={stats.isValidating && !!s} onRefresh={refresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <SchoolLogo url={logo} size={44} shape="circle" />
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="muted" className="text-xs">
                {t('app.role_admin')}
              </Text>
            </View>
            <Pressable onPress={() => go('/admin/more')} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card size-10 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={t('app.ad_search_modules')}>
              <Icon as={Search} className="text-brand dark:text-brand-secondary size-4" />
            </Pressable>
            <Pressable onPress={() => go('/admin/messaging')} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card size-10 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={t('app.adb_messages')}>
              <Icon as={Bell} className="text-brand dark:text-brand-secondary size-4" />
            </Pressable>
          </View>

          <View className="gap-2.5">
            <CampusSwitcher variant="pill" detail={academic.year?.name} />
            <AcademicPickers />
          </View>

          {!s ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Skeleton className="h-24 flex-1 rounded-2xl" />
                <Skeleton className="h-24 flex-1 rounded-2xl" />
              </View>
              <View className="flex-row gap-3">
                <Skeleton className="h-24 flex-1 rounded-2xl" />
                <Skeleton className="h-24 flex-1 rounded-2xl" />
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Tile
                  label={a('stats.total_students')}
                  value={s.noEnrollmentDataForYear ? '—' : formatNumber(s.totalStudents)}
                  note={s.noEnrollmentDataForYear ? a('stats.no_enrollment_data_for_year') : `${a('stats.male_label', { count: s.maleStudents })} · ${a('stats.female_label', { count: s.femaleStudents })}`}
                />
                <Tile label={a('stats.total_teachers')} value={formatNumber(s.totalTeachers)} note={t('app.adb_courses', { count: s.activeCourses })} />
              </View>
              <View className="flex-row gap-3">
                <Tile label={a('stats.total_staff')} value={formatNumber(s.totalStaff)} note={`${a('stats.teachers_label', { count: s.totalTeachers })} · ${a('stats.employees_label', { count: s.totalStaff - s.totalTeachers })}`} />
                <Tile label={a('stats.total_parents')} value={formatNumber(s.totalParents)} note={a('stats.total_parents_registered')} />
              </View>
            </View>
          )}

          {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

          {/* Attendance today */}
          <Section title={t('app.adb_attendance_today')}>
            <Panel className="gap-3 p-4">
              <View className="flex-row items-end justify-between">
                <Text className="text-brand dark:text-foreground text-3xl font-bold">{`${Math.round(rate * 10) / 10}%`}</Text>
                <Text variant="muted" className="text-xs">
                  {attTotal ? t('app.adb_present_of', { present: formatNumber(presentToday), total: formatNumber(attTotal) }) : today ? formatDate(today.date) : ''}
                </Text>
              </View>
              <View className="bg-muted h-2.5 flex-row overflow-hidden rounded-full">
                {attTotal ? (
                  <>
                    <View className="bg-success" style={{ flex: presentToday }} />
                    <View className="bg-destructive" style={{ flex: absentToday }} />
                  </>
                ) : null}
              </View>
              <View className="flex-row gap-4">
                {(
                  [
                    ['bg-success', t('app.trn_present'), presentToday],
                    ['bg-destructive', t('app.trn_absent'), absentToday],
                  ] as const
                ).map(([dot, label, n]) => (
                  <View key={label} className="flex-row items-center gap-1.5">
                    <View className={cn('size-2 rounded-full', dot)} />
                    <Text className="text-xs">{`${label} ${formatNumber(n)}`}</Text>
                  </View>
                ))}
              </View>
            </Panel>
          </Section>

          {/* Enrolment trend */}
          <Section title={t('app.adb_enrolment')}>
            <Panel className="gap-3 p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="muted" className="text-xs">
                  {t('app.adb_enrolment_sub', { count: months.length })}
                </Text>
                {change !== null ? <StatusChip label={`${change >= 0 ? '+' : ''}${formatNumber(Math.round(change * 10) / 10)}%`} tone={change >= 0 ? 'success' : 'destructive'} /> : null}
              </View>
              {months.length ? (
                <View className="h-28 flex-row items-end gap-2">
                  {months.map((m, i) => {
                    const last = i === months.length - 1;
                    const h = Math.max(8, (m.students / maxM) * 100);
                    return (
                      <View key={m.month} className="flex-1 items-center gap-1">
                        {last ? (
                          <BrandGradient variant="primary" angle={180} style={{ width: '100%', height: `${h}%`, borderRadius: 8 }} />
                        ) : (
                          <View className="bg-info-soft w-full rounded-lg" style={{ height: `${h}%` }} />
                        )}
                        <Text variant="muted" className="text-[10px]">
                          {m.month}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text variant="muted" className="text-sm">
                  {a('charts.no_data')}
                </Text>
              )}
            </Panel>
          </Section>

          {/* Fee collection */}
          {f ? (
            <Section title={t('app.adb_fees')} onViewAll={() => go('/admin/billing/fees')}>
              <Panel className="flex-row items-center gap-4 p-4">
                <Ring pct={feePct} />
                <View className="flex-1 gap-1.5">
                  {(
                    [
                      [t('fees.statusCollected'), money(f.total_collected), 'text-foreground'],
                      [t('app.sad_outstanding'), money(f.total_pending), 'text-destructive'],
                      [t('app.adb_overdue'), money(f.total_overdue), 'text-warning'],
                    ] as const
                  ).map(([label, value, tone]) => (
                    <View key={label} className="flex-row items-center justify-between gap-2">
                      <Text variant="muted" className="text-xs">
                        {label}
                      </Text>
                      <Text className={cn('text-sm font-bold', tone)} numberOfLines={1}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              </Panel>
            </Section>
          ) : null}

          {/* Students by grade */}
          <Section title={a('charts.class_title')}>
            <Panel className="gap-2.5 p-4">
              {grades.length ? (
                <>
                  {grades.map((g, i) => (
                    <View key={g.grade} className="flex-row items-center gap-3">
                      <Text className="w-20 text-xs font-medium" numberOfLines={1}>
                        {g.grade}
                      </Text>
                      <View className="bg-info-soft h-2 flex-1 overflow-hidden rounded-full">
                        <View className="h-2 rounded-full" style={{ width: `${(g.total / maxG) * 100}%`, backgroundColor: palette[i % palette.length] }} />
                      </View>
                      <Text className="w-10 text-end text-xs font-bold">{formatNumber(g.total)}</Text>
                    </View>
                  ))}
                  <View className="border-info-soft dark:border-border flex-row justify-between border-t pt-2">
                    <Text className="text-sm font-semibold">{a('stats.total_students')}</Text>
                    <Text className="font-bold">{formatNumber(classTotal)}</Text>
                  </View>
                </>
              ) : (
                <Text variant="muted" className="text-sm">
                  {a('charts.no_data')}
                </Text>
              )}
            </Panel>
          </Section>

          {/* Upcoming events */}
          <Section title={t('app.adb_events')} onViewAll={() => go('/admin/events')}>
            <Panel>
              {(upcoming.data ?? []).length ? (
                (upcoming.data ?? []).map((e, i, arr) => (
                  <View key={e.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
                      <Icon as={CalendarDays} className="text-brand dark:text-brand-secondary size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text variant="muted" className="text-[11px]">
                        {formatDate(e.start_at)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text variant="muted" className="p-4 text-sm">
                  {t('app.adb_no_events')}
                </Text>
              )}
            </Panel>
          </Section>

          {/* Library & activities */}
          {s ? (
            <Section title={a('library.title')}>
              <View className="flex-row gap-3">
                {(
                  [
                    [Bookmark, a('library.total_books'), s.libraryBooks],
                    [BookOpen, a('library.borrowed_books'), s.borrowedBooks],
                    [Calendar, a('library.upcoming_events'), s.activeEvents],
                  ] as const
                ).map(([icon, label, n]) => (
                  <Panel key={label} className="flex-1 gap-1 p-3">
                    <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />
                    <Text className="text-lg font-bold">{formatNumber(n)}</Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={2}>
                      {label}
                    </Text>
                  </Panel>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={t('app.sad_quick')}>
            <View className="flex-row gap-3">
              <QuickAction icon={UserPlus} label={t('app.adb_add_student')} href="/admin/students/form" />
              <QuickAction icon={Wallet} label={t('app.adb_fees_short')} href="/admin/billing/fees" />
              <QuickAction icon={CalendarRange} label={t('app.adb_timetable')} href="/admin/timetable" />
              <QuickAction icon={FileBarChart} label={t('app.adb_reports')} href="/admin/reports/advanced" />
            </View>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}
