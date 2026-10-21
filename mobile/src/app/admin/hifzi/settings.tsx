import type { HifziSettings } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

type NumKey = 'srsSimilarityFactor' | 'srsReviewIntensity' | 'srsRecencyFactor' | 'srsMaxIntervalDays' | 'assignmentCriticalThreshold' | 'assignmentNewBlockThreshold' | 'assignmentMaxDailyReviewUnits' | 'assignmentNearReviewCount' | 'absenceAlertMinutes';

const SRS: { key: NumKey; label: string; decimal?: boolean }[] = [
  { key: 'srsSimilarityFactor', label: 'hz_similarity', decimal: true },
  { key: 'srsReviewIntensity', label: 'hz_review_intensity', decimal: true },
  { key: 'srsRecencyFactor', label: 'hz_recency', decimal: true },
  { key: 'srsMaxIntervalDays', label: 'hz_max_interval' },
];
const ASSIGNMENT: { key: NumKey; label: string }[] = [
  { key: 'assignmentCriticalThreshold', label: 'hz_critical_threshold' },
  { key: 'assignmentNewBlockThreshold', label: 'hz_block_new' },
  { key: 'assignmentMaxDailyReviewUnits', label: 'hz_max_daily_review' },
  { key: 'assignmentNearReviewCount', label: 'hz_near_review' },
];

function Form({ initial }: { initial: HifziSettings }) {
  const { h, a } = useHz('settings');
  const toast = useToast();
  const { campusId } = useCampus();
  const [s, setS] = useState(initial);
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries([...SRS, ...ASSIGNMENT, { key: 'absenceAlertMinutes' }].map((f) => [f.key, String(initial[f.key as NumKey] ?? '')])));
  const [saving, setSaving] = useState(false);

  const field = (key: NumKey, label: string, decimal = false) => (
    <View key={key} className="gap-1.5">
      <Label>{label}</Label>
      <Input
        value={text[key]}
        onChangeText={(v) => {
          setText((p) => ({ ...p, [key]: v }));
          const n = Number(v.replace(',', '.'));
          if (v.trim() !== '' && Number.isFinite(n)) setS((p) => ({ ...p, [key]: n }));
        }}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      />
    </View>
  );

  async function save() {
    setSaving(true);
    try {
      const res = await adminHifzi.updateSettings(s, campusId);
      if (!res.success) return toast.error(res.error || h('saveError'));
      toast.success(h('saveSuccess'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{h('srsSettings')}</Text>
            {SRS.map((f) => field(f.key, a(f.label), f.decimal))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{h('assignmentSettings')}</Text>
            {ASSIGNMENT.map((f) => field(f.key, a(f.label)))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="font-semibold">{h('title')}</Text>
            {field('absenceAlertMinutes', h('absenceAlertMinutes'))}
            <View className="flex-row items-center gap-3">
              <Switch checked={s.guardianNotifyAfterSession} onCheckedChange={(v) => setS((p) => ({ ...p, guardianNotifyAfterSession: v }))} />
              <Text className="flex-1 text-sm">{h('guardianNotify')}</Text>
            </View>
          </CardContent>
        </Card>
        <Button onPress={save} disabled={saving}>
          <Icon as={Save} className="text-primary-foreground size-4" />
          <Text>{a('hz_save')}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Spaced-repetition, assignment and alert settings for the selected campus (web: /admin/hifzi/settings). */
export default function HifziSettingsScreen() {
  const { h } = useHz('settings');
  const { campusId } = useCampus();
  const res = useApi(['admin', 'hifzi-settings', campusId ?? 'school'], () => adminHifzi.settings(campusId));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      {res.isLoading ? (
        <View className="p-4">
          <LoadingList rows={4} />
        </View>
      ) : res.error || !res.data ? (
        <ErrorState message={res.error?.message} onRetry={() => res.mutate()} />
      ) : (
        <Form key={campusId ?? 'school'} initial={res.data} />
      )}
    </View>
  );
}
