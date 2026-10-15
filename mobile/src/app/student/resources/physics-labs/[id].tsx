import { PHYSICS_CATALOG } from '@studently/shared-utils';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Clock, ExternalLink, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { PublicWebView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { portal } from '@/lib/api';
import { useApi } from '@/lib/data';

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

/** One physics lab: the simulation, time spent, teacher instructions and the findings form (web: physics-labs panel). */
export default function StudentPhysicsLab() {
  const { t } = useTranslation();
  const k = (key: string) => t(`physicsLabs.student.${key}`);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const labs = useApi(['student', 'physics-labs'], () => portal.physicsLabs());
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [findings, setFindings] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [done]);

  if (labs.isLoading) return <LoadingList rows={3} />;
  const lab = (labs.data ?? []).find((l) => l.id === id);
  if (!lab) return <Text className="text-muted-foreground p-6">{k('noLabsAssigned')}</Text>;
  const sim = PHYSICS_CATALOG.find((s) => s.key === lab.sim_key);
  const spent = Math.floor((now - started) / 1000);
  const labId = lab.id;

  async function submit() {
    setBusy(true);
    const r = await portal.submitPhysicsFindings({ lab_id: labId, findings_text: findings.trim(), time_spent_s: spent });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('submit'));
    toast.success(k('submitted'));
    setDone(true);
  }

  return (
    <KeyboardAvoidingView className="bg-background flex-1" keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: sim?.title || lab.sim_key,
          headerRight: () =>
            sim?.url ? (
              <Pressable onPress={() => WebBrowser.openBrowserAsync(sim.url)} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('openSimulation')}>
                <Icon as={ExternalLink} className="size-5" />
              </Pressable>
            ) : null,
        }}
      />
      <View className="border-border flex-row items-center justify-end gap-1 border-b px-4 py-1.5">
        <Icon as={Clock} className="text-muted-foreground size-3.5" />
        <Text className="text-muted-foreground text-xs">{fmt(done ? spent : spent)}</Text>
      </View>
      {lab.custom_note ? (
        <View className="border-border border-b bg-blue-50 px-4 py-2 dark:bg-blue-950/30">
          <Text className="text-sm text-blue-800 dark:text-blue-300">
            <Text className="text-sm font-medium text-blue-800 dark:text-blue-300">{k('instructionsLabel')}</Text>
            {lab.custom_note}
          </Text>
        </View>
      ) : null}
      <View className="flex-1">{sim?.url ? <PublicWebView url={sim.url} /> : null}</View>
      <View className="border-border bg-card gap-2 border-t px-4 py-3">
        {done ? (
          <Text className="py-1 text-center text-sm font-medium text-green-700">{k('submitted')}</Text>
        ) : (
          <>
            <Label>{k('findingsLabel')}</Label>
            <Text className="text-muted-foreground text-xs">{k('findingsDesc')}</Text>
            <View className="flex-row items-end gap-2">
              <Textarea className="min-h-16 flex-1" value={findings} onChangeText={setFindings} placeholder={k('findingsPlaceholder')} />
              <Button size="sm" onPress={submit} disabled={!findings.trim() || busy}>
                <Icon as={Send} className="text-primary-foreground size-4" />
                <Text>{busy ? k('submitting') : k('submit')}</Text>
              </Button>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
