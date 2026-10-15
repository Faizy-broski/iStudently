import { Stack } from 'expo-router';
import { CheckCircle, ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { StudentReferral } from '@studently/api-client';
import i18n from '@/i18n';

const longDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' });

type Res = { data?: StudentReferral[]; isLoading: boolean; mutate: () => unknown };

/** Discipline referrals with their field values (web: /student and /parent discipline); `text` overrides the copy for parents. */
export function DisciplineView({ data, text }: { data: Res; text?: { subtitle: string; cleanBody: string } }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_dc_${key}`, o);
  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '' : v === 'Y' || v === true ? t('app.yes') : v === 'N' || v === false ? t('app.no') : Array.isArray(v) ? v.join(', ') : String(v));

  if (data.isLoading) return <LoadingList rows={4} />;
  const list = data.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{text?.subtitle ?? k('subtitle')}</Text>
        {list.length === 0 ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={CheckCircle} className="mb-3 size-12 text-green-500" />
              <Text className="text-lg font-semibold">{k('clean')}</Text>
              <Text className="text-muted-foreground mt-1 text-center">{text?.cleanBody ?? k('clean_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Text className="text-muted-foreground text-sm">{k('count', { count: list.length })}</Text>
            {list.map((r) => {
              const reporter = r.reporter ? `${r.reporter.first_name ?? ''} ${r.reporter.last_name ?? ''}`.trim() || k('staff') : k('staff');
              const entries = Object.entries(r.field_values ?? {}).filter(([, v]) => fmt(v) !== '');
              return (
                <Card key={r.id} className="border-s-4 border-s-orange-400">
                  <CardHeader className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Icon as={ShieldAlert} className="size-4 text-orange-500" />
                      <CardTitle className="flex-1 text-base">{k('referral', { date: longDate(r.incident_date) })}</CardTitle>
                    </View>
                    <Badge variant="outline" className="self-start">
                      <Text className="text-xs">{k('by', { name: reporter })}</Text>
                    </Badge>
                  </CardHeader>
                  {entries.length ? (
                    <CardContent className="gap-1.5">
                      {entries.map(([key, v]) => (
                        <Text key={key} className="text-sm">
                          <Text className="text-muted-foreground text-sm font-medium">{`${r.field_names?.[key] || key.replace(/_/g, ' ')}: `}</Text>
                          {fmt(v)}
                        </Text>
                      ))}
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </>
  );
}
