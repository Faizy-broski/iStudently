import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, GraduationCap, Pencil, Trash2, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { CategoryBadge } from '@/features/admin/events';
import { useHijriOffset } from '@/features/admin/use-hijri-offset';
import { events } from '@/lib/api';
import { useApi } from '@/lib/data';
import { hijriMonthNames, toHijri } from '@/lib/hijri';

/** Event details: Gregorian + Hijri date (with the global offset), grades, audience, reminder; edit / delete (web: EventDetailsDialog). */
export function EventDetailsScreen({ canEdit }: { canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`app.ev_${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['admin', 'event', id] : null, ([, , eid]) => events.getEventById(eid));
  const ev = res.data ?? null;
  const offset = useHijriOffset();

  async function remove() {
    if (!ev) return;
    if (!(await confirm({ title: d('delete_title'), body: d('delete_body', { title: ev.title }), confirmLabel: t('common.delete'), destructive: true }))) return;
    const r = await events.deleteEvent(ev.id);
    if (!r.success) return toast.error(r.error || d('delete_failed'));
    toast.success(d('deleted'));
    await mutate((k) => Array.isArray(k) && k[0] === 'admin' && ['events-month', 'events-all', 'event-counts', 'acal-events'].includes(k[1]));
    router.back();
  }

  if (res.isLoading) return <LoadingList />;
  if (!ev) return <ErrorState onRetry={() => res.mutate()} />;

  const start = new Date(ev.start_at);
  const h = toHijri(start, offset);
  const hijriWeekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(start);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  const row = (icon: typeof Calendar, label: string, body: React.ReactNode) => (
    <View className="flex-row items-start gap-3">
      <Icon as={icon} className="text-muted-foreground mt-0.5 size-5" />
      <View className="flex-1 gap-1">
        <Text className="text-muted-foreground text-sm font-semibold">{label}</Text>
        {body}
      </View>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: ev.title }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-4 pt-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-xl font-semibold">{ev.title}</Text>
                <Text className="text-muted-foreground text-sm">{ev.description || d('no_description')}</Text>
              </View>
              <CategoryBadge category={ev.category} />
            </View>
            <Separator />
            {row(
              Calendar,
              d('gregorian_date'),
              <>
                <Text className="text-base">{start.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                {!ev.is_all_day ? (
                  <View className="flex-row items-center gap-2">
                    <Icon as={Clock} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-sm">
                      {time(ev.start_at)}
                      {ev.end_at ? ` - ${time(ev.end_at)}` : ''}
                    </Text>
                  </View>
                ) : null}
              </>,
            )}
            {row(
              Calendar,
              d('hijri_date'),
              <>
                <Text className="text-base">{`${hijriWeekday}, ${h.day} ${hijriMonthNames(i18n.language)[h.month]} ${h.year}`}</Text>
                {offset !== 0 ? (
                  <View className="border-border self-start rounded-full border px-2 py-0.5">
                    <Text className="text-xs">{d('global_offset', { offset: `${offset > 0 ? '+' : ''}${offset}` })}</Text>
                  </View>
                ) : null}
              </>,
            )}
            {ev.target_grades?.length
              ? row(
                  GraduationCap,
                  d('target_grades'),
                  <View className="flex-row flex-wrap gap-2">
                    {ev.target_grades.map((g) => (
                      <View key={g} className="border-border rounded-full border px-2 py-0.5">
                        <Text className="text-xs">{d('grade_n', { grade: g })}</Text>
                      </View>
                    ))}
                  </View>,
                )
              : null}
            {row(
              Users,
              d('visible_to'),
              <View className="flex-row flex-wrap gap-2">
                {ev.visible_to_roles.map((r) => (
                  <View key={r} className="bg-muted rounded-full px-2 py-0.5">
                    <Text className="text-xs capitalize">{r.replace('_', ' ')}</Text>
                  </View>
                ))}
              </View>,
            )}
            {ev.send_reminder ? (
              <View className="bg-muted rounded-lg p-3">
                <Text className="text-sm font-medium">{ev.reminder_sent ? d('reminder_sent') : d('reminder_scheduled')}</Text>
              </View>
            ) : null}
          </CardContent>
        </Card>
        {canEdit ? (
          <View className="flex-row justify-end gap-2">
            <Button variant="destructive" onPress={remove}>
              <Icon as={Trash2} className="size-4 text-white" />
              <Text>{t('common.delete')}</Text>
            </Button>
            <Button onPress={() => router.push({ pathname: '/admin/events/form', params: { id: ev.id } })}>
              <Icon as={Pencil} className="text-primary-foreground size-4" />
              <Text>{t('common.edit')}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
