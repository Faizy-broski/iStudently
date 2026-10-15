import { Stack } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const RSVP = ['yes', 'no', 'maybe'] as const;

/** School events with RSVP counts; create a school-wide event (web: /admin/fina/events). */
export function FinaEventsScreen({ canCreate }: { canCreate: boolean }) {
  const { f, lang } = useFn('events');
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-events', campusId ?? 'school'], () => fina.events(campusId));
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || !date) return;
    setBusy('new');
    try {
      const r = await fina.createEvent(
        {
          title: title.trim(),
          starts_at: `${date}T${time}`,
          location: location.trim() || undefined,
          audience_type: 'school',
        },
        campusId,
      );
      if (!r.success) return toast.error(r.error || '');
      setTitle('');
      setDate('');
      setLocation('');
      setOpen(false);
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  async function rsvp(eventId: string, answer: (typeof RSVP)[number]) {
    setBusy(eventId);
    try {
      const r = await fina.rsvp(eventId, answer, campusId);
      if (!r.success) return toast.error(r.error || '');
      res.mutate();
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: f('page_title'),
          headerRight: () =>
            canCreate ? (
              <Pressable onPress={() => setOpen(true)} hitSlop={8} className="p-1" accessibilityLabel={f('create_button')}>
                <Icon as={Plus} className="text-foreground size-6" />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{f('empty')}</Text>
        ) : (
          list.map((e) => (
            <Card key={e.id}>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-start gap-3">
                  <Icon as={CalendarDays} className="text-primary mt-0.5 size-5" />
                  <View className="flex-1">
                    <Text className="font-medium">{e.title}</Text>
                    <Text className="text-muted-foreground text-xs">
                      {new Date(e.starts_at).toLocaleString(lang)}
                      {e.location ? ` · ${e.location}` : ''}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  {RSVP.map((o) => (
                    <Pressable
                      key={o}
                      onPress={() => rsvp(e.id, o)}
                      disabled={busy === e.id}
                      className={cn('flex-1 items-center rounded-md border py-1.5', e.myRsvp === o ? 'border-[#022172] bg-[#022172]' : 'border-border')}>
                      <Text className={cn('text-xs', e.myRsvp === o && 'text-white')}>
                        {f(`rsvp_${o}`)} {e.rsvpCounts?.[o] ? `(${e.rsvpCounts[o]})` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md">
          <KeyboardAvoidingView>
            <View className="gap-3">
              <DialogHeader>
                <DialogTitle>{f('create_button')}</DialogTitle>
              </DialogHeader>
              <View className="gap-1.5">
                <Label>{f('field_title')}</Label>
                <Input value={title} onChangeText={setTitle} />
              </View>
              <View className="gap-1.5">
                <Label>{f('field_starts_at')}</Label>
                <View className="flex-row gap-2">
                  <DateField className="flex-1" value={date} onChange={setDate} />
                  <TimeField className="w-36" value={time} onChange={setTime} />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{f('field_location')}</Label>
                <Input value={location} onChangeText={setLocation} />
              </View>
              <Button onPress={create} disabled={busy === 'new' || !title.trim() || !date}>
                <Text>{f('create_button')}</Text>
              </Button>
            </View>
          </KeyboardAvoidingView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
