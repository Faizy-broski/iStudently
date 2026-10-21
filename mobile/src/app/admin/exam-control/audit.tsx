import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { Note, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';

type Entry = { id: number; action: string; actor_role: string | null; actor_name: string; created_at: string; after: unknown };

/** Append-only log of the session (web: exam control › Audit log; control chief only). */
export default function ExamControlAudit() {
  const { t } = useTranslation();
  const id = useSessionId();
  const log = useApi(id ? (['jc', 'audit', id] as const) : null, ([, , s]) => jahbadhControl.audit(s));
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_audit') }} />
      <DataList
        className="bg-background"
        header={
          <View className="p-4 pb-2">
            <Note text={t('examControl.auditHint')} />
          </View>
        }
        items={log.data}
        error={log.error}
        isLoading={log.isLoading}
        isRefreshing={log.isValidating && !log.isLoading}
        onRefresh={() => log.mutate()}
        emptyTitle={t('examControl.noAudit')}
        keyExtractor={(e: Entry) => String(e.id)}
        renderItem={(e: Entry) => (
          <View className="gap-0.5 px-4 py-2.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-mono text-xs font-semibold">{e.action}</Text>
              <Text variant="muted" className="text-[11px]">
                {new Date(e.created_at).toLocaleString(locale)}
              </Text>
            </View>
            <Text variant="muted" className="text-[11px]">
              {[e.actor_name, e.actor_role].filter(Boolean).join(' · ')}
            </Text>
            {e.after ? (
              <Text variant="muted" className="font-mono text-[10px]" numberOfLines={3}>
                {JSON.stringify(e.after)}
              </Text>
            ) : null}
          </View>
        )}
      />
    </>
  );
}
