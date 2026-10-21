import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown, Search, Table2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { FormSection } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { useTeacherStudents } from '@/features/teacher/students';
import { adminCustomFields, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { shareTextFile } from '@/lib/share-file';

/**
 * The chosen fields for the teacher's students, searchable, exportable as CSV (web:
 * /teacher/students/advanced-report/results). The web lists every student of the school; the app
 * keeps to the teacher's own sections like the rest of the teacher's student pages.
 */
export default function TeacherReportResults() {
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
  const mine = useTeacherStudents(true);
  const report = useApi(['teacher', 'students-report'], () => adminStudents.report());
  const defs = useApi(['portal', 'custom-field-defs', 'student'], () => adminCustomFields.list('student'));
  const [query, setQuery] = useState('');
  const own = new Set((mine.data ?? []).map((s) => s.id));
  const q = query.trim().toLowerCase();
  const rows = (report.data ?? []).filter((r) => own.has(String(r.id))).filter((r) => !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q)));

  const labelOf = (f: string) => {
    if (f.startsWith('custom_')) {
      const d = (defs.data ?? []).find((x) => x.field_key === f.slice(7));
      return d ? (i18n.language === 'ar' && d.label_ar ? d.label_ar : d.label) : f.slice(7);
    }
    return k(`f_${f}`, { defaultValue: f });
  };
  const valueOf = (r: Record<string, unknown>, f: string) => {
    if (f.startsWith('custom_')) {
      const v = (r.custom_fields as Record<string, unknown> | undefined)?.[f.slice(7)];
      return v != null ? String(v) : '-';
    }
    if (f === 'is_active') return r[f] ? k('active') : k('inactive');
    if (f === 'created_at') return r[f] ? formatDate(String(r[f])) : '-';
    return r[f] != null ? String(r[f]) : '-';
  };

  async function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = `﻿${selected.map(labelOf).join(',')}\n${rows.map((r) => selected.map((f) => cell(valueOf(r, f))).join(',')).join('\n')}`;
    await shareTextFile(`students_report_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    toast.success(k('exported'));
  }

  if (report.isLoading || mine.isLoading) {
    return (
      <View className="bg-background flex-1">
        <LoadingList rows={5} />
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t('app.pa_ar_results') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => report.mutate()} />}>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1 text-sm">
            {t('common.found_students', { count: rows.length })}
          </Text>
          <Button size="sm" variant="outline" className="rounded-full" onPress={exportCsv} disabled={!rows.length}>
            <Icon as={FileDown} className="text-brand dark:text-brand-secondary size-4" />
            <Text>{k('export')}</Text>
          </Button>
        </View>
        {report.error ? <ErrorState message={report.error.message} onRetry={() => report.mutate()} /> : null}
        <FormSection title={k('data')} description={k('count', { count: selected.length })} icon={Table2}>
          <View className="justify-center">
            <Icon as={Search} className="text-muted-foreground absolute start-3 size-4" />
            <Input className="ps-9" value={query} onChangeText={setQuery} placeholder={t('common.search')} />
          </View>
        </FormSection>
        {!rows.length ? (
          <EmptyState icon={Search} title={t('app.pa_ar_none')} />
        ) : (
          rows.map((r) => (
            <Panel key={String(r.id)} className="px-4 py-1">
              {selected.map((f, i) => (
                <View key={f} className={i < selected.length - 1 ? 'border-info-soft dark:border-border flex-row justify-between gap-3 border-b py-2.5' : 'flex-row justify-between gap-3 py-2.5'}>
                  <Text variant="muted" className="flex-1 text-xs">
                    {labelOf(f)}
                  </Text>
                  <Text className="flex-1 text-end text-sm font-medium">{valueOf(r, f)}</Text>
                </View>
              ))}
            </Panel>
          ))
        )}
      </ScrollView>
    </>
  );
}
