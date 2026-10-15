import { router, type Href } from 'expo-router';
import { AlertTriangle, ArrowRight, ArrowUpRight, BookMarked, BookOpen, BookX, CheckCircle2, Clock, DollarSign, Library, Plus, RefreshCw, Search, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { openPortalPage, usePortalPlugins, usePortalSettings } from '@/features/portal/menu';
import { SetupAssistantPanel } from '@/features/setup-assistant/panel';
import { adminLibrary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Librarian home: quick actions, books / loans / overdue / fines, recent loans and overdue returns (web: /librarian/dashboard). */
export default function LibrarianDashboard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { campusId } = useCampus();
  const { money } = useCurrency();
  const settings = usePortalSettings();
  const plugins = usePortalPlugins();
  const res = useApi(['librarian', 'stats', campusId ?? 'school'], () => adminLibrary.stats(campusId ?? undefined));
  const s = res.data;
  const first = profile?.first_name || t('app.role_librarian');
  const overdue = s?.overdue_loans ?? 0;

  const actions: { label: string; href: Href; icon: LucideIcon; primary?: boolean }[] = [
    { label: k('issue_book'), href: '/librarian/issue', icon: Plus, primary: true },
    { label: k('return_book'), href: '/librarian/return', icon: ArrowUpRight },
    { label: k('search_books'), href: '/librarian/books', icon: Search },
    { label: t('sidebar.e_library'), href: '/librarian/e-library', icon: BookOpen },
    { label: t('sidebar.loan_directory'), href: '/librarian/loans', icon: Library },
  ];
  const stats: { label: string; value: string; sub: string; icon: LucideIcon; tone: string; valueTone?: string }[] = [
    { label: k('total_books'), value: String(s?.total_books ?? 0), sub: k('copies_count', { count: s?.total_copies ?? 0 }), icon: BookOpen, tone: 'bg-blue-500' },
    { label: k('active_loans'), value: String(s?.active_loans ?? 0), sub: k('currently_issued'), icon: BookMarked, tone: 'bg-amber-500' },
    {
      label: k('overdue_books'),
      value: String(overdue),
      sub: overdue > 0 ? k('action_required') : k('all_on_time'),
      icon: Clock,
      tone: overdue > 0 ? 'bg-red-500' : 'bg-green-500',
      valueTone: overdue > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      label: k('fines_collected'),
      value: money(s?.total_fines_collected ?? 0),
      sub: s?.pending_fines ? k('pending_amount', { amount: money(s.pending_fines) }) : k('no_pending_fines'),
      icon: DollarSign,
      tone: 'bg-emerald-500',
    },
  ];

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
      <View className="flex-row items-center gap-3">
        <PersonAvatar url={profile?.profile_photo_url ?? null} name={first} size={56} />
        <View className="flex-1">
          <Text className="text-xl font-bold">{k('welcome_back', { name: first })}</Text>
          <Text className="text-muted-foreground text-sm">{k('dashboard_subtitle')}</Text>
        </View>
        <Button size="icon" variant="outline" onPress={() => res.mutate()} accessibilityLabel={k('refresh')}>
          <Icon as={RefreshCw} className="size-4" />
        </Button>
      </View>
      <SetupAssistantPanel role="librarian" plugins={plugins} config={settings.data?.setup_assistant_config as Record<string, boolean> | null | undefined} onOpen={(href, title) => openPortalPage('librarian', { href, title })} />
      <View className="flex-row flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.primary ? 'default' : 'outline'} onPress={() => router.push(a.href)}>
            <Icon as={a.icon} className={cn('size-4', a.primary && 'text-primary-foreground')} />
            <Text>{a.label}</Text>
          </Button>
        ))}
      </View>
      {res.isLoading ? (
        <LoadingList rows={4} />
      ) : res.error ? (
        <Card>
          <CardContent className="items-center gap-2 py-10">
            <Icon as={BookX} className="size-12 text-red-400" />
            <Text className="font-semibold text-red-600">{k('dashboard_failed')}</Text>
            <Text className="text-muted-foreground text-sm">{res.error.message}</Text>
            <Button onPress={() => res.mutate()}>
              <Text>{k('try_again')}</Text>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {stats.map((x) => (
              <Card key={x.label} className="min-w-[45%] flex-1">
                <CardContent className="flex-row items-start justify-between gap-2 p-4">
                  <View className="flex-1">
                    <Text className="text-muted-foreground text-xs font-medium">{x.label}</Text>
                    <Text className={cn('mt-1 text-2xl font-bold', x.valueTone)}>{x.value}</Text>
                    <Text className="text-muted-foreground text-xs">{x.sub}</Text>
                  </View>
                  <View className={cn('rounded-xl p-2', x.tone)}>
                    <Icon as={x.icon} className="size-5 text-white" />
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={TrendingUp} className="size-4 text-[#57A3CC]" />
                  <CardTitle className="text-base">{k('recent_loans')}</CardTitle>
                </View>
                <CardDescription>{k('recent_loans_desc')}</CardDescription>
              </View>
              <Button size="sm" variant="ghost" onPress={() => router.push('/librarian/loans')}>
                <Text className="text-xs">{k('view_all')}</Text>
                <Icon as={ArrowRight} className="size-3 rtl:rotate-180" />
              </Button>
            </CardHeader>
            <CardContent className="gap-2">
              {!(s?.recent_loans ?? []).length ? (
                <View className="items-center py-4">
                  <Icon as={BookOpen} className="text-muted-foreground/30 size-8" />
                  <Text className="text-muted-foreground text-sm">{k('no_recent_loans')}</Text>
                </View>
              ) : (
                (s?.recent_loans ?? []).map((l) => (
                  <View key={l.id} className="border-border flex-row items-center gap-3 rounded-lg border p-2.5">
                    <Icon as={BookOpen} className="size-4 text-[#022172] dark:text-[#57A3CC]" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {l.book_title}
                      </Text>
                      <Text className="text-muted-foreground text-xs">{`${k('due')}: ${formatDate(l.due_date)}`}</Text>
                    </View>
                    <Badge variant="outline" className={l.status === 'active' ? 'border-blue-400' : 'border-green-400'}>
                      <Text className={cn('text-xs', l.status === 'active' ? 'text-blue-600' : 'text-green-600')}>{l.status === 'active' ? k('active') : k('returned')}</Text>
                    </Badge>
                  </View>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={AlertTriangle} className="size-4 text-red-500" />
                  <CardTitle className="text-base">{k('overdue_returns')}</CardTitle>
                </View>
                <CardDescription>{k('overdue_returns_desc')}</CardDescription>
              </View>
              {overdue > 0 ? (
                <Button size="sm" variant="ghost" onPress={() => router.push('/librarian/loans')}>
                  <Text className="text-xs text-red-500">{k('view_all')}</Text>
                  <Icon as={ArrowRight} className="size-3 text-red-500 rtl:rotate-180" />
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="gap-2">
              {!(s?.overdue_list ?? []).length ? (
                <View className="items-center py-4">
                  <Icon as={CheckCircle2} className="size-8 text-green-500/60" />
                  <Text className="text-muted-foreground text-sm">{k('no_overdue')}</Text>
                </View>
              ) : (
                (s?.overdue_list ?? []).map((o) => (
                  <View key={o.id} className="flex-row items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-900 dark:bg-red-950/30">
                    <Icon as={BookX} className="size-4 text-red-600" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {o.book_title}
                      </Text>
                      <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                        {o.student_name}
                      </Text>
                    </View>
                    <Badge variant="outline" className="flex-row items-center gap-1 border-red-400">
                      <Icon as={Clock} className="size-3 text-red-600" />
                      <Text className="text-xs text-red-600">{k('days_short', { count: o.days_overdue })}</Text>
                    </Badge>
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </ScrollView>
  );
}
