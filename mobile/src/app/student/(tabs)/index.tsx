import type { PerformanceMetrics } from '@studently/api-client';
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Phone,
  Smile,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { Picker } from '@/components/app/picker';
import { SchoolLogo } from '@/components/app/school-logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { usePortalAcademic } from '@/features/portal/academic';
import { usePortalCurrency } from '@/features/portal/currency';
import { FinancialWidget } from '@/features/portal/fees';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminWeather, student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { daysUntil, formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const loc = () => (i18n.language === 'ar' ? 'ar' : 'en');
const monthYear = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(loc(), { month: 'short', year: 'numeric' }) : '');
const monthDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(loc(), { month: 'short', day: 'numeric' }) : '');

/** Web getPerformanceState: band, colour and label key for a percentage. */
function band(p: number) {
  if (p >= 95) return { bar: 'bg-blue-600', text: 'text-blue-600', key: 'distinguished' };
  if (p >= 85) return { bar: 'bg-green-500', text: 'text-green-500', key: 'excellent' };
  if (p >= 75) return { bar: 'bg-yellow-500', text: 'text-yellow-500', key: 'good' };
  if (p >= 60) return { bar: 'bg-orange-500', text: 'text-orange-500', key: 'acceptable' };
  return { bar: 'bg-red-500', text: 'text-red-500', key: 'needs_follow_up' };
}

/**
 * Student dashboard (web: /student/dashboard): profile header, Setup Assistant, today's schedule,
 * performance meter, marking periods, campus details, assignments due soon, fees and weather.
 */
