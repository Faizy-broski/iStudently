import { Stack } from 'expo-router';
import { CheckCircle, ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
        <Text variant="muted" className="text-sm">
          {text?.subtitle ?? k('subtitle')}
        </Text>
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle} title={k('clean')} body={text?.cleanBody ?? k('clean_body')} />
        ) : (
          <>
            <Text className="text-muted-foreground text-xs">{k('count', { count: list.length })}</Text>
            {list.map((r) => {
              const reporter = r.reporter ? `${r.reporter.first_name ?? ''} ${r.reporter.last_name ?? ''}`.trim() || k('staff') : k('staff');
              const entries = Object.entries(r.field_values ?? {}).filter(([, v]) => fmt(v) !== '');
              return (
                <Panel key={r.id} className="gap-3 p-4">
                  <View className="flex-row items-center gap-3">
                    <IconTile icon={ShieldAlert} tone="warning" size={40} />
                    <View className="flex-1 gap-1">
                      <Text className="text-sm font-semibold">{k('referral', { date: longDate(r.incident_date) })}</Text>
                      <StatusChip label={k('by', { name: reporter })} tone="muted" className="self-start" />
                    </View>
                  </View>
                  {entries.length ? (
                    <View className="bg-muted/40 gap-1.5 rounded-xl p-3">
                      {entries.map(([key, v]) => (
                        <Text key={key} className="text-sm">
                          <Text className="text-muted-foreground text-sm font-medium">{`${r.field_names?.[key] || key.replace(/_/g, ' ')}: `}</Text>
                          {fmt(v)}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Panel>
              );
            })}
          </>
        )}
      </ScrollView>
    </>
  );
}
