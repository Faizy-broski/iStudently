import type { TrainingSession } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Award, BookOpen, CheckCircle, ClipboardList, Copy, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { capacityTone, registrationLink, STATUS_TONE } from '@/features/admin/training';
import { useCampus } from '@/features/campus/campus';
import { adminTraining } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Training sessions: stats, cards with capacity, view/edit/copy link/delete (web: /admin/training). */
export default function Training() {
  const { t, i18n } = useTranslation();
  const tr = (k: string, o?: Record<string, unknown>) => t(`adminTrainingSessions.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'training', campusId ?? 'school'], () => adminTraining.sessions(campusId));
  const sessions = res.data ?? [];
  const day = (s: string) => new Date(s).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  async function copy(token: string) {
    await Clipboard.setStringAsync(registrationLink(token));
    toast.success(tr('linkCopied'));
  }

  async function remove(s: TrainingSession) {
    if (!(await confirm({ title: tr('deleteSessionTitle'), body: tr('deleteSessionDesc', { title: s.title, count: s.registered_seats }), confirmLabel: tr('delete'), destructive: true }))) return;
    const r = await adminTraining.remove(s.id, campusId);
    if (!r.success) return toast.error(r.error || tr('failedDeleteSession'));
    toast.success(tr('sessionDeleted'));
    res.mutate();
  }

  const statusLabel = (st: string) => (st === 'open' ? tr('statusOpen') : st === 'full' ? tr('statusFull') : st === 'closed' ? tr('statusClosed') : st);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: tr('pageTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{tr('pageSubtitle')}</Text>
        <Button className="self-start" onPress={() => router.push('/admin/training/form')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{tr('newSessionSpec')}</Text>
        </Button>
        <View className="flex-row gap-2">
          <StatTile icon={ClipboardList} label={tr('statTotalSessions')} value={String(sessions.length)} />
          <StatTile icon={BookOpen} label={tr('statOpen')} value={String(sessions.filter((s) => s.status === 'open').length)} />
        </View>
        <View className="flex-row gap-2">
          <StatTile icon={CheckCircle} label={tr('statFull')} value={String(sessions.filter((s) => s.status === 'full').length)} />
          <StatTile icon={Users} label={tr('statTotalRegistrations')} value={String(sessions.reduce((n, s) => n + s.registered_seats, 0))} />
        </View>

        {res.isLoading ? (
          <LoadingList />
        ) : !sessions.length ? (
          <Card>
            <CardContent className="items-center gap-3 py-10">
              <Icon as={ClipboardList} className="text-muted-foreground/40 size-12" />
              <Text className="text-lg font-medium">{tr('noSessionsYet')}</Text>
              <EmptyState title={tr('noSessionsDesc')} />
              <Button onPress={() => router.push('/admin/training/form')}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{tr('createSessionSpec')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          sessions.map((s) => {
            const pct = s.total_seats > 0 ? Math.round((s.registered_seats / s.total_seats) * 100) : 0;
            return (
              <Card key={s.id}>
                <CardContent className="gap-2 pt-4">
                  <View className="flex-row gap-3">
                    {s.cover_image_url ? <Image source={{ uri: s.cover_image_url }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" /> : null}
                    <View className="flex-1 gap-1.5">
                      <Text className="font-bold">{s.title}</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        <View className={cn('rounded px-2 py-0.5', STATUS_TONE[s.status])}>
                          <Text className={cn('text-xs font-medium', STATUS_TONE[s.status])}>{statusLabel(s.status)}</Text>
                        </View>
                        {s.category ? <Pill text={s.category} /> : null}
                        {s.skill_level ? <Pill text={t(`adminTrainingSessions.form.${s.skill_level}`)} /> : null}
                        <Pill text={tr('audienceSuffix', { audience: s.target_audience })} />
                        {s.certificate_settings?.enable_auto_issuance ? (
                          <View className="flex-row items-center gap-1 rounded-full border border-chart-6/30 bg-chart-6/10 px-2 py-0.5 ">
                            <Icon as={Award} className="size-3 text-chart-6" />
                            <Text className="text-xs text-chart-6">{tr('autoCert')}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <Text className="text-muted-foreground text-sm">
                    {day(s.start_date)} – {day(s.end_date)}
                    {s.daily_time_range ? ` • ${s.daily_time_range}` : ''}
                  </Text>
                  {s.instructor_name ? (
                    <Text className="text-sm">
                      {tr('instructor')} <Text className="text-sm font-semibold">{s.instructor_name}</Text>
                    </Text>
                  ) : null}
                  {s.location_venue_link ? (
                    <Text className="text-sm">
                      {tr('venueLink')} <Text className="text-sm font-semibold">{s.location_venue_link}</Text>
                    </Text>
                  ) : null}
                  <Text className="text-sm">
                    {tr('fee')} <Text className="text-sm font-semibold">{s.course_fee > 0 ? tr('feeCurrency', { amount: s.course_fee }) : tr('free')}</Text>
                  </Text>
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground text-xs">{tr('seatsTaken', { registered: s.registered_seats, total: s.total_seats })}</Text>
                    <Text className="text-muted-foreground text-xs">{tr('seatsRemaining', { count: s.available_seats })}</Text>
                  </View>
                  <View className="bg-muted h-2 overflow-hidden rounded-full">
                    <View className={cn('h-full rounded-full', capacityTone(pct))} style={{ width: `${pct}%` }} />
                  </View>
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/training/[id]', params: { id: s.id } })}>
                      <Icon as={Eye} className="text-foreground size-4" />
                      <Text>{tr('view')}</Text>
                    </Button>
                    <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/training/form', params: { id: s.id } })}>
                      <Icon as={Pencil} className="text-foreground size-4" />
                      <Text>{tr('editSpec')}</Text>
                    </Button>
                    <Button size="sm" variant="outline" onPress={() => copy(s.public_token)}>
                      <Icon as={Copy} className="text-foreground size-4" />
                      <Text>{tr('copyLink')}</Text>
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => remove(s)} accessibilityLabel={tr('delete')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View className="border-border rounded-full border px-2 py-0.5">
      <Text className="text-xs capitalize">{text}</Text>
    </View>
  );
}
