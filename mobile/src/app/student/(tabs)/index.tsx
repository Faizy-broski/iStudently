import type { PerformanceMetrics } from '@studently/api-client';
import { router, type Href } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Library,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Search,
  Smile,
  Star,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { InfoRow, Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { SchoolLogo } from '@/components/app/school-logo';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { AcademicPickers } from '@/features/portal/academic-pickers';
import { usePortalAcademic } from '@/features/portal/academic';
import { useStudentAssignmentList } from '@/features/portal/assignments';
import { usePortalCurrency } from '@/features/portal/currency';
import { FinancialWidget } from '@/features/portal/fees';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminOnlineClasses, adminWeather, portal, student } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { daysUntil, formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const loc = () => (i18n.language === 'ar' ? 'ar' : 'en');
const monthYear = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(loc(), { month: 'short', year: 'numeric' }) : '');
const monthDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(loc(), { month: 'short', day: 'numeric' }) : '');
const weekdayDay = (iso: string) => new Date(iso).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' });
const go = (href: string) => router.push(href as Href);
const open = (href: string, title: string) => openPortalPage('student', { href, title });

/** Web getPerformanceState: band, colour and label key for a percentage. */
function band(p: number) {
  if (p >= 95) return { bar: 'bg-brand', text: 'text-brand dark:text-brand-secondary', key: 'distinguished' };
  if (p >= 85) return { bar: 'bg-success', text: 'text-success', key: 'excellent' };
  if (p >= 75) return { bar: 'bg-brand-accent', text: 'text-brand-accent', key: 'good' };
  if (p >= 60) return { bar: 'bg-warning', text: 'text-warning', key: 'acceptable' };
  return { bar: 'bg-destructive', text: 'text-destructive', key: 'needs_follow_up' };
}

function Section({ title, onViewAll, children }: { title: string; onViewAll?: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">{title}</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
            <Text className="text-brand-secondary text-sm font-medium">{t('app.sad_view_all')}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card size-10 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={label}>
      <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />
    </Pressable>
  );
}

