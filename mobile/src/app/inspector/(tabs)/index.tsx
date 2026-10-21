import { router, type Href } from 'expo-router';
import { AlertTriangle, Bell, Building2, ChevronRight, ClipboardCheck, Eye, FilePenLine, FileText, LogIn, Plus, Search, UsersRound, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ScoreHeatmap } from '@/features/admin/inspections-ui';
import { useSession } from '@/features/auth/session';
import { inspector } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const go = (href: string) => router.push(href as Href);
const loc = () => (i18n.language === 'ar' ? 'ar' : 'en');
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (v?: string | null) => (v ? v.slice(0, 5) : '');
const initials = (a?: string | null, b?: string | null) => `${(a ?? '').charAt(0)}${(b ?? '').charAt(0)}`.toUpperCase() || '?';
const OPEN = ['scheduled', 'confirmed', 'in_progress', 'rescheduled'];

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

function StatTile({ label, value, note, onPress }: { label: string; value: string; note?: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 gap-1 rounded-2xl border p-3 active:opacity-80" accessibilityRole={onPress ? 'button' : undefined}>
      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-brand dark:text-foreground text-xl font-bold">{value}</Text>
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
 * Inspector home (Figma inspector dashboard; web: /inspector/dashboard): today's (or the next) visit with
 * check-in and observation progress, visit / score / appeal figures, visit schedule, teachers awaiting
 * observation, average score by rubric category, the score heatmap, reports to sign, assigned campuses
 * and quick actions.
 */
export default function InspectorDashboard() {
  const { t } = useTranslation();
  const d = (key: string) => t(`inspections.dashboard.${key}`);
  const v = (key: string) => t(`inspections.visits.${key}`);
  const k = (key: string, o?: Record<string, unknown>) => t(`app.idb_${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || t('app.role_inspector');
  const stats = useApi(['inspector', 'dashboard'], () => inspector.dashboard());
  const schools = useApi(['inspector', 'schools'], () => inspector.mySchools());
  // Same keys as the visits, visit, report and reports screens (shared cache).
  const visits = useApi(['inspector', 'visits'], () => inspector.myVisits());
  const reports = useApi(['inspector', 'reports'], () => inspector.myReports());
  const today = ymd(new Date());
  const open = (visits.data ?? []).filter((x) => OPEN.includes(x.status)).sort((a, b) => `${a.scheduled_date}${a.scheduled_start_time ?? ''}`.localeCompare(`${b.scheduled_date}${b.scheduled_start_time ?? ''}`));
  const focus = open.find((x) => x.status === 'in_progress') ?? open.find((x) => x.scheduled_date.slice(0, 10) >= today) ?? null;
  const focusId = focus?.id ?? null;
  const detail = useApi(focusId ? ['inspector', 'visit', focusId] : null, ([, , id]) => inspector.visit(id as string));
  const evals = useApi(focusId ? ['inspector', 'visit-evaluations', focusId] : null, ([, , id]) => inspector.evaluationsForVisit(id as string));
  const [checking, setChecking] = useState(false);
  const c = useColors();
  const s = stats.data;

  const refresh = () => Promise.all([stats.mutate(), schools.mutate(), visits.mutate(), reports.mutate(), detail.mutate(), evals.mutate()]);

  async function checkIn(id: string) {
    setChecking(true);
    const r = await inspector.checkIn(id);
    setChecking(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(v('msg_checked_in'));
    visits.mutate();
    detail.mutate();
  }

  const isToday = focus?.scheduled_date.slice(0, 10) === today;
  const teachers = detail.data?.teachers ?? [];
  const submitted = new Set((evals.data ?? []).filter((e) => e.status !== 'draft').map((e) => e.teacher.id));
  const done = teachers.filter((x) => submitted.has(x.teacher_profile_id)).length;
  const awaiting = teachers.filter((x) => !submitted.has(x.teacher_profile_id));
  const schedule = open.filter((x) => x.id !== focusId).slice(0, 3);
  const toSign = (reports.data ?? []).filter((r) => r.status === 'pending_signatures').slice(0, 2);
  const typeLabel = (type?: string | null) => (type ? t(`inspections.visits.visit_type_${type}`, { defaultValue: type }) : '');
  const timeRange = (a?: string | null, b?: string | null) => (a ? `${hm(a)}${b ? `–${hm(b)}` : ''}` : '');
  const openVisit = (id: string) => router.push({ pathname: '/inspector/visits/[id]', params: { id } });
  const observe = (id: string, teacher?: string) => router.push({ pathname: '/inspector/visits/[id]/observe', params: teacher ? { id, teacher } : { id } });

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <PersonAvatar url={profile?.profile_photo_url ?? null} name={fullName} size={44} />
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {fullName}
              </Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {[t('app.role_inspector'), schools.data ? k('campuses_n', { count: schools.data.length }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <RoundButton icon={Search} label={t('app.ad_search_modules')} onPress={() => go('/inspector/more')} />
            <RoundButton icon={Bell} label={k('community')} onPress={() => go('/inspector/community')} />
          </View>

          {/* Today's / next visit */}
          {focus ? (
            <Pressable onPress={() => openVisit(focus.id)} accessibilityRole="button">
              <BrandGradient variant="primary" angle={150} style={{ borderRadius: 24 }}>
                <View className="gap-3 p-5">
                  <Text className="text-white text-xs opacity-80">{`${isToday ? k('today_visit') : k('next_visit', { date: formatDate(focus.scheduled_date) })}${focus.scheduled_start_time ? ` · ${timeRange(focus.scheduled_start_time, focus.scheduled_end_time)}` : ''}`}</Text>
                  <Text className="text-white text-xl font-bold" numberOfLines={2}>
                    {focus.school?.name || focus.school_id}
                  </Text>
                  <Text className="text-white text-xs opacity-80" numberOfLines={1}>
                    {[typeLabel(focus.visit_type), v(`status_${focus.status}`), focus.purpose].filter(Boolean).join(' · ')}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1 gap-1.5">
                      <View className="bg-overlay-light h-1.5 overflow-hidden rounded-full">
                        <View className="bg-white h-full rounded-full" style={{ width: `${teachers.length ? (done / teachers.length) * 100 : 0}%` }} />
                      </View>
                      <Text className="text-white text-[11px] opacity-80">{teachers.length ? k('obs_progress', { done, total: teachers.length }) : k('no_teachers')}</Text>
                    </View>
                    {focus.status === 'in_progress' ? (
                      <Pressable onPress={() => observe(focus.id)} className="overflow-hidden rounded-full" accessibilityRole="button">
                        <BrandGradient variant="gold" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
                          <Icon as={Eye} className="text-white size-4" />
                          <Text className="text-white text-xs font-semibold">{v('btn_observe')}</Text>
                        </BrandGradient>
                      </Pressable>
                    ) : isToday ? (
                      <Pressable onPress={() => checkIn(focus.id)} disabled={checking} className="overflow-hidden rounded-full" accessibilityRole="button">
                        <BrandGradient variant="gold" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
                          {checking ? <ActivityIndicator size="small" color={c.white} /> : <Icon as={LogIn} className="text-white size-4" />}
                          <Text className="text-white text-xs font-semibold">{v('btn_check_in')}</Text>
                        </BrandGradient>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </BrandGradient>
            </Pressable>
          ) : null}

          {/* Figures */}
          {stats.isLoading ? (
            <LoadingList rows={2} />
          ) : s ? (
            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                <StatTile label={d('stat_visits_scheduled')} value={String(s.visitsScheduled)} onPress={() => go('/inspector/visits')} />
                <StatTile label={d('stat_visits_completed')} value={String(s.visitsCompleted)} onPress={() => go('/inspector/visits')} />
              </View>
              <View className="flex-row gap-2.5">
                <StatTile label={d('stat_avg_score')} value={s.avgOverallScore != null ? `${Math.round(s.avgOverallScore * 10) / 10}%` : '—'} />
                <StatTile label={d('stat_open_appeals')} value={String(s.openAppealsCount)} />
              </View>
            </View>
          ) : null}

          {/* Visit schedule */}
          <Section title={k('schedule')} action={k('all_visits')} onAction={() => go('/inspector/visits')}>
            {visits.isLoading ? (
              <LoadingList rows={2} />
            ) : schedule.length ? (
              <Panel>
                {schedule.map((x, i) => {
                  const date = new Date(x.scheduled_date);
                  return (
                    <Pressable
                      key={x.id}
                      onPress={() => openVisit(x.id)}
                      className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < schedule.length - 1 && 'border-info-soft dark:border-border border-b')}>
                      <View className="bg-info-soft w-12 items-center rounded-xl py-1.5">
                        <Text className="text-brand dark:text-brand-secondary text-[10px] font-semibold">{date.toLocaleDateString(loc(), { weekday: 'short' })}</Text>
                        <Text className="text-brand dark:text-foreground text-base font-bold">{date.getDate()}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {x.school?.name || x.school_id}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[typeLabel(x.visit_type), timeRange(x.scheduled_start_time, x.scheduled_end_time), v(`status_${x.status}`)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" />
                    </Pressable>
                  );
                })}
              </Panel>
            ) : (
              <Panel className="items-center p-5">
                <Text variant="muted" className="text-sm">
                  {focus ? k('no_more_visits') : v('no_visits')}
                </Text>
              </Panel>
            )}
          </Section>

          {/* Awaiting observation (focus visit) */}
          {focus && awaiting.length ? (
            <Section title={k('awaiting')}>
              <Panel>
                {awaiting.map((x, i) => (
                  <Pressable
                    key={x.id}
                    onPress={() => (focus.status === 'in_progress' ? observe(focus.id, x.teacher_profile_id) : openVisit(focus.id))}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < awaiting.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="bg-info-soft size-9 items-center justify-center rounded-full">
                      <Text className="text-brand dark:text-brand-secondary text-[11px] font-bold">{initials(x.teacher?.first_name, x.teacher?.last_name)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {x.teacher ? `${x.teacher.first_name} ${x.teacher.last_name}` : x.teacher_profile_id}
                      </Text>
                      {x.subject?.name ? (
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {x.subject.name}
                        </Text>
                      ) : null}
                    </View>
                    <StatusChip label={i === 0 ? k('next') : k('scheduled')} tone={i === 0 ? 'info' : 'success'} className="px-2 py-0.5" />
                  </Pressable>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Average score by rubric category */}
          {s?.avgScoreByCategory.length ? (
            <Section title={d('chart_title')}>
              <Panel className="gap-3 p-4">
                {s.avgScoreByCategory.map((c) => (
                  <View key={c.category} className="flex-row items-center gap-3">
                    <Text className="w-28 text-xs" numberOfLines={1}>
                      {c.category}
                    </Text>
                    <View className="bg-info-soft h-2 flex-1 overflow-hidden rounded-full">
                      <View className="bg-brand-secondary h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, c.avgScore))}%` }} />
                    </View>
                    <Text className="w-10 text-end text-xs font-bold">{`${Math.round(c.avgScore)}%`}</Text>
                  </View>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Heatmap */}
          {s ? (
            <Section title={d('heatmap_title')}>
              <Panel className="gap-2 p-4">
                <Text variant="muted" className="text-xs">
                  {d('heatmap_desc_inspector')}
                </Text>
                <ScoreHeatmap rows={s.heatmap} emptyLabel={d('heatmap_empty')} />
              </Panel>
            </Section>
          ) : null}

          {/* Reports to sign */}
          {toSign.length ? (
            <Section title={k('to_sign')} action={t('app.sad_view_all')} onAction={() => go('/inspector/reports')}>
              <Panel>
                {toSign.map((r, i) => (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push({ pathname: '/inspector/reports/[id]', params: { id: r.id } })}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < toSign.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="bg-warning-soft size-9 items-center justify-center rounded-xl">
                      <Icon as={FilePenLine} className="text-warning size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {[r.school?.name, r.teacher ? `${r.teacher.first_name} ${r.teacher.last_name}` : null].filter(Boolean).join(' · ')}
                      </Text>
                      <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                        {`${k('awaiting_signatures')} · ${formatDate(r.generated_at ?? r.created_at)}`}
                      </Text>
                    </View>
                    <StatusChip label={k('sign')} tone="warning" className="px-2 py-0.5" />
                  </Pressable>
                ))}
              </Panel>
            </Section>
          ) : null}

          {/* Assigned campuses */}
          <Section title={t('app.in_assigned_campuses')}>
            <Panel className="p-4">
              {schools.isLoading ? (
                <Text variant="muted" className="text-sm">
                  {t('app.in_loading_campuses')}
                </Text>
              ) : schools.error ? (
                <View className="flex-row items-center gap-2">
                  <Icon as={AlertTriangle} className="text-destructive size-4" />
                  <Text className="text-destructive text-sm">{schools.error.message}</Text>
                </View>
              ) : !(schools.data ?? []).length ? (
                <Text variant="muted" className="text-sm">
                  {t('app.in_no_campuses')}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {(schools.data ?? []).map((sc) => (
                    <View key={sc.id} className="bg-info-soft flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
                      <Icon as={Building2} className="text-brand dark:text-brand-secondary size-3.5" />
                      <Text className="text-xs font-medium">{sc.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Panel>
          </Section>

          {/* Quick actions */}
          <Section title={t('app.sd_quick_actions')}>
            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                <QuickAction icon={LogIn} label={v('btn_check_in')} onPress={() => (focus ? openVisit(focus.id) : go('/inspector/visits'))} />
                <QuickAction icon={Eye} label={v('btn_observe')} onPress={() => (focus ? observe(focus.id) : go('/inspector/visits'))} />
                <QuickAction icon={FileText} label={k('reports')} onPress={() => go('/inspector/reports')} />
              </View>
              <View className="flex-row gap-2.5">
                <QuickAction icon={UsersRound} label={k('community')} onPress={() => go('/inspector/community')} />
                <QuickAction icon={Plus} label={k('new_visit')} onPress={() => go('/inspector/visits/new')} />
                <QuickAction icon={ClipboardCheck} label={k('all_visits')} onPress={() => go('/inspector/visits')} />
              </View>
            </View>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}
