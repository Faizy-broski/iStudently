import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="text-muted-foreground mt-3">{k('loading')}</Text>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1">
            {k('results_sub')}
          </Text>
          <Button variant="outline" onPress={exportCsv} disabled={!s}>
            <Icon as={FileDown} className="size-4" />
            <Text>{k('export')}</Text>
          </Button>
        </View>
        {data.error ? <Text className="text-sm text-red-600">{data.error.message || k('failed')}</Text> : null}
        <Card>
          <CardHeader>
            <CardTitle>{k('data')}</CardTitle>
            <CardDescription>{k('count', { count: selected.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {!s ? (
              <Text className="text-muted-foreground py-6 text-center">{k('none')}</Text>
            ) : (
              selected.map((f) => (
                <View key={f} className="border-border flex-row justify-between gap-3 border-b py-2">
                  <Text className="text-muted-foreground flex-1 text-sm">{labelOf(f)}</Text>
                  <Text className="flex-1 text-end text-sm font-medium">{valueOf(f)}</Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
