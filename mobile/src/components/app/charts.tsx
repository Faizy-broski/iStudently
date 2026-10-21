import { useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { chartPalette, useColors } from '@/lib/colors';

/** Same series palette as the web charts. */
/** Series colour for index i (the chart palette from src/global.css, repeating). */
export const chartColor = (i: number) => {
  const p = chartPalette();
  return p[i % p.length];
};

export interface ChartSeries {
  name: string;
  values: number[];
  color?: string;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function useChartColors() {
  const c = useColors();
  return { text: c.mutedForeground, grid: c.border };
}

export function ChartLegend({ series }: { series: { name: string; color?: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s, i) => (
        <View key={`${s.name}-${i}`} className="flex-row items-center gap-1.5">
          <View className="size-3 rounded-sm" style={{ backgroundColor: s.color ?? chartColor(i) }} />
          <Text className="text-xs">{s.name}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Vertical bar chart (grouped, or stacked with `stacked`). Scrolls sideways when there are
 * more categories than fit; tap a bar to see its value.
 */
export function BarChart({ categories, series, stacked, height = 260, yLabel }: { categories: string[]; series: ChartSeries[]; stacked?: boolean; height?: number; yLabel?: string }) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const palette = series.map((s, i) => s.color ?? chartColor(i));
  const totals = categories.map((_, ci) => (stacked ? series.reduce((sum, s) => sum + (s.values[ci] ?? 0), 0) : Math.max(0, ...series.map((s) => s.values[ci] ?? 0))));
  const max = niceMax(Math.max(0, ...totals));
  const left = 34;
  const bottom = 34;
  const top = 8;
  const plotH = height - bottom - top;
  const perCat = stacked ? 34 : Math.max(26, series.length * 14 + 12);
  const chartW = Math.max(width, left + categories.length * perCat + 8);
  const slot = (chartW - left - 8) / Math.max(1, categories.length);
  const barW = stacked ? Math.min(28, slot * 0.6) : Math.min(18, (slot * 0.8) / Math.max(1, series.length));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <View className="gap-2" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {yLabel ? <Text className="text-muted-foreground text-xs">{yLabel}</Text> : null}
      {width > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
          <Svg width={chartW} height={height}>
            {ticks.map((tv) => (
              <G key={tv}>
                <Line x1={left} x2={chartW - 4} y1={y(tv)} y2={y(tv)} stroke={colors.grid} strokeDasharray="3 3" />
                <SvgText x={left - 4} y={y(tv) + 3} fontSize={9} fill={colors.text} textAnchor="end">
                  {Number.isInteger(tv) ? tv : tv.toFixed(1)}
                </SvgText>
              </G>
            ))}
            {categories.map((cat, ci) => {
              const cx = left + slot * ci + slot / 2;
              let acc = 0;
              return (
                <G key={`${cat}-${ci}`}>
                  {series.map((s, si) => {
                    const v = s.values[ci] ?? 0;
                    if (!v) return null;
                    const x = stacked ? cx - barW / 2 : cx - (barW * series.length) / 2 + si * barW;
                    const y0 = stacked ? y(acc + v) : y(v);
                    const h = stacked ? y(acc) - y(acc + v) : y(0) - y(v);
                    if (stacked) acc += v;
                    return <Rect key={si} x={x} y={y0} width={Math.max(1, barW - (stacked ? 0 : 2))} height={Math.max(0.5, h)} fill={palette[si]} rx={2} onPress={() => setTip(`${cat} · ${s.name}: ${Math.round(v * 10) / 10}`)} />;
                  })}
                  <SvgText x={cx} y={height - bottom + 14} fontSize={9} fill={colors.text} textAnchor="middle">
                    {cat.length > 10 ? `${cat.slice(0, 9)}…` : cat}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      ) : (
        <View style={{ height }} />
      )}
      {tip ? <Text className="text-muted-foreground text-xs">{tip}</Text> : null}
      {series.length > 1 || series[0]?.name ? <ChartLegend series={series.map((s, i) => ({ name: s.name, color: palette[i] }))} /> : null}
    </View>
  );
}

/**
 * Line chart (one line per series; `area` fills under a single series). Null values leave gaps.
 * Scrolls sideways when there are many points; tap a point to see its value.
 */
export function LineChart({ categories, series, height = 240, area }: { categories: string[]; series: { name: string; values: (number | null)[]; color?: string }[]; height?: number; area?: boolean }) {
  const colors = useChartColors();
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const palette = series.map((s, i) => s.color ?? chartColor(i));
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const left = 34;
  const bottom = 34;
  const top = 8;
  const plotH = height - bottom - top;
  const chartW = Math.max(width, left + categories.length * 40 + 8);
  const step = (chartW - left - 16) / Math.max(1, categories.length - 1);
  const x = (i: number) => left + 8 + i * step;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <View className="gap-2" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="grow-0">
          <Svg width={chartW} height={height}>
            {ticks.map((tv) => (
              <G key={tv}>
                <Line x1={left} x2={chartW - 4} y1={y(tv)} y2={y(tv)} stroke={colors.grid} strokeDasharray="3 3" />
                <SvgText x={left - 4} y={y(tv) + 3} fontSize={9} fill={colors.text} textAnchor="end">
                  {Number.isInteger(tv) ? tv : tv.toFixed(1)}
                </SvgText>
              </G>
            ))}
            {series.map((s, si) => {
              const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean) as string[];
              const firstI = s.values.findIndex((v) => v != null);
              const lastI = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v != null);
              return (
                <G key={si}>
                  {area && series.length === 1 && pts.length > 1 ? <Path d={`M${x(firstI)},${y(0)} L${pts.join(' L')} L${x(lastI)},${y(0)} Z`} fill={palette[si]} opacity={0.2} /> : null}
                  <Polyline points={pts.join(' ')} fill="none" stroke={palette[si]} strokeWidth={2} />
                  {s.values.map((v, i) => (v == null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={palette[si]} onPress={() => setTip(`${categories[i]} · ${s.name}: ${v}`)} />))}
                </G>
              );
            })}
            {categories.map((cat, i) => (
              <SvgText key={`${cat}-${i}`} x={x(i)} y={height - bottom + 14} fontSize={9} fill={colors.text} textAnchor="middle">
                {cat.length > 8 ? `${cat.slice(0, 7)}…` : cat}
              </SvgText>
            ))}
          </Svg>
        </ScrollView>
      ) : (
        <View style={{ height }} />
      )}
      {tip ? <Text className="text-muted-foreground text-xs">{tip}</Text> : null}
      {series.length > 1 ? <ChartLegend series={series.map((s, i) => ({ name: s.name, color: palette[i] }))} /> : null}
    </View>
  );
}

/** Pie/donut chart with a legend showing each slice's value and share. */
export function PieChart({ data, size = 200, donut = true }: { data: { name: string; value: number; color?: string }[]; size?: number; donut?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const inner = donut ? r * 0.55 : 0;
  const sweeps = data.map((d) => (total ? (d.value / total) * Math.PI * 2 : 0));
  const arcs = data.map((d, i) => {
    const sweep = sweeps[i];
    const a0 = -Math.PI / 2 + sweeps.slice(0, i).reduce((s, x) => s + x, 0);
    const a1 = a0 + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${r + rad * Math.cos(a)} ${r + rad * Math.sin(a)}`;
    const path =
      sweep >= Math.PI * 2 - 1e-6
        ? `M ${p(r, 0)} A ${r} ${r} 0 1 1 ${p(r, Math.PI)} A ${r} ${r} 0 1 1 ${p(r, 0)} ${inner ? `M ${p(inner, 0)} A ${inner} ${inner} 0 1 0 ${p(inner, Math.PI)} A ${inner} ${inner} 0 1 0 ${p(inner, 0)}` : ''} Z`
        : `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(inner, a1)} ${inner ? `A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)}` : ''} Z`;
    return { path, color: d.color ?? chartColor(i), d };
  });
  return (
    <View className="items-center gap-3">
      <Svg width={size} height={size}>
        {arcs.map((a, i) => (a.d.value > 0 ? <Path key={i} d={a.path} fill={a.color} fillRule="evenodd" /> : null))}
      </Svg>
      <View className="w-full gap-1">
        {arcs.map((a, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <View className="size-3 rounded-sm" style={{ backgroundColor: a.color }} />
            <Text className="flex-1 text-sm" numberOfLines={1}>
              {a.d.name}
            </Text>
            <Text className="text-sm font-medium">{`${Math.round(a.d.value * 10) / 10} (${total ? Math.round((a.d.value / total) * 100) : 0}%)`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
