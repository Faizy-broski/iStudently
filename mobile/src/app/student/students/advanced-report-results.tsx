import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { HeaderButton, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminCustomFields, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { shareTextFile } from '@/lib/share-file';

/** The student's own data for the chosen fields, exportable as CSV (web: /student/students/advanced-report/results). */
export default function StudentMyReportResults() {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ar_${key}`, o);
  const toast = useToast();
  const { fields } = useLocalSearchParams<{ fields?: string }>();
  let selected: string[] = [];
  try {
    selected = fields ? (JSON.parse(fields) as string[]) : [];
  } catch {
    selected = [];
  }
  const { me } = useSession();
  const studentId = me.status === 'ready' ? me.me.profile.student_id : null;
  const defs = useApi(['student', 'custom-field-defs'], () => adminCustomFields.list('student'));
  const data = useApi(studentId ? ['student', 'self-record', studentId] : null, ([, , id]) => adminStudents.get(undefined, id as string));
  const s = data.data as unknown as Record<string, unknown> | undefined;

  const labelOf = (f: string) => {
    if (f.startsWith('custom_')) {
      const d = (defs.data ?? []).find((x) => x.field_key === f.slice(7));
      return d ? (i18n.language === 'ar' && d.label_ar ? d.label_ar : d.label) : f.slice(7);
    }
    return k(`f_${f}`, { defaultValue: f });
  };
  const valueOf = (f: string) => {
    if (!s) return '-';
    if (f.startsWith('custom_')) {
      const v = (s.custom_fields as Record<string, unknown> | undefined)?.[f.slice(7)];
      return v != null ? String(v) : '-';
    }
    if (f === 'is_active') return s[f] ? k('active') : k('inactive');
    if (f === 'created_at') return s[f] ? formatDate(String(s[f])) : '-';
    return s[f] != null ? String(s[f]) : '-';
  };

  async function exportCsv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = `﻿${selected.map(labelOf).join(',')}\n${selected.map((f) => q(valueOf(f))).join(',')}`;
    await shareTextFile(`my_report_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    toast.success(k('exported'));
  }

  if (data.isLoading) {
    return (
      <View className="bg-background flex-1" accessibilityLabel={k('loading')}>
        <LoadingList rows={6} />
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: k('title'), headerRight: () => (s ? <HeaderButton icon={FileDown} label={k('export')} onPress={exportCsv} /> : null) }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{k('results_sub')}</Text>
        {data.error ? <Text className="text-destructive text-sm">{data.error.message || k('failed')}</Text> : null}
        <Section title={k('data')}>
          <Text className="text-muted-foreground -mt-1 text-xs">{k('count', { count: selected.length })}</Text>
          {!s ? (
            <EmptyState title={k('none')} />
          ) : (
            <Panel>
              {selected.map((f, i) => (
                <View key={f} className={i < selected.length - 1 ? 'border-info-soft dark:border-border flex-row justify-between gap-3 border-b px-4 py-3' : 'flex-row justify-between gap-3 px-4 py-3'}>
                  <Text className="text-muted-foreground flex-1 text-sm">{labelOf(f)}</Text>
                  <Text className="flex-1 text-end text-sm font-semibold">{valueOf(f)}</Text>
                </View>
              ))}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
