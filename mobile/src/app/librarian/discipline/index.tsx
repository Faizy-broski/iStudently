import type { DisciplineReferral } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, CheckCircle, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatFieldValue, referralPersonName } from '@/features/admin/discipline';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/**
 * Library incidents (e.g. a damaged or lost book) filed as discipline referrals; the server gives a
 * librarian only referrals marked library-related, never behaviour records (web: /librarian/discipline).
 */
export default function LibrarianDiscipline() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.li_${key}`, o);
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const { campusId } = useCampus();
  const res = useApi(schoolId ? ['librarian', 'library-referrals', schoolId, campusId ?? 'school'] : null, ([, , s, c]) =>
    adminDiscipline.getReferrals({ school_id: s as string, campus_id: c === 'school' ? undefined : (c as string), library_related: true, limit: 50 }),
  );
  const fields = useApi(schoolId ? ['librarian', 'discipline-fields', schoolId] : null, ([, , s]) => adminDiscipline.getFields(s as string, 'student'));
  const list: DisciplineReferral[] = res.data ?? [];
  const fieldList = fields.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('discipline_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={BookOpen} className="size-6 text-[#022172] dark:text-blue-300" />
          <Text variant="muted" className="flex-1">
            {k('discipline_subtitle')}
          </Text>
        </View>
        <Button className="self-start" onPress={() => router.push('/librarian/discipline/new')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{k('report_incident')}</Text>
        </Button>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : res.error ? (
          <Text className="text-destructive text-sm">{res.error.message}</Text>
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-14">
              <Icon as={CheckCircle} className="mb-3 size-12 text-green-500" />
              <Text className="text-lg font-semibold">{k('no_referrals')}</Text>
              <Text className="text-muted-foreground mt-1 text-center">{k('no_referrals_desc')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Text className="text-muted-foreground text-sm">{k('referral_count', { count: list.length })}</Text>
            {list.map((r) => (
              <Card key={r.id}>
                <CardHeader className="gap-0.5">
                  <CardTitle className="text-base">{referralPersonName(r)}</CardTitle>
                  <Text className="text-muted-foreground text-xs">{[r.students?.student_number, formatDate(r.incident_date), r.reporter?.full_name].filter(Boolean).join(' · ')}</Text>
                </CardHeader>
                <CardContent className="gap-1">
                  {fieldList
                    .filter((f) => r.field_values?.[f.id] !== undefined && r.field_values?.[f.id] !== '' && r.field_values?.[f.id] !== null)
                    .map((f) => (
                      <Text key={f.id} className="text-sm">
                        <Text className="text-muted-foreground text-sm">{`${f.name}: `}</Text>
                        {formatFieldValue(r.field_values?.[f.id])}
                      </Text>
                    ))}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}
