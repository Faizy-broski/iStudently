import type { EligibilitySettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAc } from '@/features/admin/activities';
import { adminActivities } from '@/lib/api';
import { useApi } from '@/lib/data';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const pad2 = (n: number) => String(n).padStart(2, '0');

function Form({ initial }: { initial: EligibilitySettings }) {
  const a = useAc();
  const toast = useToast();
  const [s, setS] = useState<EligibilitySettings>({
    start_day: initial.start_day,
    start_hour: initial.start_hour,
    start_minute: initial.start_minute,
    end_day: initial.end_day,
    end_hour: initial.end_hour,
    end_minute: initial.end_minute,
  });
  const [saving, setSaving] = useState(false);
  const day = (i: number) => a(`days.${DAYS[i] ?? 'sunday'}`);

  async function save() {
    setSaving(true);
    try {
      const r = await adminActivities.saveEntryTimes(s);
      if (!r.success) return toast.error(r.error || a('failedToSaveEntryTimes'));
      toast.success(a('entryTimesSaved'));
    } finally {
      setSaving(false);
    }
  }

  const side = (which: 'start' | 'end') => (
    <View className="gap-2">
      <Label className="font-semibold">{a(which)}</Label>
      <View className="gap-1">
        <Text className="text-muted-foreground text-xs">{a('day')}</Text>
        <Picker value={String(s[`${which}_day`])} onChange={(v) => setS({ ...s, [`${which}_day`]: Number(v) })} options={DAYS.map((_, i) => ({ value: String(i), label: day(i) }))} />
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Text className="text-muted-foreground text-xs">{a('hour')}</Text>
          <Picker value={String(s[`${which}_hour`])} onChange={(v) => setS({ ...s, [`${which}_hour`]: Number(v) })} options={HOURS.map((h) => ({ value: String(h), label: `${pad2(h)}:00` }))} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-muted-foreground text-xs">{a('minute')}</Text>
          <Picker value={String(s[`${which}_minute`])} onChange={(v) => setS({ ...s, [`${which}_minute`]: Number(v) })} options={MINUTES.map((m) => ({ value: String(m), label: pad2(m) }))} />
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Card>
        <CardContent className="gap-4 pt-4">
          <Text className="font-semibold">{a('entryWindow')}</Text>
          {side('start')}
          {side('end')}
          <View className="bg-muted rounded-md p-3">
            <Text className="text-muted-foreground text-sm">
              {a('entryWindowSummary', {
                startDay: day(s.start_day),
                startTime: `${pad2(s.start_hour)}:${pad2(s.start_minute)}`,
                endDay: day(s.end_day),
                endTime: `${pad2(s.end_hour)}:${pad2(s.end_minute)}`,
              })}
            </Text>
          </View>
        </CardContent>
      </Card>
      <Button onPress={save} disabled={saving}>
        <Icon as={Save} className="text-primary-foreground size-4" />
        <Text>{a('saveEntryTimes')}</Text>
      </Button>
    </>
  );
}

/** The weekly window in which teachers may enter eligibility (web: /admin/activities/setup/entry-times). */
export default function EntryTimes() {
  const a = useAc();
  const res = useApi(['admin', 'eligibility-entry-times'], () => adminActivities.entryTimes());
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: a('entryTimesTitle') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{a('entryTimesDescription')}</Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error || !res.data ? (
          <ErrorState message={res.error?.message || a('failedToLoadEntryTimes')} onRetry={() => res.mutate()} />
        ) : (
          <Form initial={res.data} />
        )}
      </ScrollView>
    </View>
  );
}
