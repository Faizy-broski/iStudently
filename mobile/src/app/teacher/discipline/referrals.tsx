import { Stack } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

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
        <Text variant="muted">{k('pageDescription')}</Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={ShieldAlert} className="text-muted-foreground/40 mb-3 size-12" />
              <Text className="text-muted-foreground text-center">{k('noReferralsSubmitted')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((r) => {
            const st = (r as unknown as { students?: { first_name?: string; last_name?: string } }).students;
            const name = st ? `${st.last_name || ''}, ${st.first_name || ''}`.trim() : k('unknownStudent');
            const entries = Object.entries((r.field_values ?? {}) as Record<string, unknown>);
            return (
              <Card key={r.id}>
                <CardContent className="gap-2 p-4">
                  <View className="flex-row items-start gap-3">
                    <Icon as={ShieldAlert} className="mt-0.5 size-5 text-orange-500" />
                    <View className="flex-1">
                      <Text className="font-medium">{name}</Text>
                      <Text className="text-muted-foreground text-sm">{k('incidentDateLabel', { date: formatDate(r.incident_date) })}</Text>
                    </View>
                    <Badge variant="outline">
                      <Text className="text-xs">{k('reportedByYou')}</Text>
                    </Badge>
                  </View>
                  {entries.length ? (
                    <View className="border-border gap-1 border-t pt-2">
                      {entries.map(([key, v]) => (
                        <Text key={key} className="text-muted-foreground text-sm">
                          <Text className="text-sm font-medium">{`${names[key] || key.replace(/_/g, ' ')}: `}</Text>
                          {Array.isArray(v) ? v.join(', ') : String(v)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
