import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { BarChart, PieChart } from '@/components/app/charts';
import { Segmented } from '@/components/app/segmented';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Recharts palette used by the web report pages. */
export const REPORT_COLORS = [colors.brandSecondary, colors.success, colors.brandAccent, colors.warning, colors.brandSecondary, colors.success, colors.chart8, colors.success, colors.success, colors.brandSecondary, colors.chart7, colors.destructive];

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
      <Segmented<View3>
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
        <View className="border-info-soft dark:border-border overflow-hidden rounded-2xl border">
          <View className="bg-muted/60 flex-row px-3 py-2.5">
            <Text className="text-muted-foreground flex-1 text-xs font-semibold">{nameHeader}</Text>
            <Text className="text-muted-foreground text-xs font-semibold">{valueHeader}</Text>
          </View>
          {data.map((d) => (
            <View key={d.name} className="border-info-soft dark:border-border flex-row border-t px-3 py-2.5">
              <Text className="flex-1 text-sm">{d.name}</Text>
              <Text className="text-sm font-semibold">{d.value}</Text>
            </View>
          ))}
          <View className="bg-info-soft flex-row px-3 py-2.5">
            <Text className="text-brand dark:text-brand-secondary flex-1 text-sm font-bold">{labels.total}</Text>
            <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{total}</Text>
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
      <Segmented<'column' | 'list'>
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
          <View className="border-info-soft dark:border-border overflow-hidden rounded-2xl border">
            <View className="bg-muted/60 flex-row">
              <Text className="text-muted-foreground w-36 px-3 py-2.5 text-xs font-semibold">{optionHeader}</Text>
              {periods.map((p) => (
                <Text key={p.key} className="text-muted-foreground w-16 py-2.5 text-center text-xs font-semibold">
                  {p.label}
                </Text>
              ))}
            </View>
            {options.map((o, i) => (
              <View key={o} className={cn('border-info-soft dark:border-border flex-row border-t', i % 2 === 1 && 'bg-muted/30')}>
                <Text className="w-36 px-3 py-2.5 text-sm font-medium" numberOfLines={2}>
                  {o}
                </Text>
                {periods.map((p) => (
                  <Text key={p.key} className="w-16 py-2.5 text-center text-sm">
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
