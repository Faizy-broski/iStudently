import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, Send, XCircle, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, HeroCard, IconTile, RowItem, type Tone } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useChild } from '@/features/parent/child';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const STATUS: Record<string, [LucideIcon, Tone, ChipTone]> = {
  present: [CheckCircle2, 'success', 'success'],
  late: [Clock, 'warning', 'warning'],
  absent: [XCircle, 'destructive', 'destructive'],
  excused: [CheckCircle2, 'brand', 'info'],
  unclosed: [AlertTriangle, 'warning', 'warning'],
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Miqat gate attendance of the selected child this month, accumulated lateness, and a full-day
 * excuse request for today (web: /parent/miqat).
 */
export default function ParentMiqat() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`miqat.guardian.${k}`, o);
  const toast = useToast();
  const { childId } = useChild();
  const kids = useApi(['parent', 'miqat-children'], () => adminMiqat.myChildren());
  // Miqat addresses people by profile id; follow the app's child switcher.
  const kid = (kids.data ?? []).find((c) => c.studentId === childId) ?? kids.data?.[0] ?? null;
  const personId = kid?.profileId ?? null;
  const [range] = useState(() => {
    const now = new Date();
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  });
  const days = useApi(personId ? ['parent', 'miqat-days', personId, range.from, range.to] : null, ([, , p, f, to]) => adminMiqat.childDays(p as string, f as string, to as string));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!personId || !reason.trim()) return;
    setBusy(true);
    const today = ymd(new Date());
    const r = await adminMiqat.createPermission({ person_id: personId, type: 'full_day', date_from: today, date_to: today, reason: reason.trim() });
    setBusy(false);
    if (!r.success) return toast.error(r.error || g('requestError'));
    toast.success(g('requestSubmitted'));
    setReason('');
  }

  if (kids.isLoading) return <LoadingList rows={4} />;
  if (!kid) return <EmptyState title={g('noChildren')} />;
  const list = days.data ?? [];
  const lateness = list.reduce((s, d) => s + (d.lateness_minutes || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([kids.mutate(), days.mutate()])} />}>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-full bg-white/15">
              <Icon as={Clock} className="size-6 text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white/85">{g('accumulatedLateness')}</Text>
              <Text className="text-2xl font-bold text-white">{`${lateness} ${g('minutes')}`}</Text>
            </View>
          </View>
          <View className="flex-row">
            <View className="rounded-full bg-white/15 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{`${kid.firstName} ${kid.lastName}`}</Text>
            </View>
          </View>
        </HeroCard>
        {days.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState title={g('noRecords')} />
        ) : (
          <Panel>
            {list.map((d, i) => {
              const [icon, tone, chip] = STATUS[d.status] ?? [Clock, 'muted', 'muted'];
              return (
                <RowItem
                  key={d.id}
                  leading={<IconTile icon={icon} tone={tone} size={40} />}
                  title={formatDate(d.date)}
                  trailing={<StatusChip label={g(`status.${d.status}`, { defaultValue: d.status })} tone={chip} />}
                  last={i === list.length - 1}
                />
              );
            })}
          </Panel>
        )}
        <FormSection title={g('submitExcuse')} icon={Send}>
          <Textarea value={reason} onChangeText={setReason} placeholder={g('reasonPlaceholder')} />
          <Button onPress={submit} disabled={busy || !reason.trim()}>
            <Icon as={Send} className="text-primary-foreground size-4" />
            <Text>{g('submit')}</Text>
          </Button>
        </FormSection>
      </ScrollView>
    </>
  );
}
