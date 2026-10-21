import { router, type Href } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FilePenLine,
  FileText,
  GraduationCap,
  LayoutGrid,
  NotebookPen,
  PenLine,
  Search,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { usePortalAcademic } from '@/features/portal/academic';
import { AcademicPickers } from '@/features/portal/academic-pickers';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { useTeacherExams } from '@/features/teacher/exams';
import { adminPerformance, adminTimetable, adminWeather, homework, messaging, teacher } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

type Status = 'completed' | 'in-progress' | 'upcoming';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (v?: string | null) => (v ? v.slice(0, 5) : '');
const go = (href: string) => router.push(href as Href);
const initials = (a?: string | null, b?: string | null) => `${(a ?? '').charAt(0)}${(b ?? '').charAt(0)}`.toUpperCase() || '?';

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
            <Text className="text-brand-secondary text-sm font-medium">{action}</Text>
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

function StatTile({ label, value, note, chip, chipTone = 'success', onPress }: { label: string; value: string; note?: string; chip?: string; chipTone?: ChipTone; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 gap-1 rounded-2xl border p-3 active:opacity-80" accessibilityRole={onPress ? 'button' : undefined}>
      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-brand dark:text-foreground text-xl font-bold" numberOfLines={1}>
        {value}
      </Text>
      {chip ? <StatusChip label={chip} tone={chipTone} className="self-start px-2 py-0.5" /> : null}
      {note ? (
        <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 items-center gap-2 rounded-2xl border px-1 py-3 active:opacity-80" accessibilityRole="button">
      <Icon as={icon} strokeWidth={2.3} className="text-brand dark:text-brand-secondary size-5" />
      <Text className="text-brand dark:text-brand-secondary text-center text-[11px] font-semibold" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Teacher dashboard (Figma teacher home; web: /teacher/dashboard): attendance-to-mark banner, periods /
 * attendance / performance tiles, today's schedule with attendance state, class attendance bars, homework
 * awaiting review, upcoming exams, the selected course period's roster, recent messages, quick actions,
 * Setup Assistant and weather.
 */
export default function TeacherDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.dashboard.${key}`, o);
  const x = (key: string, o?: Record<string, unknown>) => t(`app.td_${key}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const staffId = profile?.staff_id ?? null;
  const { campusId } = useCampus();
  const academic = usePortalAcademic();
  const cp = academic.coursePeriod;
  const cpId = cp?.id ?? null;
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const [now, setNow] = useState(() => new Date());
  const [rosterOpen, setRosterOpen] = useState(false);
  const today = ymd(now);

  const schedule = useApi(staffId ? ['teacher', 'schedule', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherSchedule(s as string, d as string));
  const overview = useApi(staffId ? ['teacher', 'attendance-overview', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherAttendanceOverview(s as string, d as string));
  const perf = useApi(staffId ? ['teacher', 'my-score'] : null, () => adminPerformance.myScore());
  const students = useApi(cpId ? ['teacher', 'cp-students', cpId] : null, ([, , c]) => teacher.myCoursePeriodStudents(c as string));
  // Same keys as the submissions and inbox screens, so the caches are shared.
  const hw = useApi(staffId ? ['teacher', 'homework-all', staffId] : null, ([, , s]) => homework.teacherList(s as string, { is_archived: false }));
  const inbox = useApi(['messaging', 'list', 'inbox', '', 'desc'], () => messaging.listMessages('inbox', { page: 1, limit: 50, order: 'desc' }));
  const exams = useTeacherExams();
  const weatherOn = plugins.includes('weather_alerts');
  const weather = useApi(weatherOn ? ['teacher', 'weather', campusId ?? 'school'] : null, () => adminWeather.widget(campusId));
  const open = (href: string, title: string) => openPortalPage('teacher', { href, title });

  if (!profile || (schedule.isLoading && !schedule.data)) return <LoadingList rows={6} />;
  if (!staffId) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text className="text-center text-lg font-medium">{k('notAuthorized')}</Text>
        <Text className="text-muted-foreground mt-2 text-center text-sm">{k('notAuthorizedDesc')}</Text>
      </View>
    );
  }

  const nowStr = now.toTimeString().slice(0, 5);
  const classes = (schedule.data ?? [])
    .filter((c) => !c.is_break)
    .map((c) => {
      const status: Status = c.end_time < nowStr ? 'completed' : c.start_time <= nowStr && nowStr < c.end_time ? 'in-progress' : 'upcoming';
      const ov = (overview.data ?? []).find((a) => a.period_number === c.period_number);
      const s = ov?.stats;
      return {
        ...c,
        subject: c.subject_name || k('unknownSubject'),
        section: c.section_name || k('unknownSection'),
        grade: c.grade_name || k('unknownGrade'),
        status,
        marked: (s?.total_students ?? 0) > 0,
        att: s ? { present: s.present || 0, absent: s.absent || 0, late: s.late || 0, total: s.total_students || 0, percentage: s.percentage || 0 } : undefined,
      };
    })
    .sort((a, b) => a.period_number - b.period_number);
  const current = classes.find((c) => c.status === 'in-progress');
  const next = classes.find((c) => c.status === 'upcoming');
  const withAtt = classes.filter((c) => c.att);
  const totalStudents = withAtt.reduce((s, c) => s + (c.att?.total ?? 0), 0);
  const totalPresent = withAtt.reduce((s, c) => s + (c.att?.present ?? 0) + (c.att?.late ?? 0), 0);
  const completed = classes.filter((c) => c.status === 'completed').length;
  const rate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  const remaining = classes.filter((c) => c.status === 'upcoming').length;
  // Classes that have started (finished or running) and have no attendance yet.
  const toMark = classes.filter((c) => c.status !== 'upcoming' && !c.marked);
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const score = perf.data;
  const scoreTone: ChipTone = !score ? 'muted' : score.score >= 80 ? 'success' : score.score >= 60 ? 'warning' : 'destructive';
  const attendance = (classId?: string) => router.push(classId ? { pathname: '/teacher/attendance', params: { class: classId } } : '/teacher/attendance');

  const subjects = [...new Set(classes.map((c) => c.subject_name).filter(Boolean))].slice(0, 2).join(' & ');
  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
  const dateLine = now.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });

  const homeworkList = Array.isArray(hw.data) ? hw.data : (hw.data?.data ?? []);
  const toReview = homeworkList
    .filter((h) => h.is_published !== false && h.due_date && h.due_date.slice(0, 10) <= today)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .slice(0, 3);
  const nowMs = now.getTime();
  const upcomingExams = (exams.data ?? [])
    .filter((e) => !e.is_completed && !!e.exam_date && new Date(e.exam_date).getTime() > nowMs)
    .sort((a, b) => (a.exam_date ?? '').localeCompare(b.exam_date ?? ''))
    .slice(0, 3);
  const messages = (inbox.data ?? []).slice(0, 2);
  const roster = students.data ?? [];

  const refresh = () => {
    setNow(new Date());
    return Promise.all([schedule.mutate(), overview.mutate(), perf.mutate(), students.mutate(), hw.mutate(), inbox.mutate(), exams.mutate(), weather.mutate()]);
  };

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => open('/teacher/settings', 'settings')} accessibilityRole="button" accessibilityLabel={fullName}>
              <PersonAvatar url={profile.profile_photo_url} name={fullName} size={44} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {x('hello', { name: profile.first_name ?? '' })}
              </Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {[subjects, dateLine].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <RoundButton icon={Search} label={t('app.ad_search_modules')} onPress={() => go('/teacher/more')} />
            <RoundButton icon={Bell} label={t('app.pn_title')} onPress={() => go('/teacher/portal/notes')} />
          </View>

          {/* Attendance to mark */}
          {toMark.length ? (
            <View className="bg-warning-soft flex-row items-center gap-3 rounded-2xl p-3">
              <Icon as={AlertTriangle} className="text-warning size-5" />
              <View className="flex-1">
                <Text className="text-warning text-sm font-semibold" numberOfLines={1}>
                  {x('to_mark', { count: toMark.length })}
                </Text>
                <Text className="text-warning text-[11px]" numberOfLines={1}>
                  {`${toMark[0].subject} · ${toMark[0].section} · ${hm(toMark[0].start_time)}`}
                </Text>
              </View>
              <Pressable onPress={() => attendance(toMark[0].id)} className="overflow-hidden rounded-full" accessibilityRole="button">
                <BrandGradient variant="primary" style={{ paddingHorizontal: 18, paddingVertical: 9 }}>
                  <Text className="text-white text-xs font-semibold">{x('mark')}</Text>
                </BrandGradient>
              </Pressable>
            </View>
          ) : null}

          {/* Tiles */}
          <View className="flex-row gap-2.5">
            <StatTile label={k('todaysClasses')} value={String(classes.length)} note={x('done_remaining', { done: completed, remaining })} onPress={() => open('/teacher/timetable', 'my_timetable')} />
            <StatTile label={k('attendanceRate')} value={`${rate}%`} note={toMark.length ? `${k('pending')}: ${toMark.length}` : undefined} onPress={() => attendance(current?.id ?? next?.id)} />
            <StatTile
              label={k('myPerformance')}
              value={score ? String(score.score) : '—'}
              chip={score ? (score.score >= 80 ? k('excellent') : score.score >= 60 ? k('good') : k('needsImprovement')) : undefined}
              chipTone={scoreTone}
              note={score && (score.total_demerit > 0 || score.total_redemption > 0) ? `−${score.total_demerit} / +${score.total_redemption}` : undefined}
              onPress={() => open('/teacher/performance', 'performance_efficiency')}
            />
          </View>

          <AcademicPickers coursePeriod />

          {/* Teaching schedule */}
          <Section title={k('todaysSchedule')} action={k('fullTimetable')} onAction={() => open('/teacher/timetable', 'my_timetable')}>
            {classes.length ? (
              <Panel>
                {classes.map((c, i) => {
                  const live = c.status === 'in-progress';
                  const done = c.status === 'completed';
                  const [label, tone]: [string, ChipTone] = live
                    ? [k('now'), 'warning']
                    : done
                      ? c.marked
                        ? [k('marked'), 'success']
                        : [k('attendancePending'), 'destructive']
                      : c.id === next?.id
                        ? [x('next'), 'info']
                        : [k('periodLabel', { number: c.period_number }), 'muted'];
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => attendance(c.id)}
                      accessibilityRole="button"
                      className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', live && 'bg-info-soft/60', i < classes.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className="w-12">
                        <Text className="text-sm font-bold">{hm(c.start_time)}</Text>
                        <Text variant="muted" className="text-[11px]">
                          {hm(c.end_time)}
                        </Text>
                      </View>
                      <View className={cn('h-10 w-1 rounded-full', live ? 'bg-brand-accent' : done ? 'bg-muted' : 'bg-brand')} />
                      <View className="flex-1">
                        <Text className={cn('text-sm font-semibold', done && 'text-muted-foreground')} numberOfLines={1}>
                          {`${c.subject} · ${c.section}`}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[c.grade, c.room_number ? k('roomLabel', { room: c.room_number }) : null, c.att ? k('presentCount', { present: c.att.present + c.att.late, total: c.att.total, percentage: c.att.percentage }) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <StatusChip label={label} tone={tone} className="px-2 py-0.5" />
                    </Pressable>
                  );
                })}
              </Panel>
            ) : (
              <Panel className="items-center p-6">
                <Text variant="muted">{k('noClassesScheduled')}</Text>
                <Text variant="muted" className="text-sm">
                  {next ? k('nextClassAt', { subject: next.subject, time: hm(next.start_time) }) : k('noMoreClassesToday')}
                </Text>
              </Panel>
            )}
          </Section>

          {/* Class attendance overview */}
          {withAtt.length ? (
            <Section title={x('attendance_overview')}>
              <Panel className="gap-3 p-4">
                {withAtt.map((c) => {
                  const pct = Math.round(c.att?.percentage ?? 0);
                  const bar = pct >= 90 ? 'bg-brand-secondary' : pct >= 75 ? 'bg-brand-accent' : 'bg-destructive';
                  return (
                    <View key={c.id} className="flex-row items-center gap-3">
                      <Text className="w-14 text-xs font-semibold" numberOfLines={1}>
                        {c.section}
                      </Text>
                      <View className="bg-info-soft h-2 flex-1 overflow-hidden rounded-full">
                        <View className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(100, pct)}%` }} />
                      </View>
                      <Text className="w-10 text-end text-xs font-bold">{`${pct}%`}</Text>
                    </View>
                  );
                })}
              </Panel>
            </Section>
          ) : null}

          {/* Awaiting review */}
          {toReview.length ? (
            <Section title={x('awaiting_review')} action={t('app.sad_view_all')} onAction={() => go('/teacher/submissions')}>
              <Panel>
                {toReview.map((h, i) => (
                  <Pressable
                    key={h.id}
                    onPress={() => router.push({ pathname: '/teacher/submissions', params: { assignment: h.id } })}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < toReview.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="bg-info-soft size-9 items-center justify-center rounded-full">
                      <Icon as={FilePenLine} className="text-brand dark:text-brand-secondary size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {h.title}
                      </Text>
                      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                        {[h.section?.name, h.subject?.name, formatDate(h.due_date)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" />
                  </Pressable>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Upcoming assessments */}
          {upcomingExams.length ? (
            <Section title={x('assessments')} action={t('app.sad_view_all')} onAction={() => go('/teacher/exams')}>
              <Panel>
                {upcomingExams.map((e, i) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push({ pathname: '/teacher/exams/[id]', params: { id: e.id } })}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < upcomingExams.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className={cn('size-9 items-center justify-center rounded-xl', e.is_published ? 'bg-info-soft' : 'bg-warning-soft')}>
                      <Icon as={FileText} className={cn('size-4', e.is_published ? 'text-brand dark:text-brand-secondary' : 'text-warning')} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {[e.section?.name, e.exam_name].filter(Boolean).join(' ')}
                      </Text>
                      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                        {[e.exam_date ? formatDate(e.exam_date) : null, e.subject?.name, e.exam_type?.name].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <StatusChip label={e.is_published ? x('ready') : x('draft')} tone={e.is_published ? 'success' : 'warning'} className="px-2 py-0.5" />
                  </Pressable>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Class roster (selected course period) */}
          <Section title={x('roster')} action={cp ? k('takeAttendance') : undefined} onAction={() => router.push('/teacher/attendance/take-attendance')}>
            <Panel>
              {!cp ? (
                <View className="items-center p-6">
                  <Icon as={GraduationCap} className="text-muted-foreground mb-2 size-8" />
                  <Text className="text-muted-foreground font-medium">{k('noCoursePeriodSelected')}</Text>
                  <Text variant="muted" className="mt-1 text-center text-sm">
                    {t('app.te_pick_course_hint')}
                  </Text>
                </View>
              ) : students.isLoading ? (
                <View className="p-4">
                  <LoadingList rows={2} />
                </View>
              ) : !roster.length ? (
                <Text className="text-muted-foreground p-6 text-center text-sm">{k('noStudentsEnrolled')}</Text>
              ) : (
                <>
                  <Pressable onPress={() => setRosterOpen((v) => !v)} className="flex-row items-center gap-3 px-4 py-3" accessibilityRole="button" accessibilityState={{ expanded: rosterOpen }}>
                    <View className="flex-row">
                      {roster.slice(0, 5).map((s, i) => (
                        <View key={s.id} className={cn('border-card bg-success-soft size-9 items-center justify-center rounded-full border-2', i > 0 && '-ms-2.5')}>
                          <Text className="text-success text-[11px] font-bold">{initials(s.profile?.first_name, s.profile?.last_name)}</Text>
                        </View>
                      ))}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {cp.short_name || cp.title || k('coursePeriod')}
                      </Text>
                      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                        {[k('studentsCount', { count: roster.length }), cp.section?.name, cp.section?.grade_level?.name].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Icon as={rosterOpen ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
                  </Pressable>
                  {rosterOpen
                    ? roster.map((s, i) => (
                        <View key={s.id} className="border-info-soft dark:border-border flex-row items-center gap-3 border-t px-4 py-2.5">
                          <View className="bg-info-soft size-7 items-center justify-center rounded-full">
                            <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{String(i + 1)}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium" numberOfLines={1}>{`${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`}</Text>
                            <Text variant="muted" className="text-[11px]">
                              {s.student_number}
                            </Text>
                          </View>
                        </View>
                      ))
                    : null}
                </>
              )}
            </Panel>
          </Section>

          {/* Messages */}
          {messages.length ? (
            <Section title={x('messages')} action={t('app.sad_view_all')} onAction={() => open('/teacher/messaging', 'messaging')}>
              <Panel>
                {messages.map((m, i) => {
                  const [first, ...rest] = (m.sender_name || '').split(' ');
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => open('/teacher/messaging', 'messaging')}
                      className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < messages.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className="bg-success-soft size-9 items-center justify-center rounded-full">
                        <Text className="text-success text-[11px] font-bold">{initials(first, rest.pop())}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {m.sender_name}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {`${m.messages?.subject ?? ''} · ${m.messages?.created_at ? formatRelative(m.messages.created_at) : ''}`}
                        </Text>
                      </View>
                      {m.status === 'unread' ? <View className="bg-brand size-2 rounded-full" /> : null}
                    </Pressable>
                  );
                })}
              </Panel>
            </Section>
          ) : null}

          {/* Quick actions */}
          <Section title={k('quickActions')}>
            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                <QuickAction icon={CheckSquare} label={k('markAttendance')} onPress={() => attendance(current?.id ?? next?.id)} />
                <QuickAction icon={PenLine} label={x('gradebook')} onPress={() => go('/teacher/grades/gradebook')} />
                <QuickAction icon={ClipboardList} label={k('assignments')} onPress={() => open('/teacher/assignments', 'assignments')} />
              </View>
              <View className="flex-row gap-2.5">
                <QuickAction icon={NotebookPen} label={x('lesson_plans')} onPress={() => open('/teacher/lesson-plans', 'lesson_plans')} />
                <QuickAction icon={LayoutGrid} label={k('timetable')} onPress={() => open('/teacher/timetable', 'my_timetable')} />
                <QuickAction icon={BookOpen} label={k('mySubjects')} onPress={() => open('/teacher/subjects', 'subjects')} />
              </View>
            </View>
          </Section>

          <SetupAssistantPanel role="teacher" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={open} />

          {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

          <View className="items-center">
            <Text variant="muted" className="text-[11px]">{`${now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })} · ${now.toLocaleDateString(loc, { weekday: 'long' })}, ${formatDate(today)}`}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}
