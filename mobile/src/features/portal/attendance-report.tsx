import type { AttendanceSummaryRow } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

type Mode = 'chart' | 'absence';
const CODE: Record<string, { box: string; label: string; key: string }> = {
  present: { box: 'bg-green-100 border-green-300', label: 'P', key: 'present' },
  absent: { box: 'bg-red-100 border-red-300', label: 'A', key: 'absent' },
  late: { box: 'bg-yellow-100 border-yellow-300', label: 'L', key: 'late' },
  excused: { box: 'bg-blue-100 border-blue-300', label: 'E', key: 'excused_s' },
};
const colDate = (d: string) => {
  const x = new Date(`${d}T00:00:00`);
  return `${x.toLocaleString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'short' }).toUpperCase()} ${String(x.getDate()).padStart(2, '0')}`;
};

/** One period attendance mark: subject, period, date, status. */
export type AttendanceMark = { subject: string; period: string; date: string; status: string };
type Res<T> = { success: boolean; data?: T; error?: string };

/**
 * Daily summary (courses × dates P/A/L/E) or absence summary for a month (web: /student and
 * /parent attendance). `subtitle` names the child; `fullTable` always shows the summary table (parent).
 */
export function AttendanceView({
  loadSummary,
  loadMarks,
  subtitle,
  fullTable,
}: {
  loadSummary: (start: string, end: string) => Promise<Res<AttendanceSummaryRow | null>>;
  loadMarks: (month: number, year: number) => Promise<Res<AttendanceMark[]>>;
  subtitle?: string;
  fullTable?: boolean;
}) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_at_${key}`, o);
  const toast = useToast();
  const now = new Date();
  const [mode, setMode] = useState<Mode>('chart');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<AttendanceMark[] | null>(null);
  const [summary, setSummary] = useState<AttendanceSummaryRow | null>(null);

  async function go() {
    setLoading(true);
    setRecords(null);
    setSummary(null);
    try {
      if (mode === 'absence') {
        const mm = String(month + 1).padStart(2, '0');
        const last = new Date(year, month + 1, 0).getDate();
        const r = await loadSummary(`${year}-${mm}-01`, `${year}-${mm}-${last}`);
        if (r.success) setSummary(r.data ?? null);
        else toast.error(r.error || k('failed'));
      } else {
        const r = await loadMarks(month + 1, year);
        if (r.success && r.data) setRecords(r.data);
        else toast.error(r.error || k('failed'));
      }
    } finally {
      setLoading(false);
    }
  }

  const { courses, dates, grid } = useMemo(() => {
    if (!records) return { courses: [] as { key: string; subject: string; period: string }[], dates: [] as string[], grid: {} as Record<string, Record<string, string>> };
    const cmap = new Map<string, { key: string; subject: string; period: string }>();
    const ds = new Set<string>();
    const g: Record<string, Record<string, string>> = {};
    for (const r of records) {
      const key = `${r.subject}||${r.period}`;
      if (!cmap.has(key)) cmap.set(key, { key, subject: r.subject, period: r.period });
      ds.add(r.date);
      (g[key] ??= {})[r.date] = r.status;
    }
    return { courses: [...cmap.values()], dates: [...ds].sort(), grid: g };
  }, [records]);
  const q = search.trim().toLowerCase();
  const shown = q ? courses.filter((c) => c.subject.toLowerCase().includes(q)) : courses;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card>
          <CardHeader>
            <CardTitle>{k('title')}</CardTitle>
            {subtitle ? <Text className="text-muted-foreground text-sm">{subtitle}</Text> : null}
          </CardHeader>
          <CardContent className="gap-3">
            <Picker
              value={mode}
              onChange={(v) => {
                setMode(v as Mode);
                setRecords(null);
                setSummary(null);
                setSearch('');
              }}
              options={[
                { value: 'chart', label: k('daily') },
                { value: 'absence', label: k('absence') },
              ]}
            />
            <Text className="text-sm font-medium">{k('timeframe')}</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Picker value={String(month)} onChange={(v) => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: t(`common.months.${i}`) }))} />
              </View>
              <View className="w-24">
                <Picker value={String(year)} onChange={(v) => setYear(Number(v))} options={[now.getFullYear() - 1, now.getFullYear()].map((y) => ({ value: String(y), label: String(y) }))} />
              </View>
              <Button onPress={go} disabled={loading}>
                <Text>{k('go')}</Text>
              </Button>
            </View>

            {mode === 'chart' && records !== null ? (
              <View className="gap-2">
                <Text className="text-muted-foreground text-sm">{k('courses_found', { count: shown.length })}</Text>
                <SearchBar value={search} onChangeText={setSearch} placeholder={k('search')} />
              </View>
            ) : null}
            {loading ? <LoadingList rows={3} /> : null}

            {!loading && mode === 'chart' && records !== null ? (
              dates.length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-sm">{k('no_records')}</Text>
              ) : (
                <ScrollView horizontal className="border-border rounded-md border">
                  <View>
                    <View className="bg-muted/40 flex-row">
                      <Text className="text-primary w-40 p-2 text-xs font-bold">{k('course')}</Text>
                      <Text className="text-primary w-24 p-2 text-xs font-bold">{k('period')}</Text>
                      {dates.map((d) => (
                        <Text key={d} className="w-14 p-2 text-center text-[11px] font-bold">
                          {colDate(d)}
                        </Text>
                      ))}
                    </View>
                    {shown.length === 0 ? (
                      <Text className="text-muted-foreground p-6 text-sm">{k('no_match')}</Text>
                    ) : (
                      shown.map((c) => (
                        <View key={c.key} className="border-border flex-row items-center border-t">
                          <Text className="w-40 p-2 font-medium">{c.subject}</Text>
                          <Text className="text-muted-foreground w-24 p-2 text-sm">{c.period}</Text>
                          {dates.map((d) => {
                            const st = grid[c.key]?.[d];
                            const cfg = st ? (CODE[st] ?? { box: 'bg-muted border-border', label: st[0].toUpperCase(), key: '' }) : null;
                            return (
                              <View key={d} className="w-14 items-center p-1">
                                {cfg ? (
                                  <View className={cn('size-7 items-center justify-center rounded border', cfg.box)} accessibilityLabel={cfg.key ? k(cfg.key) : st}>
                                    <Text className="text-xs font-bold text-gray-800">{cfg.label}</Text>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              )
            ) : null}

            {!loading && mode === 'absence' && summary ? (
              <View className="gap-3">
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: k('state_abs'), value: summary.days_absent + summary.days_half, cls: 'text-red-700' },
                    { label: k('absent'), value: summary.days_absent, cls: 'text-red-600' },
                    { label: k('half'), value: summary.days_half, cls: 'text-yellow-700' },
                    { label: k('present'), value: summary.days_present, cls: 'text-green-700' },
                  ].map((s) => (
                    <View key={s.label} className="border-border bg-muted/20 min-w-[45%] flex-1 items-center rounded-md border p-3">
                      <Text className="text-muted-foreground text-xs uppercase">{s.label}</Text>
                      <Text className={cn('text-2xl font-bold', s.cls)}>{String(s.value)}</Text>
                    </View>
                  ))}
                </View>
                {fullTable || (summary.state_code_breakdown && Object.keys(summary.state_code_breakdown).length) ? (
                  <View className="border-border gap-1 rounded-md border p-3">
                    {[
                      [k('student'), summary.student_name],
                      [k('student_id'), summary.student_number || '—'],
                      [k('grade'), summary.grade_name || '—'],
                      [k('state_abs'), String(summary.days_absent + summary.days_half)],
                      [k('absent'), String(summary.days_absent)],
                      [k('tardy'), String(summary.state_code_breakdown?.['Late'] ?? summary.state_code_breakdown?.['Tardy'] ?? 0)],
                      [k('excused'), String(summary.state_code_breakdown?.['Excused Absence'] ?? summary.state_code_breakdown?.['Excused'] ?? 0)],
                    ].map(([l, v]) => (
                      <View key={l} className="flex-row justify-between">
                        <Text className="text-primary text-xs font-bold">{l}</Text>
                        <Text className="text-sm">{v}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text className="text-muted-foreground text-end text-sm">{k('pct', { pct: summary.attendance_percentage, days: summary.total_days })}</Text>
              </View>
            ) : null}
            {!loading && mode === 'absence' && !summary ? <Text className="text-muted-foreground py-4 text-center text-sm">{k('no_absence')}</Text> : null}

            {!loading && records === null && summary === null ? <Text className="text-muted-foreground py-8 text-center text-sm">{k('pick')}</Text> : null}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
