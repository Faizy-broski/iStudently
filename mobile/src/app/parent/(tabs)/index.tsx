import { router, type Href } from 'expo-router';
import { Bell, Calendar, ChevronRight, ClipboardList, CreditCard, FileText, GraduationCap, Megaphone, MessageSquare, Receipt, Search, User, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { WeatherCard } from '@/features/dashboard/weather-card';
import { ChildSwitcher, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminWeather, parent, portal } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const go = (href: string) => router.push(href as Href);
const loc = () => (i18n.language === 'ar' ? 'ar' : 'en');
const weekdayLetter = (iso: string) => new Date(iso).toLocaleDateString(loc(), { weekday: 'narrow' });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' });

/** Attendance circle tones per status (P / A / L / E). */
const ATT: Record<string, { box: string; text: string; key: string }> = {
  present: { box: 'bg-success-soft', text: 'text-success', key: 'p' },
  absent: { box: 'bg-destructive-soft', text: 'text-destructive', key: 'a' },
  late: { box: 'bg-warning-soft', text: 'text-warning', key: 'l' },
  excused: { box: 'bg-info-soft', text: 'text-brand dark:text-brand-secondary', key: 'e' },
};

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

function StatTile({ label, value, note, chip, onPress }: { label: string; value: string; note?: string; chip?: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 gap-1 rounded-2xl border p-3 active:opacity-80" accessibilityRole="button">
      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-brand dark:text-foreground text-xl font-bold" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {chip ? <StatusChip label={chip} tone="success" className="self-start px-2 py-0.5" /> : note ? <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>{note}</Text> : null}
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
 * Parent dashboard (Figma parent home; web: /parent/dashboard) for the selected child: greeting, child
 * switcher, attendance / average / homework tiles, fee status, last 7 attendance days, recent grades,
 * upcoming exams, announcements, quick actions (messages, report card, fees, ID card), Setup Assistant and weather.
 */
export default function ParentDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pd_${key}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { children: kids, child, childId, isLoading, error, refresh } = useChild();
  const childCampus = child?.campus_id ?? null;
  const { campusId } = useCampus();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const { money } = usePortalCurrency();
  const ck = childId ?? '';
  const fees = useApi(childId ? ['parent', 'payment-history', ck] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  const feeStatus = useApi(childId ? ['parent', 'fee-status', ck] : null, ([, , id]) => parent.getFeeStatus(id as string));
  const history = useApi(childId ? ['parent', 'attendance-history', ck] : null, ([, , id]) => parent.getAttendanceHistory(id as string, 30));
  const gpa = useApi(childId ? ['parent', 'gpa-rank', ck] : null, ([, , id]) => parent.getGpaRank(id as string));
  const homework = useApi(childId ? ['parent', 'homework', ck] : null, ([, , id]) => parent.getHomework(id as string));
  const grades = useApi(childId ? ['parent', 'recent-grades', ck] : null, ([, , id]) => parent.getRecentGrades(id as string, 3));
  const exams = useApi(childId ? ['parent', 'upcoming-exams', ck] : null, ([, , id]) => parent.getUpcomingExams(id as string, 5));
  const notes = useApi(childCampus ? ['portal', 'notes', childCampus] : null, ([, , c]) => portal.notes(c as string));
  const weatherOn = plugins.includes('weather_alerts');
  const weather = useApi(weatherOn ? ['parent', 'weather', campusId ?? 'school'] : null, () => adminWeather.widget(campusId));
  const open = (href: string, title: string) => openPortalPage('parent', { href, title });

  if (isLoading) {
    return (
      <AuthBackground>
        <SafeAreaView edges={['top']} className="flex-1 gap-4 p-4">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </SafeAreaView>
      </AuthBackground>
    );
  }

  const onRefresh = () => {
    refresh();
    for (const q of [fees, feeStatus, history, gpa, homework, grades, exams, notes, weather]) q.mutate();
  };

  // Tiles.
  const records = [...(history.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const attendancePct = records.length ? Math.round((attended / records.length) * 100) : null;
  const g = gpa.data;
  const pendingHw = (homework.data ?? []).filter((h) => h.status === 'pending' || h.status === 'overdue').length;

  // Fees.
  const fs = feeStatus.data;
  const totalFees = (fees.data ?? []).reduce((s, f) => s + (f.final_amount || 0), 0);
  const paidFees = (fees.data ?? []).reduce((s, f) => s + (f.amount_paid || 0), 0);
  const paidPct = totalFees > 0 ? Math.min(100, (paidFees / totalFees) * 100) : 0;
  const overdue = (fs?.overdue_amount ?? 0) > 0;

  const last7 = records.slice(-7);
  const lastAbsence = [...records].reverse().find((r) => r.status === 'absent');
  const noteList = (notes.data ?? []).slice(0, 2);
  const parentName = profile?.first_name ?? '';

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => open('/parent/settings', 'settings')} accessibilityRole="button">
              <PersonAvatar url={profile?.profile_photo_url} name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`} size={44} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {k('hello', { name: parentName })}
              </Text>
              <Text variant="muted" className="text-xs">
                {k('children_n', { count: kids.length })}
              </Text>
            </View>
            <RoundButton icon={Search} label={t('app.ad_search_modules')} onPress={() => go('/parent/more')} />
            <RoundButton icon={Bell} label={t('app.pn_title')} onPress={() => go('/parent/portal/notes')} />
          </View>

          {error ? <Text className="text-destructive">{k('failed', { message: error.message })}</Text> : null}

          <ChildSwitcher />

          {!child && kids.length === 0 ? (
            <Panel className="items-center p-8">
              <Icon as={User} className="text-muted-foreground mb-3 size-14" />
              <Text className="mb-1 text-lg font-semibold">{k('no_students')}</Text>
              <EmptyState title={k('no_students_body')} />
            </Panel>
          ) : null}

          <SetupAssistantPanel role="parent" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={open} />

          {child ? (
            <>
              {/* Attendance · average · homework */}
              <View className="flex-row gap-2.5">
                <StatTile label={k('attendance')} value={attendancePct !== null ? `${attendancePct}%` : '—'} note={k('last_30')} onPress={() => open('/parent/attendance', 'attendance')} />
                <StatTile
                  label={k('average')}
                  value={g?.percentage != null ? `${Math.round(g.percentage * 10) / 10}` : '—'}
                  chip={g?.grade || undefined}
                  note={g?.rank && g.total_students ? k('rank_of', { rank: g.rank, total: g.total_students }) : undefined}
                  onPress={() => open('/parent/academics', 'academics')}
                />
                <StatTile label={k('homework')} value={String(pendingHw)} note={k('pending')} onPress={() => open('/parent/homework', 'homework')} />
              </View>

              {/* Fees */}
              <Section title={k('fees')}>
                <Panel className="overflow-hidden">
                  <Pressable onPress={() => open('/parent/fees', 'fees')} className={cn('flex-row items-center gap-3 p-4', overdue ? 'bg-destructive-soft' : 'bg-warning-soft')} accessibilityRole="button">
                    <View className="bg-card size-10 items-center justify-center rounded-xl">
                      <Icon as={Receipt} className={cn('size-5', overdue ? 'text-destructive' : 'text-warning')} />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-[11px] font-medium', overdue ? 'text-destructive' : 'text-warning')} numberOfLines={1}>
                        {overdue ? k('overdue_amount', { amount: money(fs?.overdue_amount ?? 0) }) : fs?.next_due_date ? k('next_due', { date: formatDate(fs.next_due_date) }) : k('total_due')}
                      </Text>
                      <Text className="text-xl font-bold" numberOfLines={1} adjustsFontSizeToFit>
                        {feeStatus.isLoading ? '…' : money(fs?.total_due ?? 0)}
                      </Text>
                    </View>
                    <View className="overflow-hidden rounded-full">
                      <BrandGradient variant="primary" style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                        <Text className="text-white text-xs font-semibold">{k('view_fees')}</Text>
                      </BrandGradient>
                    </View>
                  </Pressable>
                  <View className="gap-2 p-4">
                    <View className="flex-row items-center justify-between">
                      <Text variant="muted" className="text-xs">
                        {k('fees_paid')}
                      </Text>
                      <Text className="text-xs font-semibold">{`${money(paidFees)} / ${money(totalFees)}`}</Text>
                    </View>
                    <View className="bg-info-soft h-2 overflow-hidden rounded-full">
                      <View className="bg-success h-full rounded-full" style={{ width: `${paidPct}%` }} />
                    </View>
                    {fs?.unpaid_invoices ? (
                      <Text variant="muted" className="text-[11px]">
                        {k('unpaid_n', { count: fs.unpaid_invoices })}
                      </Text>
                    ) : null}
                  </View>
                </Panel>
              </Section>

              {/* Recent attendance */}
              <Section title={k('recent_attendance')} action={t('app.sad_view_all')} onAction={() => open('/parent/attendance', 'attendance')}>
                <Panel className="gap-3 p-4">
                  {last7.length ? (
                    <View className="flex-row justify-between">
                      {last7.map((r) => {
                        const tone = ATT[r.status] ?? ATT.excused;
                        return (
                          <View key={r.date} className="items-center gap-1">
                            <View className={cn('size-9 items-center justify-center rounded-full', tone.box)}>
                              <Text className={cn('text-xs font-bold', tone.text)}>{k(`att_${tone.key}`)}</Text>
                            </View>
                            <Text variant="muted" className="text-[11px]">
                              {weekdayLetter(r.date)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text variant="muted" className="text-sm">
                      {k('no_attendance')}
                    </Text>
                  )}
                  {lastAbsence ? (
                    <View className="border-info-soft dark:border-border border-t pt-3">
                      <Text variant="muted" className="text-xs">
                        {k('absent_on', { date: shortDay(lastAbsence.date) })}
                      </Text>
                    </View>
                  ) : null}
                </Panel>
              </Section>

              {/* Recent grades */}
              {(grades.data ?? []).length ? (
                <Section title={k('recent_grades')} action={k('report_card')} onAction={() => go('/parent/grades/report-cards')}>
                  <Panel>
                    {(grades.data ?? []).map((r, i, arr) => (
                      <View key={`${r.subject}:${r.date}:${i}`} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                        <View className="bg-info-soft size-9 items-center justify-center rounded-full">
                          <Icon as={GraduationCap} className="text-brand dark:text-brand-secondary size-4" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" numberOfLines={1}>
                            {r.subject}
                          </Text>
                          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                            {[r.exam_name || r.exam_type, r.date ? formatDate(r.date) : null].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sm font-bold">{r.grade}</Text>
                          <Text variant="muted" className="text-[11px]">{`${Math.round(r.percentage)}%`}</Text>
                        </View>
                      </View>
                    ))}
                  </Panel>
                </Section>
              ) : null}

              {/* Upcoming assessments */}
              {(exams.data ?? []).length ? (
                <Section title={k('upcoming')}>
                  <Panel>
                    {(exams.data ?? []).map((e, i, arr) => {
                      const soon = e.days_until <= 1;
                      const tone: ChipTone = soon ? 'warning' : 'info';
                      return (
                        <View key={e.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                          <View className={cn('size-9 items-center justify-center rounded-xl', soon ? 'bg-warning-soft' : 'bg-info-soft')}>
                            <Icon as={FileText} className={cn('size-4', soon ? 'text-warning' : 'text-brand dark:text-brand-secondary')} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold" numberOfLines={1}>
                              {e.exam_name}
                            </Text>
                            <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                              {[shortDay(e.date), e.subject, e.time].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <StatusChip label={e.days_until <= 0 ? k('today') : e.days_until === 1 ? k('tomorrow') : k('in_days', { count: e.days_until })} tone={tone} className="px-2 py-0.5" />
                        </View>
                      );
                    })}
                  </Panel>
                </Section>
              ) : null}

              {/* Announcements */}
              {noteList.length ? (
                <Section title={t('app.pn_title')} action={t('app.sad_view_all')} onAction={() => go('/parent/portal/notes')}>
                  <Panel>
                    {noteList.map((n, i) => (
                      <Pressable
                        key={n.id}
                        onPress={() => go('/parent/portal/notes')}
                        className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < noteList.length - 1 && 'border-info-soft dark:border-border border-b')}>
                        <View className={cn('size-9 items-center justify-center rounded-full', i === 0 ? 'bg-info-soft' : 'bg-warning-soft')}>
                          <Icon as={i === 0 ? Megaphone : Calendar} className={cn('size-4', i === 0 ? 'text-brand dark:text-brand-secondary' : 'text-warning')} />
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
              <Section title={t('app.sd_quick_actions')}>
                <View className="flex-row gap-2.5">
                  <QuickAction icon={MessageSquare} label={k('qa_message')} onPress={() => open('/parent/messaging/write', 'messaging')} />
                  <QuickAction icon={ClipboardList} label={k('qa_reports')} onPress={() => go('/parent/grades/report-cards')} />
                  <QuickAction icon={Receipt} label={k('qa_fees')} onPress={() => open('/parent/fees', 'fees')} />
                  <QuickAction icon={CreditCard} label={k('id_card')} onPress={() => open('/parent/id-card', 'id_card')} />
                </View>
              </Section>
            </>
          ) : null}

          {weatherOn ? <WeatherCard data={weather.data} loading={weather.isLoading} failed={!!weather.error} /> : null}
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}
