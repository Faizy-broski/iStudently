import type { ParentStudent } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useChild } from '@/features/parent/child';
import { adminCustomFields } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';

// Web: the parent report reads the children list, so only these standard fields have values; custom fields show '-'.
const FIELD_MAP: Record<string, keyof ParentStudent> = {
  student_number: 'student_number',
  first_name: 'first_name',
  last_name: 'last_name',
  grade_level_name: 'grade_level',
  section_name: 'section',
};

/** The linked children for the chosen fields, searchable, exportable as CSV (web: /parent/students/advanced-report/results). */
export default function ParentReportResults() {
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
  const { children: kids, isLoading } = useChild();
  const defs = useApi(['portal', 'custom-field-defs', 'student'], () => adminCustomFields.list('student'));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = q ? kids.filter((s) => Object.values(s).some((v) => String(v).toLowerCase().includes(q))) : kids;

  const labelOf = (f: string) => {
    if (f.startsWith('custom_')) {
      const d = (defs.data ?? []).find((x) => x.field_key === f.slice(7));
      return d ? (i18n.language === 'ar' && d.label_ar ? d.label_ar : d.label) : f.slice(7);
    }
    return k(`f_${f}`, { defaultValue: f });
  };
  const valueOf = (s: ParentStudent, f: string) => {
    const key = FIELD_MAP[f];
    const v = key ? s[key] : null;
    return v != null ? String(v) : '-';
  };

  async function exportCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = `﻿${selected.map(labelOf).join(',')}\n${rows.map((s) => selected.map((f) => cell(valueOf(s, f))).join(',')).join('\n')}`;
    await shareTextFile(`children_report_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    toast.success(k('exported'));
  }

  if (isLoading) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="text-muted-foreground mt-3">{t('app.pa_ar_loading')}</Text>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: t('app.pa_ar_results') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1">
            {t('app.pa_ar_found', { count: rows.length })}
          </Text>
          <Button variant="outline" onPress={exportCsv} disabled={!rows.length}>
            <Icon as={FileDown} className="size-4" />
            <Text>{k('export')}</Text>
          </Button>
        </View>
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
            {!rows.length ? (
              <Text className="text-muted-foreground py-6 text-center">{t('app.pa_ar_none')}</Text>
            ) : (
              rows.map((s) => (
                <View key={s.id} className="border-border rounded-lg border px-3 py-1">
                  {selected.map((f) => (
                    <View key={f} className="border-border flex-row justify-between gap-3 border-b py-2 last:border-b-0">
                      <Text className="text-muted-foreground flex-1 text-sm">{labelOf(f)}</Text>
                      <Text className="flex-1 text-end text-sm font-medium">{valueOf(s, f)}</Text>
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
