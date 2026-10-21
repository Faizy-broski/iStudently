import { Stack } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Initials } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Referrals the teacher filed, with their field values (web: /teacher/discipline/referrals). */
export default function TeacherReferrals() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.disciplineReferrals.${key}`, o);
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const res = useApi(['teacher', 'staff-referrals'], () => adminDiscipline.staffReferrals());
  const fields = useApi(schoolId ? ['teacher', 'discipline-all-fields', schoolId] : null, ([, , s]) => adminDiscipline.getAllFields(s as string, true));
  const names = Object.fromEntries((fields.data ?? []).map((f) => [f.id, f.name]));
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([res.mutate(), fields.mutate()])} />}>
        <Text className="text-muted-foreground text-sm">{k('pageDescription')}</Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={ShieldAlert} title={k('noReferralsSubmitted')} />
        ) : (
          <Panel>
            {list.map((r, i) => {
              const st = (r as unknown as { students?: { first_name?: string; last_name?: string } }).students;
              const name = st ? `${st.last_name || ''}, ${st.first_name || ''}`.trim() : k('unknownStudent');
              const entries = Object.entries((r.field_values ?? {}) as Record<string, unknown>);
              return (
                <View key={r.id} className={cn('gap-2 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <View className="flex-row items-center gap-3">
                    <Initials name={name.replace(',', '')} tone="warning" size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold">{name}</Text>
                      <Text className="text-muted-foreground text-xs">{k('incidentDateLabel', { date: formatDate(r.incident_date) })}</Text>
                    </View>
                    <StatusChip label={k('reportedByYou')} tone="info" />
                  </View>
                  {entries.length ? (
                    <View className="bg-muted/50 gap-1 rounded-xl px-3 py-2">
                      {entries.map(([key, v]) => (
                        <Text key={key} className="text-muted-foreground text-xs">
                          <Text className="text-xs font-semibold">{`${names[key] || key.replace(/_/g, ' ')}: `}</Text>
                          {Array.isArray(v) ? v.join(', ') : String(v)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
