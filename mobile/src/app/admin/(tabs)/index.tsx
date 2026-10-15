import { BookOpen, Bookmark, Calendar, GraduationCap, ThumbsUp, Users, UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LineChart } from '@/components/app/charts';
import { StatCard } from '@/components/app/stat-card';
import { ErrorState } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { AcademicPickers } from '@/features/portal/academic-pickers';
import { usePortalAcademic } from '@/features/portal/academic';
import { adminWeather, schoolDashboard } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

/**
 * School admin dashboard for the selected campus and academic year: stat cards, weather, enrollment
 * and weekly attendance charts, students per class, library and events (web: /admin/dashboard).
 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`admin.${k}`, o);
  const { campusId, isLoading: campusLoading } = useCampus();
  const { me } = useSession();
  const plugins = me.status === 'ready' ? me.me.plugins : [];
  const profile = me.status === 'ready' ? me.me.profile : null;
  // The dashboard endpoints are admin-only; staff see a welcome instead (web: staff_welcome).
  const isStaff = profile?.role === 'staff';
  // Global year + quarter (like the web sidebar's Academic Year / Quarter selectors).
  const academic = usePortalAcademic();
  const key = campusId ?? 'school';
  const ready = !campusLoading && !isStaff;
  const year = new Date().getFullYear();
  const yearId = academic.year?.id ?? '';
  const stats = useApi(ready ? ['admin', 'dash-stats', key, yearId] : null, ([, , , y]) => schoolDashboard.getStats(campusId, (y as string) || undefined));
  const attendance = useApi(ready ? ['admin', 'dash-attendance', key] : null, () => schoolDashboard.getAttendance(campusId));
  const classes = useApi(ready ? ['admin', 'dash-classes', key, yearId] : null, ([, , , y]) => schoolDashboard.getClassBreakdown(campusId, (y as string) || undefined));
  const growth = useApi(ready ? ['admin', 'dash-growth', key, year] : null, () => schoolDashboard.getStudentGrowth(campusId, year));
  // Same as the web widget: only when the weather_alerts plugin is on.
  const weatherOn = plugins.includes('weather_alerts');
  const weather = useApi(ready && weatherOn ? ['admin', 'dash-weather', key] : null, () => adminWeather.widget(campusId));

  if (isStaff) {
    return (
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4">
        <Text className="text-2xl font-bold">{a('staff_welcome_title', { name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') })}</Text>
        <Text variant="muted">{a('staff_welcome_body')}</Text>
      </ScrollView>
    );
  }
  const refresh = () => Promise.all([stats.mutate(), attendance.mutate(), classes.mutate(), growth.mutate(), weather.mutate()]);
  if (stats.error && !stats.data) return <ErrorState message={stats.error.message} onRetry={refresh} />;
  const s = stats.data;
  const classTotal = (classes.data ?? []).reduce((sum, c) => sum + c.total, 0);

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-8" refreshControl={<RefreshControl refreshing={stats.isValidating && !!s} onRefresh={refresh} />}>
      <AcademicPickers />
      {!s ? (
        <View className="gap-3">
          <View className="flex-row gap-3">
            <Skeleton className="h-28 flex-1 rounded-xl" />
            <Skeleton className="h-28 flex-1 rounded-xl" />
          </View>
          <View className="flex-row gap-3">
            <Skeleton className="h-28 flex-1 rounded-xl" />
            <Skeleton className="h-28 flex-1 rounded-xl" />
          </View>
          <Skeleton className="h-40 rounded-xl" />
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <StatCard icon={ThumbsUp} label={a('stats.today_present')} value={formatNumber(s.todayPresentStudents)} detail={a('stats.attendance_rate_label', { rate: Math.round(s.attendanceRate) })} />
            <StatCard
              icon={Users}
              label={a('stats.total_staff')}
              value={formatNumber(s.totalStaff)}
              detail={`${a('stats.teachers_label', { count: s.totalTeachers })}  ${a('stats.employees_label', { count: s.totalStaff - s.totalTeachers })}\n${a('stats.male_label', { count: s.maleStaff })}  ${a('stats.female_label', { count: s.femaleStaff })}`}
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard icon={UsersRound} label={a('stats.total_parents')} value={formatNumber(s.totalParents)} detail={a('stats.total_parents_registered')} />
            <StatCard
              icon={GraduationCap}
              label={a('stats.total_students')}
              value={s.noEnrollmentDataForYear ? '—' : formatNumber(s.totalStudents)}
              detail={
                s.noEnrollmentDataForYear ? a('stats.no_enrollment_data_for_year') : `${a('stats.male_label', { count: s.maleStudents })}  ${a('stats.female_label', { count: s.femaleStudents })}`
              }
            />
          </View>
        </>
      )}

      {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle>{a('charts.enrollment_title', { year })}</CardTitle>
          <CardDescription>{a('charts.enrollment_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {growth.data?.length ? (
            <LineChart categories={growth.data.map((g) => g.month)} series={[{ name: a('stats.total_students'), values: growth.data.map((g) => g.students), color: '#3B82F6' }]} area />
          ) : (
            <Text variant="muted" className="px-2">
              {a('charts.no_data')}
            </Text>
          )}
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle>{a('charts.attendance_title')}</CardTitle>
          <CardDescription>{a('charts.attendance_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {attendance.data?.length ? (
            <LineChart
              categories={attendance.data.map((d) => formatDate(d.date))}
              series={[
                { name: t('app.trn_present'), values: attendance.data.map((d) => d.present), color: '#10B981' },
                { name: t('app.trn_absent'), values: attendance.data.map((d) => d.absent), color: '#EF4444' },
              ]}
            />
          ) : (
            <Text variant="muted" className="px-2">
              {a('charts.no_data')}
            </Text>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle>{a('charts.class_title')}</CardTitle>
          <CardDescription>{a('charts.class_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="gap-3 px-4">
          {classes.data?.length ? (
            <>
              {classes.data.map((c, i) => (
                <View key={c.grade} className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <View className="size-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <Text className="flex-1 text-sm font-semibold">{c.grade}</Text>
                    <Text className="text-lg font-bold">{formatNumber(c.total)}</Text>
                    <Text className="text-muted-foreground text-xs">{a('charts.students_count')}</Text>
                  </View>
                  {c.sections.map((x) => (
                    <View key={x.section} className="flex-row justify-between ps-5">
                      <Text className="text-muted-foreground text-xs">{x.section}</Text>
                      <Text className="text-xs font-medium">{x.count}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View className="border-border flex-row justify-between border-t pt-2">
                <Text className="text-sm font-semibold">{a('stats.total_students')}</Text>
                <Text className="font-bold">{formatNumber(classTotal)}</Text>
              </View>
            </>
          ) : (
            <Text variant="muted">{a('charts.no_data')}</Text>
          )}
        </CardContent>
      </Card>

      {s ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{a('library.title')}</CardTitle>
            <CardDescription>{a('library.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            {(
              [
                [Bookmark, a('library.total_books'), a('library.in_library'), s.libraryBooks, 'text-blue-600'],
                [BookOpen, a('library.borrowed_books'), a('library.currently_issued'), s.borrowedBooks, 'text-orange-600'],
                [Calendar, a('library.upcoming_events'), a('library.active_events'), s.activeEvents, 'text-purple-600'],
              ] as const
            ).map(([icon, title, sub, value, tone]) => (
              <View key={title} className="flex-row items-center gap-3">
                <Icon as={icon} className={`size-6 ${tone}`} />
                <View className="flex-1">
                  <Text className="text-sm font-medium">{title}</Text>
                  <Text className="text-muted-foreground text-xs">{sub}</Text>
                </View>
                <Text className="text-2xl font-bold">{formatNumber(value)}</Text>
              </View>
            ))}
            <Text className="text-muted-foreground border-border border-t pt-2 text-xs">{a('staff.summary', { total: s.totalStaff, teachers: s.totalTeachers })}</Text>
          </CardContent>
        </Card>
      ) : null}
    </ScrollView>
  );
}