/** Ring on the hero card (overall performance). */
function Ring({ pct, size = 72 }: { pct: number; size?: number }) {
  const c = useColors();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.overlayLight} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.brandSecondary} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(len * Math.min(100, Math.max(0, pct))) / 100} ${len}`} />
      </Svg>
      <Text className="text-white text-base font-bold">{`${Math.round(pct)}%`}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 items-center gap-2 rounded-2xl border py-3 active:opacity-80" accessibilityRole="button">
      <Icon as={icon} strokeWidth={2.3} className="text-brand dark:text-brand-secondary size-5" />
      <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Student dashboard (Figma student home; web: /student/dashboard): greeting, term hero (performance,
 * grade, attendance, rank, homework counts), year/quarter pickers, Setup Assistant, today's timetable,
 * homework due soon, upcoming exams, performance meter, online classes, announcements, quick actions,
 * marking periods, campus details, fees and weather.
 */
export default function StudentDashboard() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`dashboard.${k}`, o);
  const k = (key: string, o?: Record<string, unknown>) => t(`app.sd_${key}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const ownCampus = profile?.campus_id ?? null;
  const { campus } = useCampus();
  const academic = usePortalAcademic();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const { money } = usePortalCurrency();

  const overview = useApi(['student', 'overview'], () => student.getDashboardOverview());
  const info = useApi(['student', 'info'], () => student.getStudentInfo());
  const fees = useApi(['student', 'fees'], () => student.getStudentFees());
  const perf = useApi(['student', 'performance'], () => student.getPerformanceMetrics());
  const rank = useApi(['student', 'gpa-rank'], () => student.getStudentGpaRank());
  const exams = useApi(['student', 'exams-upcoming'], () => student.getUpcomingExams());
  const homework = useStudentAssignmentList();
  const notes = useApi(['portal', 'notes', ownCampus ?? 'own'], ([, , c]) => portal.notes(c === 'own' ? undefined : (c as string)));
  const onlineOn = plugins.includes('online_classes');
  const online = useApi(onlineOn ? ['student', 'online-enrolled'] : null, () => adminOnlineClasses.enrolled());
  const weatherOn = plugins.includes('weather_alerts');
  const campusId = campus?.id ?? null;
  const weather = useApi(weatherOn ? ['student', 'weather', campusId ?? 'school'] : null, ([, , c]) => adminWeather.widget(c === 'school' ? undefined : c));

  const refresh = () =>
    Promise.all([overview.mutate(), info.mutate(), fees.mutate(), perf.mutate(), rank.mutate(), exams.mutate(), homework.mutate(), notes.mutate(), online.mutate(), settings.mutate(), weather.mutate()]);
  const o = overview.data;
  const s = info.data;
  const quarter = academic.quarter;
  const year = academic.year;

  if ((overview.isLoading || info.isLoading) && !o) {
    return (
      <AuthBackground>
        <SafeAreaView edges={['top']} className="flex-1 gap-4 p-4">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </SafeAreaView>
      </AuthBackground>
    );
  }

  const first = s?.first_name || profile?.first_name || '';
  const fullName = `${first} ${s?.last_name || profile?.last_name || ''}`.trim();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? k('morning', { name: first }) : hour < 17 ? k('afternoon', { name: first }) : k('evening', { name: first });
  const classLine = [[s?.grade_level_name, s?.section_name].filter(Boolean).join(' - '), quarter?.title].filter(Boolean).join(' · ');

  // Hero numbers.
  const m = perf.data;
  const g = rank.data;
  const average = g?.percentage ?? m?.gradeAverage ?? null;
  const attendancePct = o?.attendanceSummary.percentage ?? 0;
  const todo = homework.data?.todo ?? [];
  const overdue = todo.filter((a) => a.due_date && daysUntil(a.due_date) < 0).length;
  const pending = todo.length - overdue;
  const submittedCount = (homework.data?.submitted?.length ?? 0) + (homework.data?.graded?.length ?? 0);
  const subline = [k('attendance_pct', { pct: attendancePct }), g?.rank && g.total_students ? k('rank_of', { rank: g.rank, total: g.total_students }) : null].filter(Boolean).join(' · ');

  const timetable = o?.todayTimetable ?? [];
  const nextIdx = timetable.findIndex((c) => timeStatus(c.start_time).status === 'upcoming' || timeStatus(c.start_time).status === 'soon');
  const examList = exams.data ?? [];
  const noteList = (notes.data ?? []).slice(0, 2);
  const classes = online.data ?? [];

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={overview.isValidating && !!o} onRefresh={refresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => go('/student/profile')} accessibilityRole="button" accessibilityLabel={fullName}>
              <PersonAvatar url={profile?.profile_photo_url || s?.profile_photo_url} name={fullName} size={44} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {greeting}
              </Text>
              {classLine ? (
                <Text variant="muted" className="text-xs" numberOfLines={1}>
                  {classLine}
                </Text>
              ) : null}
            </View>
            <RoundButton icon={Search} label={t('app.ad_search_modules')} onPress={() => go('/student/more')} />
            <RoundButton icon={Bell} label={t('app.pn_title')} onPress={() => go('/student/portal/notes')} />
          </View>

          {overview.error ? (
            <View className="bg-destructive-soft flex-row items-center gap-3 rounded-2xl p-4">
              <Icon as={AlertCircle} className="text-destructive size-5" />
              <View className="flex-1">
                <Text className="text-destructive font-medium">{d('error_loading')}</Text>
                <Text className="text-destructive text-sm">{overview.error.message}</Text>
              </View>
            </View>
          ) : null}

          {/* Term hero */}
          <Pressable onPress={() => go('/student/grades')} accessibilityRole="button">
            <BrandGradient variant="primary" angle={150} style={{ borderRadius: 24 }}>
              <View className="gap-4 p-5">
                <View className="flex-row items-center gap-4">
                  <Ring pct={m?.overall ?? 0} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-white text-xs opacity-80">{k('term_average')}</Text>
                    <Text className="text-white text-2xl font-bold" numberOfLines={1}>
                      {[g?.grade, average !== null ? `${Math.round(average * 10) / 10}%` : '—'].filter(Boolean).join(' · ')}
                    </Text>
                    <Text className="text-white text-xs opacity-80" numberOfLines={1}>
                      {subline}
                    </Text>
                  </View>
                </View>
                <View className="bg-overlay-light h-px" />
                <Pressable onPress={() => go('/student/assignments')} className="flex-row" accessibilityRole="button">
                  <HeroStat value={pending} label={d('assignments.pending')} />
                  <HeroStat value={submittedCount} label={d('assignments.submitted')} />
                  <HeroStat value={overdue} label={k('overdue')} accent />
                </Pressable>
              </View>
            </BrandGradient>
          </Pressable>

          <AcademicPickers />

          <SetupAssistantPanel
            role="student"
            plugins={plugins}
            config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined}
            onOpen={(href, title) => openPortalPage('student', { href, title })}
          />

          {/* Today's timetable */}
          <Section title={d('schedule.title')} onViewAll={() => go('/student/timetable')}>
            {timetable.length ? (
              <Panel>
                {timetable.map((c, i) => {
                  const st = timeStatus(c.start_time);
                  const current = st.status === 'current';
                  const past = st.status === 'past';
                  const label = current ? k('now') : past ? k('done') : i === nextIdx ? k('next') : st.status === 'upcoming' ? d('status.in_min', { min: st.min }) : d(`status.${st.key}`);
                  const tone: ChipTone = current ? 'warning' : past ? 'muted' : 'info';
                  return (
                    <View key={c.id} className={cn('flex-row items-center gap-3 px-4 py-3', current && 'bg-info-soft/60', i < timetable.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className="w-12">
                        <Text className="text-sm font-bold">{c.start_time.slice(0, 5)}</Text>
                        <Text variant="muted" className="text-[11px]">
                          {c.end_time.slice(0, 5)}
                        </Text>
                      </View>
                      <View className={cn('h-9 w-1 rounded-full', current ? 'bg-brand-accent' : past ? 'bg-muted' : 'bg-brand')} />
                      <View className="flex-1">
                        <Text className={cn('text-sm font-semibold', past && 'text-muted-foreground')} numberOfLines={1}>
                          {c.subject.name}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[`${c.teacher.profile.first_name} ${c.teacher.profile.last_name}`.trim(), c.room_number ? d('schedule.room', { number: c.room_number }) : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <StatusChip label={label} tone={tone} className="px-2 py-0.5" />
                    </View>
                  );
                })}
              </Panel>
            ) : (
              <Panel className="items-center px-4 py-6">
                <Icon as={CalendarIcon} className="text-muted-foreground mb-2 size-7" />
                <Text className="font-semibold">{d('schedule.no_classes')}</Text>
                <Text variant="muted" className="mt-1 text-center text-sm">
                  {d('schedule.free_time')}
                </Text>
              </Panel>
            )}
          </Section>

          {/* Homework due soon */}
          <Section title={k('homework')} onViewAll={() => go('/student/assignments')}>
            {o?.dueAssignments.length ? (
              <Panel>
                {o.dueAssignments.map((a, i, arr) => {
                  const days = daysUntil(a.due_date);
                  const [tone, label]: [ChipTone, string] =
                    days < 0 ? ['destructive', k('overdue')] : days === 0 ? ['destructive', d('urgency.due_today')] : days === 1 ? ['warning', d('urgency.due_tomorrow')] : ['info', d('urgency.due_in', { time: formatRelative(a.due_date) })];
                  const box = tone === 'destructive' ? 'bg-destructive-soft' : tone === 'warning' ? 'bg-warning-soft' : 'bg-info-soft';
                  const fg = tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-brand dark:text-brand-secondary';
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => router.push({ pathname: '/student/assignments/[id]', params: { id: a.id } })}
                      className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className={cn('size-9 items-center justify-center rounded-xl', box)}>
                        <Icon as={ClipboardList} className={cn('size-4', fg)} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {a.title}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[a.subject.name, formatDateTime(a.due_date), t('app.st_pts', { count: a.max_score })].join(' · ')}
                        </Text>
                        <Text className={cn('text-[11px] font-semibold', a.submission ? 'text-success' : 'text-warning')}>{a.submission ? d('assignments.submitted') : d('assignments.pending')}</Text>
                      </View>
                      <StatusChip label={label} tone={tone} className="px-2 py-0.5" />
                    </Pressable>
                  );
                })}
              </Panel>
            ) : (
              <Panel className="items-center px-4 py-6">
                <Icon as={CheckCircle2} className="text-success mb-2 size-7" />
                <Text className="text-sm font-semibold">{d('assignments.caught_up')}</Text>
                <Text variant="muted" className="mt-1 text-xs">
                  {d('assignments.no_assignments')}
                </Text>
              </Panel>
            )}
          </Section>

          {/* Upcoming exams */}
          {examList.length ? (
            <Section title={k('assessments')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-2 pe-1" className="-mx-1 px-1">
                {examList.map((e, i) => (
                  <Panel key={e.id} className="w-44 gap-2 p-3">
                    <StatusChip label={weekdayDay(e.exam_date)} tone={i === 0 ? 'warning' : 'info'} className="self-start px-2 py-0.5" />
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {e.title || e.subject?.name}
                    </Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={2}>
                      {[e.subject?.name, e.start_time ? `${e.start_time.slice(0, 5)}${e.end_time ? `–${e.end_time.slice(0, 5)}` : ''}` : null, e.room_number ? d('schedule.room', { number: e.room_number }) : null, e.total_marks ? t('app.st_pts', { count: e.total_marks }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Panel>
                ))}
              </ScrollView>
            </Section>
          ) : null}

          <PerformanceMeter metrics={m} loading={perf.isLoading} />

          {/* Online classes (plugin) */}
          {onlineOn && classes.length ? (
            <Section title={t('online_classes.my_enrolled_classes')} onViewAll={() => go('/student/online-classes/enrolled')}>
              <Panel>
                {classes.slice(0, 3).map((c, i, arr) => {
                  const room = c.status === 'active' ? (c.jitsi_room_id ?? null) : null;
                  return (
                    <View key={c.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
                        <Icon as={Video} className="text-brand dark:text-brand-secondary size-4" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {c.title}
                        </Text>
                        {c.scheduled_days ? (
                          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                            {`${c.scheduled_days} ${c.session_start_time || ''}${c.session_end_time ? `–${c.session_end_time}` : ''}`}
                          </Text>
                        ) : null}
                      </View>
                      {room ? (
                        <Pressable onPress={() => router.push({ pathname: '/student/jitsi-meet/rooms/[id]', params: { id: room } })} className="overflow-hidden rounded-full" accessibilityRole="button">
                          <BrandGradient variant="primary" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                            <Text className="text-white text-xs font-semibold">{t('online_classes.join_class')}</Text>
                          </BrandGradient>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </Panel>
            </Section>
          ) : null}

          {/* Announcements */}
          {noteList.length ? (
            <Section title={t('app.pn_title')} onViewAll={() => go('/student/portal/notes')}>
              <Panel>
                {noteList.map((n, i) => (
                  <Pressable
                    key={n.id}
                    onPress={() => go('/student/portal/notes')}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < noteList.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className={cn('size-9 items-center justify-center rounded-xl', i === 0 ? 'bg-warning-soft' : 'bg-info-soft')}>
                      <Icon as={i === 0 ? Megaphone : CalendarIcon} className={cn('size-4', i === 0 ? 'text-warning' : 'text-brand dark:text-brand-secondary')} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text variant="muted" className="text-[11px]">
                        {formatRelative(n.created_at)}
                      </Text>
                    </View>
                    <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" />
                  </Pressable>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Quick actions */}
          <Section title={k('quick_actions')}>
            <View className="flex-row gap-2.5">
              <QuickAction icon={Upload} label={k('qa_submit')} onPress={() => go('/student/assignments')} />
              <QuickAction icon={CalendarIcon} label={k('qa_timetable')} onPress={() => go('/student/timetable')} />
              <QuickAction icon={Library} label={k('qa_library')} onPress={() => open('/student/e-library', 'e_library')} />
              <QuickAction icon={MessageSquare} label={k('qa_messages')} onPress={() => open('/student/messaging', 'messaging')} />
            </View>
          </Section>

          {/* Marking periods */}
          <Section title={d('academic.hierarchy')}>
            <Panel>
              <InfoRow icon={Building2} label={d('academic.year')} value={`${year?.name || d('academic.session')}${year ? ` · ${monthYear(year.start_date)} - ${monthYear(year.end_date)}` : ''}`} />
              <InfoRow icon={TrendingUp} label={d('academic.quarter')} value={`${quarter?.title || d('academic.no_quarter')}${quarter ? ` · ${monthDay(quarter.start_date)} - ${monthDay(quarter.end_date)}` : ''}`} />
              <View className="flex-row items-center gap-3 px-4 py-2.5">
                <View className="bg-success-soft size-8 items-center justify-center rounded-full">
                  <Icon as={CheckCircle2} className="text-success size-4" />
                </View>
                <View className="flex-1">
                  <Text variant="muted" className="text-[11px]">
                    {d('academic.grading_status')}
                  </Text>
                  <Text className="text-sm font-medium">{d('academic.grade_posting')}</Text>
                </View>
                <StatusChip label={d('academic.active')} tone="success" className="px-2 py-0.5" />
              </View>
            </Panel>
          </Section>

          {/* Campus details */}
          <Section title={d('campus.details')}>
            <Panel>
              <View className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3">
                <View className="bg-info-soft size-12 items-center justify-center overflow-hidden rounded-xl">
                  {campus?.logo_url ? <SchoolLogo url={campus.logo_url} shape={campus.logo_shape} size={40} /> : <Icon as={Building2} className="text-brand dark:text-brand-secondary size-6" />}
                </View>
                <View className="flex-1">
                  <Text className="font-bold" numberOfLines={1}>
                    {campus?.name || s?.school_name || ''}
                  </Text>
                  <StatusChip label={campus?.short_name || d('campus.active_campus')} tone="info" className="mt-1 self-start px-2 py-0.5" />
                </View>
              </View>
              <InfoRow icon={MapPin} label={d('campus.address')} value={campus?.address || s?.school_address || d('campus.not_provided')} />
              <InfoRow icon={Phone} label={d('campus.contact')} value={campus?.phone || s?.school_phone || d('campus.not_provided')} />
              <InfoRow icon={Mail} label={d('campus.email')} value={campus?.contact_email || 'contact@istudents.ly'} />
              <InfoRow icon={UserRound} label={d('campus.principal')} value={campus?.principal_name || 'N/A'} last />
            </Panel>
          </Section>

          <FinancialWidget fees={fees.data ?? []} isLoading={fees.isLoading} money={money} onViewAll={() => open('/student/billing/fees', 'fees')} />

          {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

          <Text variant="muted" className="text-center text-[11px]">
            {`${new Date().toLocaleDateString(loc(), { weekday: 'long' })}, ${formatDate(new Date().toISOString())}`}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

function HeroStat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View className="flex-1 items-center">
      <Text className={cn('text-xl font-bold', accent ? 'text-brand-accent' : 'text-white')}>{value}</Text>
      <Text className="text-white text-[11px] opacity-80">{label}</Text>
    </View>
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

/** Web PerformanceMeter: overall score, master bar and four sub-metrics. */
function PerformanceMeter({ metrics, loading }: { metrics?: PerformanceMetrics; loading: boolean }) {
  const { t } = useTranslation();
  const p = (k: string) => t(`dashboard.performance.${k}`);
  if (loading) return <Skeleton className="h-56 rounded-2xl" />;
  const m = metrics ?? { overall: 0, attendance: 0, gradeAverage: 0, behavior: 0, assignments: 0 };
  const ob = band(m.overall);
  const subs = [
    { icon: Users, key: 'attendance', v: m.attendance },
    { icon: Star, key: 'grade_average', v: m.gradeAverage },
    { icon: Smile, key: 'behavior', v: m.behavior },
    { icon: FileText, key: 'assignments', v: m.assignments },
  ];
  return (
    <Section title={p('title')}>
      <Panel className="gap-4 p-4">
        <View className="flex-row items-end justify-between">
          <View>
            <Text variant="muted" className="text-xs">
              {p('overall')}
            </Text>
            <Text className="text-brand dark:text-foreground text-3xl font-extrabold">{`${m.overall}%`}</Text>
          </View>
          <StatusChip label={p(ob.key)} tone={m.overall >= 85 ? 'success' : m.overall >= 60 ? 'warning' : 'destructive'} />
        </View>
        <View className="bg-info-soft h-2.5 overflow-hidden rounded-full">
          <View className={cn('h-full rounded-full', ob.bar)} style={{ width: `${Math.min(100, m.overall)}%` }} />
        </View>
        <View className="flex-row gap-2">
          {subs.map((x) => {
            const b = band(x.v);
            return (
              <View key={x.key} className="flex-1 gap-1">
                <View className="flex-row items-center gap-1">
                  <Icon as={x.icon} className="text-muted-foreground size-3" />
                  <Text variant="muted" className="flex-1 text-[10px]" numberOfLines={1}>
                    {p(x.key)}
                  </Text>
                </View>
                <Text className="text-sm font-bold">{`${x.v}%`}</Text>
                <View className="bg-info-soft h-1.5 overflow-hidden rounded-full">
                  <View className={cn('h-full', b.bar)} style={{ width: `${Math.min(100, x.v)}%` }} />
                </View>
                <Text className={cn('text-[10px] font-semibold', b.text)} numberOfLines={1}>
                  {p(b.key)}
                </Text>
              </View>
            );
          })}
        </View>
      </Panel>
    </Section>
  );
}
