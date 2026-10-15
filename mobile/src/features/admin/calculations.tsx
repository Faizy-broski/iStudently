import type { CalcRunResult } from '@studently/api-client';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/** One calculation result: a big number, or labelled rows with optional bars (web: ResultCellView). */
export function ResultView({ result, showGraph }: { result: CalcRunResult | null; showGraph?: boolean }) {
  const fmt = (v: number | string, digits = 3) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : v);
  if (!result) return <Text className="text-muted-foreground text-xs">—</Text>;
  if (result.type === 'single') return <Text className="text-primary text-2xl font-bold">{fmt(result.value)}</Text>;
  const max = Math.max(0, ...result.rows.map((r) => (typeof r.value === 'number' ? r.value : 0)));
  return (
    <View className="gap-1.5">
      {result.rows.map((r, i) => (
        <View key={i} className="gap-0.5">
          <View className="flex-row justify-between gap-2">
            <Text className="text-muted-foreground flex-1 text-xs" numberOfLines={1}>
              {r.label}
            </Text>
            <Text className="font-mono text-xs font-medium">{fmt(r.value, 2)}</Text>
          </View>
          {showGraph && typeof r.value === 'number' && max > 0 ? (
            <View className="bg-muted h-1.5 overflow-hidden rounded-full">
              <View className="bg-primary h-full rounded-full" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
