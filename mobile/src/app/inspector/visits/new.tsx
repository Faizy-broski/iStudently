import type { InspectorVisitType } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CalendarPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

const TYPES: InspectorVisitType[] = ['announced', 'unannounced', 'follow_up'];

/** Schedule a visit to an assigned campus (web: /inspector/visits/new). */
export default function NewInspectionVisit() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const schools = useApi(['inspector', 'schools'], () => inspector.mySchools());
  const [f, setF] = useState({ school: '', type: 'announced' as InspectorVisitType, date: '', start: '', end: '', purpose: '' });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function submit() {
    if (!f.school || !f.date) return;
    setBusy(true);
    const r = await inspector.createVisit({
      school_id: f.school,
      visit_type: f.type,
      scheduled_date: f.date,
      scheduled_start_time: f.start || undefined,
      scheduled_end_time: f.end || undefined,
      purpose: f.purpose.trim() || undefined,
    });
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_visit_created'));
    mutate(['inspector', 'visits']);
    router.replace({ pathname: '/inspector/visits/[id]', params: { id: r.data.id } });
  }

  const list = schools.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('new_visit_title') }} />
      <KeyboardAvoidingView className="bg-background flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <Text variant="muted">{k('new_visit_subtitle')}</Text>
          <Card>
            <CardHeader>
              <View className="flex-row items-center gap-2">
                <Icon as={CalendarPlus} className="size-5 text-[#022172] dark:text-blue-300" />
                <CardTitle className="text-base">{k('form_title')}</CardTitle>
              </View>
              <CardDescription>{k('form_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="gap-1.5">
                <Label>{k('field_campus')}</Label>
                {schools.isLoading ? (
                  <Text className="text-muted-foreground text-sm">{k('loading_campuses')}</Text>
                ) : !list.length ? (
                  <Text className="text-muted-foreground text-sm">{k('no_assigned_campuses')}</Text>
                ) : (
                  <Picker value={f.school || null} onChange={(v) => set({ school: v })} placeholder={k('field_campus_placeholder')} options={list.map((s) => ({ value: s.id, label: s.name }))} />
                )}
              </View>
              <View className="gap-1.5">
                <Label>{k('field_visit_type')}</Label>
                <Picker value={f.type} onChange={(v) => set({ type: v as InspectorVisitType })} options={TYPES.map((x) => ({ value: x, label: k(`visit_type_${x}`) }))} />
              </View>
              <DateField label={k('field_date')} value={f.date || null} onChange={(v) => set({ date: v })} />
              <View className="flex-row gap-2">
                <TimeField className="flex-1" label={k('field_start_time')} value={f.start} onChange={(v) => set({ start: v })} />
                <TimeField className="flex-1" label={k('field_end_time')} value={f.end} onChange={(v) => set({ end: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{k('field_purpose')}</Label>
                <Textarea value={f.purpose} onChangeText={(v) => set({ purpose: v })} placeholder={k('field_purpose_placeholder')} />
              </View>
              <Button onPress={submit} disabled={busy || !f.school || !f.date}>
                <Icon as={CalendarPlus} className="text-primary-foreground size-4" />
                <Text>{k('btn_schedule')}</Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
