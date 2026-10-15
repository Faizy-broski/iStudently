import { Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, FileDown, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { adminCustomFields, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { shareTextFile } from '@/lib/share-file';

/** The chosen fields for every student of the school: search, sort by a column, CSV export (web: /librarian/students/advanced-report/results). */
export default function LibrarianReportResults() {
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
  const report = useApi(['librarian', 'students-report'], () => adminStudents.report());
  const defs = useApi(['portal', 'custom-field-defs', 'student'], () => adminCustomFields.list('student'));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);
  const q = query.trim().toLowerCase();
  const rows = (report.data ?? []).filter((r) => !q || Object.values(r).some((v) => String(v).toLowerCase().includes(q)));

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

  const shown = sort
    ? [...rows].sort((a, b) => {
        const c = valueOf(a, sort.field).localeCompare(valueOf(b, sort.field), i18n.language, { numeric: true });
        return sort.dir === 'asc' ? c : -c;
      })
    : rows;

  async function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = `﻿${selected.map(labelOf).join(',')}\n${shown.map((r) => selected.map((f) => cell(valueOf(r, f))).join(',')).join('\n')}`;
    await shareTextFile(`students_report_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    toast.success(k('exported'));
  }

  if (report.isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t('app.pa_ar_results') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => report.mutate()} />}>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1">
            {t('common.found_students', { count: rows.length })}
          </Text>
          <Button variant="outline" onPress={exportCsv} disabled={!rows.length}>
            <Icon as={FileDown} className="size-4" />
            <Text>{k('export')}</Text>
          </Button>
        </View>
        {report.error ? <Text className="text-sm text-red-600">{report.error.message}</Text> : null}
        <Card>
          <CardHeader>
            <CardTitle>{k('data')}</CardTitle>
            <CardDescription>{k('count', { count: selected.length })}</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="justify-center">
              <Icon as={Search} className="text-muted-foreground absolute start-3 size-4" />
              <Input className="ps-9" value={query} onChangeText={setQuery} placeholder={t('common.search')} />
            </View>
            <View className="flex-row items-center gap-2">
              <Picker
                className="flex-1"
                value={sort?.field ?? null}
                onChange={(f) => setSort({ field: f, dir: sort?.dir ?? 'asc' })}
                placeholder={t('app.li_sort_by')}
                options={selected.map((f) => ({ value: f, label: labelOf(f) }))}
              />
              <Button size="icon" variant="outline" disabled={!sort} onPress={() => sort && setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })} accessibilityLabel={t('app.li_sort_direction')}>
                <Icon as={sort?.dir === 'desc' ? ChevronDown : ChevronUp} className="size-4" />
              </Button>
            </View>
            {!rows.length ? (
              <Text className="text-muted-foreground py-6 text-center">{t('app.pa_ar_none')}</Text>
            ) : (
              shown.map((r) => (
                <View key={String(r.id)} className="border-border rounded-lg border px-3 py-1">
                  {selected.map((f) => (
                    <View key={f} className="border-border flex-row justify-between gap-3 border-b py-2 last:border-b-0">
                      <Text className="text-muted-foreground flex-1 text-sm">{labelOf(f)}</Text>
                      <Text className="flex-1 text-end text-sm font-medium">{valueOf(r, f)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