export default function StudentDashboard() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`dashboard.${k}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { campus } = useCampus();
  const academic = usePortalAcademic();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const { money } = usePortalCurrency();

  const overview = useApi(['student', 'overview'], () => student.getDashboardOverview());
  const info = useApi(['student', 'info'], () => student.getStudentInfo());
  const fees = useApi(['student', 'fees'], () => student.getStudentFees());
  const perf = useApi(['student', 'performance'], () => student.getPerformanceMetrics());
  const weatherOn = plugins.includes('weather_alerts');
  const campusId = campus?.id ?? null;
  const weather = useApi(weatherOn ? ['student', 'weather', campusId ?? 'school'] : null, ([, , c]) => adminWeather.widget(c === 'school' ? undefined : c));

  const refresh = () => Promise.all([overview.mutate(), info.mutate(), fees.mutate(), perf.mutate(), settings.mutate(), weather.mutate()]);
  const o = overview.data;
  const s = info.data;
  const female = (profile?.gender || s?.gender || '').toLowerCase() === 'female';
  const accent = female ? 'text-pink-600 dark:text-pink-400' : 'text-[#022172] dark:text-blue-400';
  const quarter = academic.quarter;
  const year = academic.year;

  if ((overview.isLoading || info.isLoading) && !o) {
    return (
      <View className="bg-background flex-1 gap-4 p-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={overview.isValidating && !!o} onRefresh={refresh} />}>
      {overview.error ? (
        <View className="flex-row items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <Icon as={AlertCircle} className="size-5 text-red-600" />
          <View className="flex-1">
            <Text className="font-medium text-red-900 dark:text-red-200">{d('error_loading')}</Text>
            <Text className="text-sm text-red-700 dark:text-red-300">{overview.error.message}</Text>
          </View>
        </View>
      ) : null}

      {/* Profile header */}
      <View className={cn('gap-3 overflow-hidden rounded-2xl p-5', female ? 'bg-[#EC4899]' : 'bg-[#022172]')}>
        <View className="flex-row items-center gap-4">
          <View className={cn('rounded-full border-4', female ? 'border-white/40' : 'border-white/20')}>
            <PersonAvatar url={profile?.profile_photo_url || s?.profile_photo_url} name={`${s?.first_name || profile?.first_name || ''} ${s?.last_name || profile?.last_name || ''}`} size={72} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">{d('welcome_back', { name: s?.first_name || profile?.first_name || '' })}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Icon as={Clock} className="size-3.5 text-white/80" />
              <Text className="text-xs text-white/80">{d('last_login', { date: formatDateTime(new Date().toISOString()) })}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <Icon as={GraduationCap} className="size-3.5 text-white" />
            <Text className="text-xs font-medium text-white">{`${s?.grade_level_name ?? ''} — ${s?.section_name ?? ''}`}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <Icon as={Building2} className="size-3.5 text-white" />
            <Text className="text-xs font-medium text-white">{campus?.name || s?.school_name || ''}</Text>
          </View>
          {quarter ? (
            <View className={cn('rounded-full px-3 py-1', female ? 'bg-amber-300' : 'bg-[#EEA831]')}>
              <Text className={cn('text-xs font-bold', female ? 'text-pink-950' : 'text-[#022172]')}>{quarter.title}</Text>
            </View>
          ) : null}
        </View>
        <View className="rounded-xl border border-white/10 bg-white/10 p-3">
          <Text className="text-xs text-white/80">{d('academic_progress')}</Text>
          <Text className="text-xl font-bold text-white">
            {`${o?.attendanceSummary.percentage ?? 0}% `}
            <Text className="text-xs text-white/60">{d('attendance')}</Text>
          </Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <View className={cn('h-full', female ? 'bg-amber-300' : 'bg-[#EEA831]')} style={{ width: `${Math.min(100, o?.attendanceSummary.percentage ?? 0)}%` }} />
          </View>
        </View>
      </View>

      {/* Academic year + quarter (web sidebar pickers) */}
      {academic.years.length > 0 ? (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Picker value={year?.id ?? null} onChange={academic.setYear} options={academic.years.map((y) => ({ value: y.id, label: y.name }))} placeholder={t('app.st_year')} />
          </View>
          <View className="flex-1">
            <Picker
              value={quarter?.id ?? null}
              onChange={academic.setQuarter}
              options={academic.quarters.map((q) => ({ value: q.id, label: q.title }))}
              placeholder={academic.quarters.length ? t('app.st_quarter') : t('app.st_no_quarters')}
            />
          </View>
        </View>
      ) : null}

      <SetupAssistantPanel
        role="student"
        plugins={plugins}
        config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined}
        onOpen={(href, title) => openPortalPage('student', { href, title })}
      />

      {/* Today's schedule */}
      <Card className="gap-3 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <View className="flex-row items-center gap-2">
            <View className={cn('rounded-lg p-2', female ? 'bg-pink-50 dark:bg-pink-950/30' : 'bg-blue-50 dark:bg-blue-900/20')}>
              <Icon as={CalendarIcon} className={cn('size-5', accent)} />
            </View>
            <View>
              <CardTitle className="text-lg">{d('schedule.title')}</CardTitle>
              <Text className="text-muted-foreground text-xs">{`${new Date().toLocaleDateString(loc(), { weekday: 'long' })}, ${formatDate(new Date().toISOString())}`}</Text>
            </View>
          </View>
          <Badge variant="outline">
            <Text className={accent}>{d('schedule.classes', { count: o?.todayTimetable.length ?? 0 })}</Text>
          </Badge>
        </CardHeader>
        <CardContent className="gap-3 px-4">
          {o?.todayTimetable.length ? (
            o.todayTimetable.map((c) => {
              const st = timeStatus(c.start_time);
              const current = st.status === 'current';
              return (
                <View
                  key={c.id}
                  className={cn(
                    'flex-row items-center gap-3 rounded-xl border p-3',
                    current ? (female ? 'border-pink-200 bg-pink-50/60 dark:border-pink-800 dark:bg-pink-950/30' : 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20') : 'border-border bg-card',
                  )}>
                  <View className={cn('rounded-xl p-2.5', current ? (female ? 'bg-pink-500' : 'bg-[#022172]') : 'bg-muted')}>
                    <Icon as={BookOpen} className={cn('size-5', current ? 'text-white' : 'text-muted-foreground')} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold">{c.subject.name}</Text>
                    <View className="flex-row flex-wrap items-center gap-x-2">
                      <Text className="text-muted-foreground text-xs">{`${c.start_time} - ${c.end_time}`}</Text>
                      <Text className="text-muted-foreground text-xs">•</Text>
                      <View className="flex-row items-center gap-1">
                        <Icon as={MapPin} className="text-muted-foreground size-3" />
                        <Text className="text-muted-foreground text-xs">{d('schedule.room', { number: c.room_number })}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="items-end gap-1">
                    <View
                      className={cn(
                        'rounded-full px-2 py-0.5',
                        current ? 'bg-green-500' : st.status === 'soon' ? (female ? 'bg-pink-100' : 'bg-[#EEA831]') : st.status === 'past' ? 'bg-muted' : female ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
                      )}>
                      <Text
                        className={cn(
                          'text-[11px] font-semibold',
                          current ? 'text-white' : st.status === 'soon' ? (female ? 'text-pink-800' : 'text-[#022172]') : st.status === 'past' ? 'text-muted-foreground' : female ? 'text-pink-700 dark:text-pink-400' : 'text-blue-700 dark:text-blue-400',
                        )}>
                        {st.status === 'upcoming' ? d('status.in_min', { min: st.min }) : d(`status.${st.key}`)}
                      </Text>
                    </View>
                    <Text className="text-muted-foreground text-[11px]">{`${c.teacher.profile.first_name} ${c.teacher.profile.last_name}`}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="items-center py-8">
              <View className={cn('mb-3 size-14 items-center justify-center rounded-full', female ? 'bg-pink-50 dark:bg-pink-950/30' : 'bg-muted')}>
                <Icon as={CalendarIcon} className={cn('size-7', female ? 'text-pink-400' : 'text-muted-foreground')} />
              </View>
              <Text className="font-semibold">{d('schedule.no_classes')}</Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">{d('schedule.free_time')}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <PerformanceMeter metrics={perf.data} loading={perf.isLoading} />

      {/* Marking periods hierarchy */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <View className="flex-row items-center gap-2">
            <Icon as={GraduationCap} className={cn('size-5', accent)} />
            <CardTitle className={cn('text-lg', accent)}>{d('academic.hierarchy')}</CardTitle>
          </View>
        </CardHeader>
        <CardContent className="gap-4 px-4">
          <View className="gap-2">
            <SectionLabel icon={Building2} label={d('academic.year')} />
            <View className={cn('rounded-xl border p-3', female ? 'border-pink-100 bg-pink-50/70 dark:border-pink-900/50 dark:bg-pink-950/20' : 'border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20')}>
              <Text className={cn('font-bold', accent)}>{year?.name || d('academic.session')}</Text>
              <Text className={cn('mt-1 text-[11px] font-medium', accent)}>{year ? `${monthYear(year.start_date)} - ${monthYear(year.end_date)}` : ' - '}</Text>
            </View>
          </View>
          <View className="gap-2">
            <SectionLabel icon={TrendingUp} label={d('academic.quarter')} />
            <View className={cn('rounded-xl border p-3', female ? 'border-rose-100 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20' : 'border-[#EEA831]/20 bg-[#EEA831]/10')}>
              <Text className={cn('font-bold', female ? 'text-rose-700 dark:text-rose-300' : 'text-[#022172] dark:text-[#EEA831]')}>{quarter?.title || d('academic.no_quarter')}</Text>
              <Text className="text-muted-foreground mt-1 text-[11px] font-medium">{quarter ? `${monthDay(quarter.start_date)} - ${monthDay(quarter.end_date)}` : ' - '}</Text>
            </View>
          </View>
          <View className="gap-2">
            <SectionLabel icon={CheckCircle2} label={d('academic.grading_status')} />
            <View className="rounded-xl border border-green-100 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/20">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-xs font-medium text-green-800 dark:text-green-300">{d('academic.grade_posting')}</Text>
                <View className="rounded bg-green-200 px-1.5">
                  <Text className="text-[10px] text-green-900">{d('academic.active')}</Text>
                </View>
              </View>
              <View className="h-1 overflow-hidden rounded-full bg-green-200">
                <View className="h-full w-3/4 bg-green-600" />
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Campus details */}
      <Card className="gap-0 overflow-hidden py-0">
        <View className={cn('flex-row items-center gap-2 px-4 py-3', female ? 'bg-[#EC4899]' : 'bg-[#022172]')}>
          <Icon as={Building2} className={cn('size-4', female ? 'text-amber-300' : 'text-[#EEA831]')} />
          <Text className="font-semibold text-white">{d('campus.details')}</Text>
        </View>
        <CardContent className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <View className={cn('size-14 items-center justify-center overflow-hidden rounded-xl border p-1.5', female ? 'border-pink-200 bg-pink-50/80 dark:border-pink-800 dark:bg-pink-950/30' : 'border-border bg-muted')}>
              {campus?.logo_url ? <SchoolLogo url={campus.logo_url} shape={campus.logo_shape} size={44} /> : <Icon as={Building2} className={cn('size-8', female ? 'text-pink-400' : 'text-muted-foreground')} />}
            </View>
            <View className="flex-1">
              <Text className="font-bold">{campus?.name || s?.school_name || ''}</Text>
              <Badge variant="outline" className="mt-1 self-start">
                <Text className={cn('text-[10px] font-bold', accent)}>{campus?.short_name || d('campus.active_campus')}</Text>
              </Badge>
            </View>
          </View>
          <Separator />
          <ContactRow icon={MapPin} tone={female ? 'bg-pink-50 dark:bg-pink-950/30' : 'bg-blue-50 dark:bg-blue-900/20'} iconTone={female ? 'text-pink-600' : 'text-blue-600'} label={d('campus.address')} value={campus?.address || s?.school_address || d('campus.not_provided')} />
          <ContactRow icon={Phone} tone="bg-green-50 dark:bg-green-900/20" iconTone="text-green-600" label={d('campus.contact')} value={campus?.phone || s?.school_phone || d('campus.not_provided')} />
          <ContactRow icon={Mail} tone="bg-purple-50 dark:bg-purple-900/20" iconTone="text-purple-600" label={d('campus.email')} value={campus?.contact_email || 'contact@istudents.ly'} />
        </CardContent>
        <View className="bg-muted/50 border-border flex-row items-center justify-between border-t px-4 py-2.5">
          <View className="flex-row items-center gap-2">
            <View className="size-2 rounded-full bg-green-500" />
            <Text className="text-muted-foreground text-[11px] font-bold">{`${d('campus.principal')}: ${campus?.principal_name || 'N/A'}`}</Text>
          </View>
          <Icon as={Info} className="text-muted-foreground size-3" />
        </View>
      </Card>

      {/* Assignments due soon */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <View className="flex-row items-center gap-2">
            <View className="rounded-lg bg-orange-50 p-2 dark:bg-orange-900/20">
              <Icon as={AlertCircle} className="size-5 text-orange-600 dark:text-orange-400" />
            </View>
            <CardTitle className="text-lg">{d('assignments.due_soon')}</CardTitle>
          </View>
        </CardHeader>
        <CardContent className="gap-3 px-4">
          {o?.dueAssignments.length ? (
            o.dueAssignments.map((a) => {
              const days = daysUntil(a.due_date);
              const [box, text, label] =
                days <= 0
                  ? ['bg-red-100 dark:bg-red-900/30', 'text-red-700 dark:text-red-400', d('urgency.due_today')]
                  : days === 1
                    ? ['bg-orange-100 dark:bg-orange-900/30', 'text-orange-700 dark:text-orange-400', d('urgency.due_tomorrow')]
                    : ['bg-blue-100 dark:bg-blue-900/30', 'text-blue-700 dark:text-blue-400', d('urgency.due_in', { time: formatRelative(a.due_date) })];
              return (
                <View key={a.id} className="border-border bg-card gap-2 rounded-xl border p-3">
                  <View className="flex-row items-start justify-between">
                    <View className={cn('rounded-full px-2 py-0.5', box)}>
                      <Text className={cn('text-[11px] font-semibold', text)}>{label}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs font-bold">{t('app.st_pts', { count: a.max_score })}</Text>
                  </View>
                  <Text className="font-bold" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text className="text-muted-foreground text-xs font-medium">{a.subject.name}</Text>
                  <View className="border-border mt-1 flex-row items-center justify-between border-t pt-2">
                    <Text className="text-muted-foreground text-xs">{formatDateTime(a.due_date)}</Text>
                    <View className="flex-row items-center gap-1">
                      <View className={cn('size-1.5 rounded-full', a.submission ? 'bg-green-500' : 'bg-orange-500')} />
                      <Text className={cn('text-xs font-bold', a.submission ? 'text-green-600' : 'text-orange-600')}>{a.submission ? d('assignments.submitted') : d('assignments.pending')}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="items-center py-6">
              <View className="bg-muted mb-3 size-12 items-center justify-center rounded-full">
                <Icon as={BookOpen} className="text-muted-foreground size-6" />
              </View>
              <Text className="text-sm font-semibold">{d('assignments.caught_up')}</Text>
              <Text className="text-muted-foreground mt-1 text-xs">{d('assignments.no_assignments')}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <FinancialWidget
        fees={fees.data ?? []}
        isLoading={fees.isLoading}
        money={money}
        onViewAll={() => openPortalPage('student', { href: '/student/billing/fees', title: 'fees' })}
      />

      {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}
    </ScrollView>
  );
}

/** Web getTimeStatus: past (>30 min ago), in progress, starting soon (≤15 min) or "in N min". */
function timeStatus(start: string) {
  const [h, m] = start.split(':');
  const at = new Date();
  at.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  const min = Math.floor((at.getTime() - Date.now()) / 60000);
  if (min < -30) return { status: 'past', key: 'completed', min } as const;
  if (min <= 0) return { status: 'current', key: 'in_progress', min } as const;
  if (min <= 15) return { status: 'soon', key: 'starting_soon', min } as const;
  return { status: 'upcoming', key: 'in_min', min } as const;
}

function SectionLabel({ icon, label }: { icon: typeof Info; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon as={icon} className="text-muted-foreground size-3.5" />
      <Text className="text-muted-foreground text-xs font-bold tracking-widest uppercase">{label}</Text>
    </View>
  );
}

function ContactRow({ icon, tone, iconTone, label, value }: { icon: typeof Info; tone: string; iconTone: string; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className={cn('rounded-lg p-1.5', tone)}>
        <Icon as={icon} className={cn('size-3.5', iconTone)} />
      </View>
      <View className="flex-1">
        <Text className="text-muted-foreground text-[10px] font-bold uppercase">{label}</Text>
        <Text className="text-muted-foreground mt-0.5 text-xs font-medium">{value}</Text>
      </View>
    </View>
  );
}

/** Web PerformanceMeter: overall score, master bar and four sub-metrics. */
function PerformanceMeter({ metrics, loading }: { metrics?: PerformanceMetrics; loading: boolean }) {
  const { t } = useTranslation();
  const p = (k: string) => t(`dashboard.performance.${k}`);
  if (loading) return <Skeleton className="h-72 rounded-2xl" />;
  const m = metrics ?? { overall: 0, attendance: 0, gradeAverage: 0, behavior: 0, assignments: 0 };
  const ob = band(m.overall);
  const subs = [
    { icon: Users, key: 'attendance', v: m.attendance },
    { icon: Star, key: 'grade_average', v: m.gradeAverage },
    { icon: Smile, key: 'behavior', v: m.behavior },
    { icon: FileText, key: 'assignments', v: m.assignments },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <View className="bg-muted/50 border-border flex-row items-center justify-between border-b px-4 py-3">
        <Text className="text-lg font-bold">{p('title')}</Text>
        <Icon as={Info} className="text-muted-foreground size-5" />
      </View>
      <CardContent className="gap-6 p-4">
        <View className="items-center">
          <Text className="text-muted-foreground mb-1 text-sm font-semibold tracking-widest uppercase">{p('overall')}</Text>
          <Text className="text-5xl font-extrabold text-[#022172] dark:text-white">{`${m.overall}%`}</Text>
          <Text className={cn('mt-2 text-sm font-bold', ob.text)}>{p(ob.key)}</Text>
        </View>
        <View>
          <View className="bg-muted h-3 overflow-hidden rounded-full">
            <View className={cn('h-full rounded-full', ob.bar)} style={{ width: `${Math.min(100, m.overall)}%` }} />
          </View>
          <View className="mt-2 flex-row justify-between">
            {['0%', '25%', '50%', '75%', '100%'].map((l) => (
              <Text key={l} className="text-muted-foreground text-[10px]">
                {l}
              </Text>
            ))}
          </View>
        </View>
        <View className="flex-row flex-wrap gap-3">
          {subs.map((x) => {
            const b = band(x.v);
            return (
              <View key={x.key} className="border-border bg-card min-w-[45%] flex-1 items-center rounded-xl border p-3">
                <View className="mb-1 flex-row items-center gap-1.5">
                  <Icon as={x.icon} className="text-muted-foreground size-4" />
                  <Text className="text-sm font-bold">{p(x.key)}</Text>
                </View>
                <Text className="text-2xl font-bold">{`${x.v}%`}</Text>
                <Text className={cn('mb-2 text-xs font-semibold', b.text)}>{p(b.key)}</Text>
                <View className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                  <View className={cn('h-full', b.bar)} style={{ width: `${Math.min(100, x.v)}%` }} />
                </View>
              </View>
            );
          })}
        </View>
      </CardContent>
    </Card>
  );
}
