import { ArrowRight, BarChart3, BookOpen, Calendar, CheckCircle, ClipboardList, Clock, GraduationCap, LayoutGrid, MapPin, Play, SkipForward, TrendingDown, TrendingUp, UserCheck, Users, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { usePortalAcademic } from '@/features/portal/academic';
import { AcademicPickers } from '@/features/portal/academic-pickers';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminPerformance, adminTimetable, adminWeather, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

type Status = 'completed' | 'in-progress' | 'upcoming';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (v?: string | null) => (v ? v.slice(0, 5) : '');

/** Today's classes with attendance state, performance score, the selected course period's roster (web: /teacher/dashboard). */
export default function TeacherDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.dashboard.${key}`, o);
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
  const today = ymd(now);

  const schedule = useApi(staffId ? ['teacher', 'schedule', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherSchedule(s as string, d as string));
  const overview = useApi(staffId ? ['teacher', 'attendance-overview', staffId, today] : null, ([, , s, d]) => adminTimetable.teacherAttendanceOverview(s as string, d as string));
  const perf = useApi(staffId ? ['teacher', 'my-score'] : null, () => adminPerformance.myScore());
  const students = useApi(cpId ? ['teacher', 'cp-students', cpId] : null, ([, , c]) => teacher.myCoursePeriodStudents(c as string));
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
  const stats = {
    today: classes.length,
    rate: totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0,
    pending: Math.max(0, completed - withAtt.length),
    remaining: classes.filter((c) => c.status === 'upcoming').length,
  };
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const score = perf.data;
  const scoreTone = !score ? '' : score.score >= 80 ? 'text-green-600' : score.score >= 60 ? 'text-amber-600' : 'text-red-600';
  const attendance = (classId?: string) => router.push(classId ? { pathname: '/teacher/attendance', params: { class: classId } } : '/teacher/attendance');

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            setNow(new Date());
            return Promise.all([schedule.mutate(), overview.mutate(), perf.mutate(), students.mutate(), weather.mutate()]);
          }}
        />
      }>
      <View className="flex-row items-center gap-3">
        <PersonAvatar url={profile.profile_photo_url} name={`${profile.first_name ?? ''} ${profile.last_name ?? ''}`} size={56} />
        <View className="flex-1">
          <Text className="text-xl font-bold text-[#022172] dark:text-white">{k('pageTitle')}</Text>
          <Text className="text-muted-foreground text-sm">{k('welcomeBack', { name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() })}</Text>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold text-[#022172] dark:text-white">{now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text className="text-muted-foreground text-xs">{`${now.toLocaleDateString(loc, { weekday: 'long' })}, ${formatDate(today)}`}</Text>
        </View>
      </View>

      <AcademicPickers coursePeriod />

      <View className="flex-row flex-wrap gap-2">
        <Stat icon={Calendar} tone="blue" value={String(stats.today)} label={k('todaysClasses')} />
        <Stat icon={UserCheck} tone="green" value={`${stats.rate}%`} label={k('attendanceRate')} />
        <Stat icon={ClipboardList} tone="orange" value={String(stats.pending)} label={k('pending')} />
        <Stat icon={Clock} tone="purple" value={String(stats.remaining)} label={k('remaining')} />
      </View>

      {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}

      {score ? (
        <Card className="border-[#022172]/20">
          <CardContent className="gap-3 p-4">
            <View className="flex-row items-center gap-4">
              <View className="size-16 items-center justify-center">
                <Svg width={64} height={64} viewBox="0 0 100 100" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={50} cy={50} r={40} fill="none" stroke="#e5e7eb" strokeWidth={14} />
                  <Circle
                    cx={50}
                    cy={50}
                    r={40}
                    fill="none"
                    stroke={score.score >= 80 ? '#16a34a' : score.score >= 60 ? '#d97706' : '#dc2626'}
                    strokeWidth={14}
                    strokeDasharray={`${(score.score / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text className="text-sm font-bold">{String(score.score)}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Icon as={BarChart3} className="size-4 text-[#022172] dark:text-blue-400" />
                  <Text className="font-semibold text-[#022172] dark:text-white">{k('myPerformance')}</Text>
                </View>
                <Text className={cn('text-sm font-medium', scoreTone)}>{score.score >= 80 ? k('excellent') : score.score >= 60 ? k('good') : k('needsImprovement')}</Text>
                <View className="flex-row gap-3">
                  {score.total_demerit > 0 ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={TrendingDown} className="size-3 text-red-500" />
                      <Text className="text-xs text-red-500">{k('ptsNegative', { points: score.total_demerit })}</Text>
                    </View>
                  ) : null}
                  {score.total_redemption > 0 ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={TrendingUp} className="size-3 text-green-500" />
                      <Text className="text-xs text-green-500">{k('ptsPositive', { points: score.total_redemption })}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <Button variant="outline" size="sm" className="self-start" onPress={() => open('/teacher/performance', 'performance_efficiency')}>
              <Text>{k('viewDetails')}</Text>
              <Icon as={ArrowRight} className="size-4 rtl:rotate-180" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#022172]/20">
        <CardHeader className="gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Icon as={Users} className="size-5 text-[#022172] dark:text-blue-400" />
            <CardTitle className="text-[#022172] dark:text-white">{cp ? cp.short_name || cp.title || k('coursePeriod') : k('coursePeriod')}</CardTitle>
            {cp && students.data ? (
              <Badge variant="secondary">
                <Text>{k('studentsCount', { count: students.data.length })}</Text>
              </Badge>
            ) : null}
          </View>
          {cp?.course?.title && cp.course.title !== (cp.short_name || cp.title) ? <Text className="text-muted-foreground text-sm">{cp.course.title}</Text> : null}
          {cp?.section?.name ? <Text className="text-muted-foreground text-sm">{`${cp.section.name}${cp.section.grade_level?.name ? ` — ${cp.section.grade_level.name}` : ''}`}</Text> : null}
          {cp ? (
            <Button variant="outline" size="sm" className="mt-1 self-start" onPress={() => router.push('/teacher/attendance/take-attendance')}>
              <Icon as={UserCheck} className="size-4" />
              <Text>{k('takeAttendance')}</Text>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!cp ? (
            <View className="items-center py-8">
              <Icon as={GraduationCap} className="text-muted-foreground/40 mb-2 size-10" />
              <Text className="text-muted-foreground font-medium">{k('noCoursePeriodSelected')}</Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">{t('app.te_pick_course_hint')}</Text>
            </View>
          ) : students.isLoading ? (
            <LoadingList rows={3} />
          ) : !students.data?.length ? (
            <Text className="text-muted-foreground py-8 text-center text-sm">{k('noStudentsEnrolled')}</Text>
          ) : (
            <View className="border-border rounded-lg border">
              {students.data.map((s, i) => (
                <View key={s.id} className="border-border flex-row items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                  <View className="size-7 items-center justify-center rounded-full bg-[#022172]/10">
                    <Text className="text-xs font-semibold text-[#022172] dark:text-blue-300">{String(i + 1)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium" numberOfLines={1}>{`${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`}</Text>
                    <Text className="text-muted-foreground text-xs">{s.student_number}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      {current ? (
        <Card className="overflow-hidden border-2 border-green-500">
          <CardHeader className="flex-row items-center justify-between bg-green-50 dark:bg-green-950/30">
            <View className="flex-row items-center gap-2">
              <Icon as={Play} className="size-5 text-green-600" />
              <CardTitle>{k('currentClass')}</CardTitle>
            </View>
            <Badge className="bg-green-600">
              <Text className="text-white">{`● ${k('inProgress')}`}</Text>
            </Badge>
          </CardHeader>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="text-2xl font-bold text-[#022172] dark:text-white">{current.subject}</Text>
              <Text className="text-muted-foreground">{`${current.section} • ${current.grade}`}</Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Icon as={Clock} className="text-muted-foreground size-4" />
                <Text className="text-sm font-medium">{`${hm(current.start_time)} – ${hm(current.end_time)}`}</Text>
              </View>
              <Badge variant="outline">
                <Text>{k('periodLabel', { number: current.period_number })}</Text>
              </Badge>
              {current.room_number ? (
                <View className="flex-row items-center gap-1">
                  <Icon as={MapPin} className="text-muted-foreground size-4" />
                  <Text className="text-sm">{k('roomLabel', { room: current.room_number })}</Text>
                </View>
              ) : null}
            </View>
            <Button className="bg-green-600" onPress={() => attendance(current.id)}>
              <Icon as={UserCheck} className="size-5 text-white" />
              <Text className="text-white">{k('markAttendance')}</Text>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="items-center gap-1 p-4">
            <Text className="text-muted-foreground">{k('noClassInProgress')}</Text>
            <Text className="text-muted-foreground text-sm">{next ? k('nextClassAt', { subject: next.subject, time: hm(next.start_time) }) : k('noMoreClassesToday')}</Text>
          </CardContent>
        </Card>
      )}

      {next && current ? (
        <Card className="border-blue-200">
          <CardContent className="flex-row items-center gap-3 p-4">
            <View className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Icon as={SkipForward} className="size-5 text-blue-600" />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground text-sm">{k('nextClass')}</Text>
              <Text className="text-lg font-bold">{next.subject}</Text>
              <Text className="text-muted-foreground text-sm">{k('sectionStartsAt', { section: next.section, time: hm(next.start_time) })}</Text>
            </View>
            <Badge variant="outline">
              <Text>{k('periodLabel', { number: next.period_number })}</Text>
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Icon as={Calendar} className="size-5" />
            <CardTitle>{k('todaysSchedule')}</CardTitle>
          </View>
          <Button variant="outline" size="sm" onPress={() => open('/teacher/timetable', 'my_timetable')}>
            <Text>{k('fullTimetable')}</Text>
          </Button>
        </CardHeader>
        <CardContent className="gap-2">
          {!classes.length ? (
            <Text className="text-muted-foreground py-6 text-center">{k('noClassesScheduled')}</Text>
          ) : (
            classes.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => attendance(c.id)}
                accessibilityRole="button"
                className={cn(
                  'flex-row items-center gap-3 rounded-lg border-2 p-3',
                  c.status === 'in-progress' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : c.status === 'completed' ? (c.marked ? 'border-border bg-muted/40' : 'border-orange-300 bg-orange-50 dark:bg-orange-950/20') : 'border-blue-200',
                )}>
                <View className={cn('size-12 items-center justify-center rounded-lg', c.status === 'in-progress' ? 'bg-green-600' : c.status === 'completed' ? 'bg-gray-500' : 'bg-blue-600')}>
                  <Text className="text-xs text-white">P</Text>
                  <Text className="text-lg font-bold text-white">{String(c.period_number)}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Text className="font-semibold">{c.subject}</Text>
                    {c.status === 'in-progress' ? (
                      <Badge className="bg-green-600">
                        <Text className="text-xs text-white">{`● ${k('now')}`}</Text>
                      </Badge>
                    ) : null}
                    {c.status === 'completed' && !c.marked ? (
                      <Badge variant="outline" className="border-orange-500">
                        <Text className="text-xs text-orange-600">{k('attendancePending')}</Text>
                      </Badge>
                    ) : null}
                    {c.marked ? (
                      <Badge variant="outline" className="border-green-500">
                        <Text className="text-xs text-green-600">{k('marked')}</Text>
                      </Badge>
                    ) : null}
                  </View>
                  <Text className="text-muted-foreground text-sm">{`${c.section} • ${c.grade}`}</Text>
                  {c.att ? <Text className="text-xs text-green-600">{k('presentCount', { present: c.att.present + c.att.late, total: c.att.total, percentage: c.att.percentage })}</Text> : null}
                </View>
                <View className="items-end">
                  <Text className="text-sm font-medium">{`${hm(c.start_time)} – ${hm(c.end_time)}`}</Text>
                  {c.room_number ? <Text className="text-muted-foreground text-xs">{k('roomLabel', { room: c.room_number })}</Text> : null}
                </View>
              </Pressable>
            ))
          )}
        </CardContent>
      </Card>

      <SetupAssistantPanel role="teacher" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={open} />

      <Card>
        <CardHeader>
          <CardTitle>{k('quickActions')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-row flex-wrap gap-2">
          <Quick icon={CheckCircle} label={k('markAttendance')} onPress={() => attendance(current?.id ?? next?.id)} />
          <Quick icon={LayoutGrid} label={k('timetable')} onPress={() => open('/teacher/timetable', 'my_timetable')} />
          <Quick icon={BookOpen} label={k('mySubjects')} onPress={() => open('/teacher/subjects', 'subjects')} />
          <Quick icon={ClipboardList} label={k('assignments')} onPress={() => open('/teacher/assignments', 'assignments')} />
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const TONES = {
  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 text-blue-700',
  green: 'bg-green-50 border-green-200 dark:bg-green-950/30 text-green-700',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 text-orange-700',
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 text-purple-700',
};

function Stat({ icon, tone, value, label }: { icon: LucideIcon; tone: keyof typeof TONES; value: string; label: string }) {
  const text = TONES[tone].split(' ')[3];
  return (
    <View className={cn('min-w-[45%] flex-1 flex-row items-center gap-3 rounded-xl border p-3', TONES[tone])}>
      <Icon as={icon} className={cn('size-6', text)} />
      <View>
        <Text className={cn('text-2xl font-bold', text)}>{value}</Text>
        <Text className={cn('text-xs', text)}>{label}</Text>
      </View>
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Button variant="outline" className="h-auto min-w-[45%] flex-1 flex-col gap-1 py-3" onPress={onPress}>
      <Icon as={icon} className="size-5" />
      <Text className="text-sm">{label}</Text>
    </Button>
  );
}
