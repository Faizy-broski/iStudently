import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BarChart, PieChart } from '@/components/app/charts';
import { FilterChips } from '@/components/app/filter-chips';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Recharts palette used by the web report pages. */
export const REPORT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff7c7c', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1', '#a4262c'];

export const monthKey = (d: string) => d.slice(0, 7);
/** School year starts in September (same as the web reports). */
export const schoolYearKey = (d: string) => {
  const y = Number(d.slice(0, 4));
  return Number(d.slice(5, 7)) >= 9 ? String(y) : String(y - 1);
};

export function monthRange(start: string, end: string) {
  const out: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((m = 1), y++) : m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  return out;
}

export function yearRange(start: string, end: string) {
  const out: string[] = [];
  for (let y = Number(start); y <= Number(end); y++) out.push(String(y));
  return out;
}

export function monthLabel(ym: string, locale: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
}

export const yearLabel = (y: string) => `${y}–${Number(y) + 1}`;

type View3 = 'column' | 'pie' | 'list';

/** Option counts as Column / Pie / List tabs (the web's breakdown reports). */
export function CountsBreakdown({
  data,
  labels,
  nameHeader,
  valueHeader,
}: {
  data: { name: string; value: number }[];
  labels: { column: string; pie: string; list: string; total: string };
  nameHeader: string;
  valueHeader: string;
}) {
  const [tab, setTab] = useState<View3>('column');
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <View className="gap-4">
      <FilterChips<View3>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'column', label: labels.column },
          { value: 'pie', label: labels.pie },
          { value: 'list', label: labels.list },
        ]}
      />
      {tab === 'column' ? (
        <BarChart categories={data.map((d) => d.name)} series={[{ name: '', values: data.map((d) => d.value) }]} />
      ) : tab === 'pie' ? (
        <PieChart data={data.map((d, i) => ({ ...d, color: REPORT_COLORS[i % REPORT_COLORS.length] }))} />
      ) : (
        <View>
          <View className="border-border flex-row border-b py-2">
            <Text className="flex-1 font-medium">{nameHeader}</Text>
            <Text className="font-medium">{valueHeader}</Text>
          </View>
          {data.map((d) => (
            <View key={d.name} className="border-border flex-row border-b py-2">
              <Text className="flex-1">{d.name}</Text>
              <Text className="font-medium">{d.value}</Text>
            </View>
          ))}
          <View className="border-foreground flex-row border-t-2 py-2">
            <Text className="flex-1 font-semibold">{labels.total}</Text>
            <Text className="font-semibold">{total}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** Option counts per period as a grouped Column chart or a List table (the web's "over time" reports). */
export function TimeSeriesBreakdown({
  periods,
  options,
  counts,
  labels,
  optionHeader,
}: {
  periods: { key: string; label: string }[];
  options: string[];
  counts: Record<string, Record<string, number>>;
  labels: { column: string; list: string };
  optionHeader: string;
}) {
  const [tab, setTab] = useState<'column' | 'list'>('column');
  return (
    <View className="gap-4">
      <FilterChips<'column' | 'list'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'column', label: labels.column },
          { value: 'list', label: labels.list },
        ]}
      />
      {tab === 'column' ? (
        <BarChart
          categories={periods.map((p) => p.label)}
          series={options.map((o, i) => ({ name: o, color: REPORT_COLORS[i % REPORT_COLORS.length], values: periods.map((p) => counts[p.key]?.[o] ?? 0) }))}
          height={300}
        />
      ) : (
        <ScrollView horizontal>
          <View>
            <View className="border-border flex-row border-b">
              <Text className="w-36 py-2 font-medium">{optionHeader}</Text>
              {periods.map((p) => (
                <Text key={p.key} className="w-16 py-2 text-center text-xs font-medium">
                  {p.label}
                </Text>
              ))}
            </View>
            {options.map((o, i) => (
              <View key={o} className={cn('border-border flex-row border-b', i % 2 === 1 && 'bg-muted/30')}>
                <Text className="w-36 py-2 font-medium" numberOfLines={2}>
                  {o}
                </Text>
                {periods.map((p) => (
                  <Text key={p.key} className="w-16 py-2 text-center">
                    {counts[p.key]?.[o] ?? 0}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
