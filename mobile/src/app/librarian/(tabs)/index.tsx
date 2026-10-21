import { router, type Href } from 'expo-router';
import { ArrowUpRight, BookMarked, BookOpen, BookX, CheckCircle2, Library, Plus, Receipt, RefreshCw, RotateCcw, Search, TabletSmartphone, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminLibrary } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const go = (href: string) => router.push(href as Href);
const initials = (name?: string | null) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase() || '?';

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

function StatTile({ label, value, note, chip, chipTone = 'success', valueTone, onPress }: { label: string; value: string; note?: string; chip?: string; chipTone?: 'success' | 'destructive' | 'warning'; valueTone?: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-1 gap-1 rounded-2xl border p-3.5 active:opacity-80" accessibilityRole={onPress ? 'button' : undefined}>
      <Text variant="muted" className="text-xs" numberOfLines={1}>
        {label}
      </Text>
      <Text className={cn('text-brand dark:text-foreground text-2xl font-bold', valueTone)} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View className="flex-row flex-wrap items-center gap-1.5">
        {chip ? <StatusChip label={chip} tone={chipTone} className="px-2 py-0.5" /> : null}
        {note ? (
          <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
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
 * Librarian home (Figma library dashboard; web: /librarian/dashboard): books / copies / loans / overdue
 * tiles, catalogue search, inventory preview, overdue loans, recent issues and returns, categories,
 * recent fines, quick actions and Setup Assistant.
 */
export default function LibrarianDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const school = me.status === 'ready' ? me.me.school : null;
  const { campusId, campus } = useCampus();
  const { money } = useCurrency();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const res = useApi(['librarian', 'stats', campusId ?? 'school'], () => adminLibrary.stats(campusId ?? undefined));
  // Same keys as the books and fines screens (shared cache).
  const books = useApi(['admin', 'library-books'], () => adminLibrary.books());
  const fines = useApi(['admin', 'library-fine-stats'], () => adminLibrary.fineStats());
  const s = res.data;
  const first = profile?.first_name || t('app.role_librarian');
  const overdue = s?.overdue_loans ?? 0;
  const refresh = () => Promise.all([res.mutate(), books.mutate(), fines.mutate()]);

  const copies = s?.total_copies ?? 0;
  const availablePct = copies > 0 ? Math.round(((s?.available_copies ?? 0) / copies) * 1000) / 10 : 0;
  const bookList = books.data ?? [];
  const preview = [...bookList].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 3);
  const categoryCounts = Object.entries(
    bookList.reduce<Record<string, number>>((acc, b) => {
      const c = b.category || k('uncategorized');
      acc[c] = (acc[c] ?? 0) + (b.total_copies || 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const recentFines = (fines.data?.recent_fines ?? []).slice(0, 3);

  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
          {/* Header */}
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => go('/librarian/profile')} accessibilityRole="button" accessibilityLabel={first}>
              <PersonAvatar url={profile?.profile_photo_url ?? null} name={first} size={44} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-brand dark:text-foreground text-lg font-bold" numberOfLines={1}>
                {k('welcome_back', { name: first })}
              </Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {[t('app.role_librarian'), campus?.name ?? school?.name].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <RoundButton icon={Search} label={k('search_books')} onPress={() => go('/librarian/books')} />
            <RoundButton icon={RefreshCw} label={k('refresh')} onPress={refresh} />
          </View>

          <SetupAssistantPanel role="librarian" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={(href, title) => openPortalPage('librarian', { href, title })} />

          {res.isLoading ? (
            <LoadingList rows={4} />
          ) : res.error ? (
            <Panel className="items-center gap-2 py-10">
              <Icon as={BookX} className="text-destructive size-12" />
              <Text className="text-destructive font-semibold">{k('dashboard_failed')}</Text>
              <Text variant="muted" className="text-sm">
                {res.error.message}
              </Text>
              <Button onPress={() => res.mutate()}>
                <Text>{k('try_again')}</Text>
              </Button>
            </Panel>
          ) : (
            <>
              {/* Tiles */}
              <View className="gap-2.5">
                <View className="flex-row gap-2.5">
                  <StatTile label={k('total_books')} value={formatNumber(s?.total_books ?? 0)} note={k('copies_count', { count: copies })} onPress={() => go('/librarian/books')} />
                  <StatTile label={k('available_copies')} value={formatNumber(s?.available_copies ?? 0)} note={`${availablePct}%`} onPress={() => go('/librarian/books')} />
                </View>
                <View className="flex-row gap-2.5">
                  <StatTile label={k('active_loans')} value={formatNumber(s?.active_loans ?? 0)} note={k('currently_issued')} onPress={() => go('/librarian/loans')} />
                  <StatTile
                    label={k('overdue_books')}
                    value={formatNumber(overdue)}
                    valueTone={overdue > 0 ? 'text-destructive' : 'text-success'}
                    chip={s?.pending_fines ? money(s.pending_fines) : undefined}
                    chipTone="destructive"
                    note={s?.pending_fines ? k('fines_pending') : overdue > 0 ? k('action_required') : k('all_on_time')}
                    onPress={() => go('/librarian/loans')}
                  />
                </View>
                <Pressable onPress={() => go('/librarian/fines')} className="bg-success-soft flex-row items-center gap-2 rounded-2xl px-4 py-2.5 active:opacity-80" accessibilityRole="button">
                  <Icon as={Receipt} className="text-success size-4" />
                  <Text className="text-success flex-1 text-xs font-semibold">{k('fines_collected')}</Text>
                  <Text className="text-success text-sm font-bold">{money(s?.total_fines_collected ?? 0)}</Text>
                </Pressable>
              </View>

              {/* Search */}
              <Pressable onPress={() => go('/librarian/books')} className="border-info-soft dark:border-border bg-card h-12 flex-row items-center gap-2 rounded-full border px-4" accessibilityRole="search">
                <Icon as={Search} className="text-muted-foreground size-4" />
                <Text variant="muted" className="text-sm">
                  {k('search_placeholder')}
                </Text>
              </Pressable>

              {/* Inventory preview */}
              {preview.length ? (
                <Section title={k('inventory')} action={k('browse')} onAction={() => go('/librarian/books')}>
                  <Panel>
                    {preview.map((b, i) => {
                      const none = (b.available_copies ?? 0) === 0;
                      return (
                        <View key={b.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < preview.length - 1 && 'border-info-soft dark:border-border border-b')}>
                          <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
                            <Icon as={BookOpen} className="text-brand dark:text-brand-secondary size-4" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold" numberOfLines={1}>
                              {b.title}
                            </Text>
                            <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                              {[b.author, b.category].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <StatusChip label={`${b.available_copies ?? 0} / ${b.total_copies ?? 0}`} tone={none ? 'destructive' : 'success'} className="px-2 py-0.5" />
                        </View>
                      );
                    })}
                  </Panel>
                </Section>
              ) : null}

              {/* Overdue loans */}
              <Section title={k('overdue_returns')} action={overdue > 0 ? k('view_all') : undefined} onAction={() => go('/librarian/loans')}>
                <Panel>
                  {!(s?.overdue_list ?? []).length ? (
                    <View className="items-center gap-1 py-5">
                      <Icon as={CheckCircle2} className="text-success size-7" />
                      <Text variant="muted" className="text-sm">
                        {k('no_overdue')}
                      </Text>
                    </View>
                  ) : (
                    (s?.overdue_list ?? []).map((o, i, arr) => (
                      <View key={o.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                        <View className={cn('size-9 items-center justify-center rounded-full', o.days_overdue > 10 ? 'bg-destructive-soft' : 'bg-warning-soft')}>
                          <Text className={cn('text-[11px] font-bold', o.days_overdue > 10 ? 'text-destructive' : 'text-warning')}>{initials(o.student_name)}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" numberOfLines={1}>
                            {o.student_name}
                          </Text>
                          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                            {`${o.book_title} · ${k('due')} ${formatDate(o.due_date)}`}
                          </Text>
                        </View>
                        <StatusChip label={k('days_short', { count: o.days_overdue })} tone={o.days_overdue > 10 ? 'destructive' : 'warning'} className="px-2 py-0.5" />
                      </View>
                    ))
                  )}
                </Panel>
              </Section>

              {/* Recent issues & returns */}
              <Section title={k('recent_loans')} action={k('view_all')} onAction={() => go('/librarian/loans')}>
                <Panel>
                  {!(s?.recent_loans ?? []).length ? (
                    <View className="items-center gap-1 py-5">
                      <Icon as={BookOpen} className="text-muted-foreground size-7" />
                      <Text variant="muted" className="text-sm">
                        {k('no_recent_loans')}
                      </Text>
                    </View>
                  ) : (
                    (s?.recent_loans ?? []).map((l, i, arr) => {
                      const active = l.status === 'active';
                      return (
                        <View key={l.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                          <View className={cn('size-9 items-center justify-center rounded-xl', active ? 'bg-info-soft' : 'bg-success-soft')}>
                            <Icon as={active ? BookMarked : RotateCcw} className={cn('size-4', active ? 'text-brand dark:text-brand-secondary' : 'text-success')} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold" numberOfLines={1}>
                              {l.book_title}
                            </Text>
                            <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                              {[l.issue_date ? formatDate(l.issue_date) : null, `${k('due')}: ${formatDate(l.due_date)}`].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <StatusChip label={active ? k('active') : k('returned')} tone={active ? 'info' : 'success'} className="px-2 py-0.5" />
                        </View>
                      );
                    })
                  )}
                </Panel>
              </Section>

              {/* Categories */}
              {categoryCounts.length ? (
                <Section title={k('categories')} action={k('manage')} onAction={() => go('/librarian/library/categories')}>
                  <View className="flex-row flex-wrap gap-2">
                    {categoryCounts.map(([name, count]) => (
                      <View key={name} className="border-info-soft dark:border-border bg-card rounded-full border px-3 py-1.5">
                        <Text className="text-xs">
                          {`${name} `}
                          <Text className="text-xs font-bold">{formatNumber(count)}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}

              {/* Recent fines */}
              {recentFines.length ? (
                <Section title={k('recent_fines')} action={k('view_all')} onAction={() => go('/librarian/fines')}>
                  <Panel>
                    {recentFines.map((f, i) => (
                      <View key={f.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < recentFines.length - 1 && 'border-info-soft dark:border-border border-b')}>
                        <View className="bg-destructive-soft size-9 items-center justify-center rounded-xl">
                          <Icon as={BookX} className="text-destructive size-4" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" numberOfLines={1}>
                            {f.book_title}
                          </Text>
                          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                            {[f.student_name, f.type === 'overdue' ? k('fine_overdue') : k('fine_condition'), money(f.amount)].join(' · ')}
                          </Text>
                        </View>
                        <StatusChip label={f.paid ? k('fine_paid') : k('fine_unpaid')} tone={f.paid ? 'success' : 'warning'} className="px-2 py-0.5" />
                      </View>
                    ))}
                  </Panel>
                </Section>
              ) : null}
            </>
          )}

          {/* Quick actions */}
          <Section title={t('app.sd_quick_actions')}>
            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                <QuickAction icon={Plus} label={k('issue_book')} onPress={() => go('/librarian/issue')} />
                <QuickAction icon={ArrowUpRight} label={k('return_book')} onPress={() => go('/librarian/return')} />
                <QuickAction icon={BookX} label={k('mark_lost')} onPress={() => go('/librarian/lost')} />
              </View>
              <View className="flex-row gap-2.5">
                <QuickAction icon={TabletSmartphone} label={t('sidebar.e_library')} onPress={() => go('/librarian/e-library')} />
                <QuickAction icon={Library} label={t('sidebar.loan_directory')} onPress={() => go('/librarian/loans')} />
                <QuickAction icon={Search} label={k('search_books')} onPress={() => go('/librarian/books')} />
              </View>
            </View>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}
