import { PHYSICS_CATALOG } from '@studently/shared-utils';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2, Clock, ExternalLink, FlaskConical, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView } from '@/components/app/keyboard';
import { HeaderButton } from '@/components/app/layout';
import { EmptyState, LoadingList } from '@/components/app/states';
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
  if (!lab) return <EmptyState icon={FlaskConical} title={k('noLabsAssigned')} />;
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
            sim?.url ? <HeaderButton icon={ExternalLink} label={k('openSimulation')} onPress={() => WebBrowser.openBrowserAsync(sim.url)} /> : null,
        }}
      />
      <View className="border-info-soft dark:border-border flex-row items-center justify-end border-b px-4 py-2">
        <View className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
          <Icon as={Clock} className="text-brand dark:text-brand-secondary size-3.5" />
          <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{fmt(done ? spent : spent)}</Text>
        </View>
      </View>
      {lab.custom_note ? (
        <View className="border-info-soft dark:border-border bg-info-soft border-b px-4 py-2.5">
          <Text className="text-brand dark:text-brand-secondary text-sm">
            <Text className="text-brand dark:text-brand-secondary text-sm font-semibold">{k('instructionsLabel')}</Text>
            {lab.custom_note}
          </Text>
        </View>
      ) : null}
      <View className="flex-1">{sim?.url ? <PublicWebView url={sim.url} /> : null}</View>
      <View className="border-info-soft dark:border-border bg-card gap-2 rounded-t-3xl border-t px-4 py-3">
        {done ? (
          <View className="bg-success-soft flex-row items-center justify-center gap-2 rounded-2xl py-2.5">
            <Icon as={CheckCircle2} className="text-success size-4" />
            <Text className="text-success text-sm font-semibold">{k('submitted')}</Text>
          </View>
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
