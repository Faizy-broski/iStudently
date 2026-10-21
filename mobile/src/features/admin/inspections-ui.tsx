import type { InspectionHeatmapRow } from '@studently/api-client';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

function cellCls(score: number | undefined) {
  if (score === undefined) return 'bg-muted text-muted-foreground';
  if (score >= 80) return 'bg-success-soft text-success';
  if (score >= 60) return 'bg-success-soft text-success';
  if (score >= 40) return 'bg-warning-soft text-warning';
  return 'bg-destructive-soft text-destructive';
}

/** Teacher × category average scores (web: ScoreHeatmap). */
export function ScoreHeatmap({ rows, emptyLabel }: { rows: InspectionHeatmapRow[]; emptyLabel: string }) {
  if (!rows.length) return <Text variant="muted" className="py-6 text-center text-sm">{emptyLabel}</Text>;
  const cats = [...new Set(rows.flatMap((r) => Object.keys(r.scoresByCategory)))];
  return (
    <ScrollView horizontal>
      <View>
        <View className="flex-row">
          <View className="w-36" />
          {cats.map((c) => (
            <Text key={c} className="text-muted-foreground w-20 p-2 text-center text-xs font-medium" numberOfLines={2}>
              {c}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.label} className="border-border flex-row border-t">
            <Text className="w-36 p-2 text-xs font-medium" numberOfLines={2}>
              {r.label}
            </Text>
            {cats.map((c) => {
              const s = r.scoresByCategory[c];
              const [bg, fg] = cellCls(s).split(' ');
              return (
                <View key={c} className={cn('w-20 items-center justify-center p-2', bg)}>
                  <Text className={cn('text-xs font-semibold', fg)}>{s !== undefined ? Math.round(s) : '—'}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
