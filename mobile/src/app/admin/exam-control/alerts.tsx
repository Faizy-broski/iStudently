import type { JcAlert } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { FormSection } from '@/components/app/layout';
import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { JcError, Note, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';

const PHASES: JcAlert['phase'][] = ['before', 'examday', 'after'];

/** Session checks before, during and after the exams (web: exam control › Alerts). */
export default function ExamControlAlerts() {
  const { t } = useTranslation();
  const id = useSessionId();
  const alerts = useApi(id ? (['jc', 'alerts', id] as const) : null, ([, , s]) => jahbadhControl.alerts(s));
  if (alerts.error) return <JcError error={alerts.error} />;
  const list = alerts.data;
  const errors = list?.filter((a) => a.status === 'error').length ?? 0;
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_alerts') }} />
      {!list ? (
        <LoadingList />
      ) : (
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
          <Note tone={errors ? 'destructive' : 'success'} text={errors ? t('examControl.alertsErrors', { n: errors }) : t('examControl.alertsClear')} />
          {PHASES.map((p) => (
            <FormSection key={p} title={t(`examControl.phase_${p}`)}>
              {list.filter((a) => a.phase === p).map((a) => (
                <AlertRow key={a.key} a={a} />
              ))}
            </FormSection>
          ))}
        </ScrollView>
      )}
    </>
  );
}

function AlertRow({ a }: { a: JcAlert }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const icon = a.status === 'ok' ? CheckCircle2 : a.status === 'info' ? Info : AlertTriangle;
  const tone = a.status === 'ok' ? 'text-success' : a.status === 'info' ? 'text-brand dark:text-brand-secondary' : 'text-destructive';
  return (
    <Pressable onPress={() => setOpen((v) => !v)} disabled={!a.details?.length} accessibilityRole="button" className="gap-1 py-1">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} className={`size-4 ${tone}`} />
        <Text className="flex-1 text-sm">{t(`examControl.alert_${a.key}`)}</Text>
        <Text className={`text-sm font-semibold ${a.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{String(a.count)}</Text>
      </View>
      {open && a.details?.length ? (
        <Text variant="muted" className="ms-6 text-[11px]">
          {a.details.join('، ')}
        </Text>
      ) : null}
    </Pressable>
  );
}
