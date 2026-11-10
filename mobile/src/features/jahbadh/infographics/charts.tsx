// SVG charts of «إنفوجرافيك جهبذ» for the app (port of the web charts), drawn with react-native-svg.
import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/lib/colors';

import { fmtNum, inf, lvColor, lvLight, niceStep, plex, round2 } from './palette';

type Scale = { min: number; label: string }[];

interface TxProps {
  x: number;
  y: number;
  children: ReactNode;
  s?: number;
  w?: number;
  c?: string;
  /** Physical anchor: 'start' = text begins at x (extends right), 'end' = text ends at x (extends left). */
  a?: 'start' | 'middle' | 'end';
}
function Tx({ x, y, children, s = 11, w = 400, c, a = 'middle' }: TxProps) {
  return (
    <SvgText x={round2(x)} y={round2(y)} fontFamily={plex(w)} fontSize={s} fill={c ?? inf('Slate')} textAnchor={a}>
      {children}
    </SvgText>
  );
}

// ---- icons: the same path strings as the web, parsed into primitives ------------------------------------------
const PATHS: Record<string, string> = {
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 14.2c2.6.1 4.4 1.7 4.9 4.6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  trophy: '<path d="M7 4h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 6H4.2c0 2.6 1.3 4 3.3 4.3M17 6h2.8c0 2.6-1.3 4-3.3 4.3"/><path d="M12 13.5V17M8.5 20h7M9.5 17h5v3h-5z"/>',
  up: '<path d="M4 17l5.5-5.5 3.5 3.5L20 8"/><path d="M14.5 8H20v5.5"/>',
  down: '<path d="M4 7l5.5 5.5 3.5-3.5L20 16"/><path d="M14.5 16H20v-5.5"/>',
  scale: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.6 6a3 3 0 0 0 5.2 0z"/><path d="M19 7l-2.6 6a3 3 0 0 0 5.2 0z"/>',
  bell: '<path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.6 2H4.9z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  bars: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/><path d="M3 20.5h18.5"/>',
  bulb: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1v.6h5.2v-.6c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  book: '<path d="M4 5.5C6.5 4.3 9.3 4.3 12 6c2.7-1.7 5.5-1.7 8-.5V19c-2.5-1.2-5.3-1.2-8 .5-2.7-1.7-5.5-1.7-8-.5z"/><path d="M12 6v13.5"/>',
  sigma: '<path d="M17 5H7l6 7-6 7h10"/>',
  spread: '<path d="M3 18c3 0 4-11 9-11s6 11 9 11"/><path d="M12 7v11"/>',
  median: '<path d="M4 18h16"/><path d="M7 18V9M12 18V5M17 18v-6"/>',
  mode: '<path d="M4 20V14M9 20V8M14 20V4M19 20V11"/><circle cx="14" cy="4" r="1.3"/>',
  top: '<path d="M12 4l3.5 6H8.5z"/><path d="M12 10v10"/>',
  low: '<path d="M12 20l3.5-6H8.5z"/><path d="M12 4v10"/>',
  pct: '<circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/><path d="M18.5 5.5l-13 13"/>',
  alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  door: '<path d="M6 21V4h9l3 2v15"/><path d="M4 21h16"/><circle cx="13.5" cy="13" r=".9"/>',
  seed: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3.3-2.5-6-6-6 0 3.3 2.5 6 6 6z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.6"/><path d="M12 17v.3"/>',
};

type Prim = { tag: 'circle' | 'path' | 'rect'; a: Record<string, string> };
const PARSED: Record<string, Prim[]> = Object.fromEntries(
  Object.entries(PATHS).map(([k, markup]) => [
    k,
    [...markup.matchAll(/<(circle|path|rect)\s([^>]*?)\/>/g)].map((m) => ({
      tag: m[1] as Prim['tag'],
      a: Object.fromEntries([...m[2].matchAll(/([a-z]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])),
    })),
  ]),
);

export type InfIcon = keyof typeof PATHS;

export function Ico({ name, color, size = 20 }: { name: InfIcon; color?: string; size?: number }) {
  const stroke = color ?? inf('Ink');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {(PARSED[name] ?? []).map((p, i) =>
        p.tag === 'circle' ? (
          <Circle key={i} cx={Number(p.a.cx)} cy={Number(p.a.cy)} r={Number(p.a.r)} />
        ) : p.tag === 'rect' ? (
          <Rect key={i} x={Number(p.a.x)} y={Number(p.a.y)} width={Number(p.a.width)} height={Number(p.a.height)} rx={Number(p.a.rx ?? 0)} />
        ) : (
          <Path key={i} d={p.a.d} />
        ),
      )}
    </Svg>
  );
}

// ---- gauge ----------------------------------------------------------------------------------------------------
export function Gauge({ pct, scale, w = 250, h = 138 }: { pct: number; scale: Scale; w?: number; h?: number }) {
  const cx = w / 2;
  const cy = h - 22;
  const R = Math.min(w / 2 - 14, h - 36);
  const th = 22;
  const ang = (p: number) => Math.PI * (1 - Math.max(0, Math.min(1, p)));
  const pt = (p: number, rr: number): [number, number] => [cx + rr * Math.cos(ang(p)), cy - rr * Math.sin(ang(p))];
  const [nx, ny] = pt(pct, R - th - 8);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {scale.map((lv, i) => {
        const a = lv.min / 100;
        const b = i + 1 < scale.length ? scale[i + 1].min / 100 : 1;
        const [x1, y1] = pt(a, R);
        const [x2, y2] = pt(b, R);
        const [x3, y3] = pt(b, R - th);
        const [x4, y4] = pt(a, R - th);
        const large = b - a > 0.5 ? 1 : 0;
        const [tx, ty] = pt(a, R + 9);
        return (
          <G key={i}>
            <Path
              d={`M${round2(x1)} ${round2(y1)} A${R} ${R} 0 ${large} 1 ${round2(x2)} ${round2(y2)} L${round2(x3)} ${round2(y3)} A${R - th} ${R - th} 0 ${large} 0 ${round2(x4)} ${round2(y4)}Z`}
              fill={lvColor(i, scale.length)}
              opacity={0.92}
            />
            {i > 0 ? (
              <Tx x={tx} y={ty + 3} s={10} c={inf('Mute')} w={600}>
                {String(lv.min)}
              </Tx>
            ) : null}
          </G>
        );
      })}
      <Line x1={cx} y1={cy} x2={round2(nx)} y2={round2(ny)} stroke={inf('Ink')} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={8} fill={inf('Ink')} />
      <Circle cx={cx} cy={cy} r={3} fill={inf('Gold')} />
      <Tx x={cx - R + th / 2} y={cy + 16} s={10} c={inf('Mute')} w={600}>
        0
      </Tx>
      <Tx x={cx + R - th / 2} y={cy + 16} s={10} c={inf('Mute')} w={600}>
        100
      </Tx>
    </Svg>
  );
}

// ---- donut ----------------------------------------------------------------------------------------------------
export interface DonutPart {
  count: number;
  color: string;
}
export function Donut({ parts, size = 152, center, sub }: { parts: DonutPart[]; size?: number; center?: string; sub?: string }) {
  const n = parts.reduce((a, l) => a + l.count, 0);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 4;
  const r = R - 30;
  let a0 = -Math.PI / 2;
  const out: ReactNode[] = [];
  if (!n) out.push(<Circle key="empty" cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={inf('Hair')} strokeWidth={R - r} />);
  parts.forEach((l, i) => {
    if (!l.count) return;
    const f = l.count / n;
    const a1 = a0 + f * Math.PI * 2;
    if (f >= 0.9999) {
      out.push(<Circle key={i} cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={l.color} strokeWidth={R - r} />);
    } else {
      const L = f > 0.5 ? 1 : 0;
      const p = (a: number, rr: number): [number, number] => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      const [x1, y1] = p(a0, R);
      const [x2, y2] = p(a1, R);
      const [x3, y3] = p(a1, r);
      const [x4, y4] = p(a0, r);
      out.push(
        <Path
          key={i}
          d={`M${round2(x1)} ${round2(y1)} A${R} ${R} 0 ${L} 1 ${round2(x2)} ${round2(y2)} L${round2(x3)} ${round2(y3)} A${r} ${r} 0 ${L} 0 ${round2(x4)} ${round2(y4)}Z`}
          fill={l.color}
          stroke={colors.white}
          strokeWidth={2}
        />,
      );
      if (f >= 0.06) {
        const [tx, ty] = p((a0 + a1) / 2, (R + r) / 2);
        out.push(
          <Tx key={`t${i}`} x={tx} y={ty + 4} s={11} c={colors.white} w={700}>
            {`${Math.round(f * 100)}%`}
          </Tx>,
        );
      }
    }
    a0 = a1;
  });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {out}
      {center !== undefined ? (
        <Tx x={cx} y={cy + 6} s={26} c={inf('Ink')} w={800}>
          {center}
        </Tx>
      ) : null}
      {sub ? (
        <Tx x={cx} y={cy + 24} s={11}>
          {sub}
        </Tx>
      ) : null}
    </Svg>
  );
}

// ---- ruler (the hero chart) ------------------------------------------------------------------------------------
export interface RulerProps {
  w?: number;
  h?: number;
  max: number;
  scale: Scale;
  points: { v: number; li: number }[];
  mean?: number | null;
  pass?: number;
  pctScale?: boolean;
  dot?: number;
}
export function Ruler(o: RulerProps) {
  const w = o.w ?? 1050;
  const h = o.h ?? 182;
  const pad = 24;
  const top = 34;
  const base = h - 34;
  const X = (v: number) => pad + (w - 2 * pad) * (v / o.max);
  const step = niceStep(o.max);
  const ticks: number[] = [];
  for (let v = 0; v <= o.max + 1e-9; v += step) ticks.push(v);
  const rad = o.dot ?? 7.5;
  const gap = rad * 2 + 1.5;
  const cols: Record<number, number> = {};
  const pts = [...o.points].sort((a, b) => a.v - b.v);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {o.scale.map((lv, i) => {
        const a = (lv.min / 100) * o.max;
        const b = i + 1 < o.scale.length ? (o.scale[i + 1].min / 100) * o.max : o.max;
        const col = lvColor(i, o.scale.length);
        return (
          <G key={i}>
            <Rect x={round2(X(a))} y={top} width={round2(X(b) - X(a))} height={base - top} fill={lvLight(i, o.scale.length)} />
            <Rect x={round2(X(a))} y={base} width={round2(X(b) - X(a))} height={8} fill={col} />
            <Tx x={(X(a) + X(b)) / 2} y={top - 10} s={12.5} w={700} c={col}>
              {lv.label}
            </Tx>
          </G>
        );
      })}
      {ticks.map((v) => (
        <G key={v}>
          <Line x1={round2(X(v))} y1={base + 8} x2={round2(X(v))} y2={base + 13} stroke={inf('Mute')} />
          <Tx x={X(v)} y={base + 25} s={10.5} w={600}>
            {fmtNum(v, o.pctScale)}
          </Tx>
        </G>
      ))}
      {pts.map((p, i) => {
        const x = X(p.v);
        const k = Math.round(x / gap);
        cols[k] = (cols[k] || 0) + 1;
        const y = base - rad - 3 - (cols[k] - 1) * (gap - 2);
        return <Circle key={i} cx={round2(x)} cy={round2(y)} r={rad} fill={lvColor(p.li, o.scale.length)} stroke={colors.white} strokeWidth={1.5} />;
      })}
      {o.pass !== undefined ? (
        <G>
          <Line x1={round2(X(o.pass * o.max))} y1={top} x2={round2(X(o.pass * o.max))} y2={base} stroke={inf('Ink')} strokeWidth={1.6} strokeDasharray="5 4" />
          <Tx x={X(o.pass * o.max) + 5} y={top + 14} s={11} c={inf('Ink')} w={700} a="start">
            {`حد النجاح ${fmtNum(o.pass * o.max, o.pctScale)}`}
          </Tx>
        </G>
      ) : null}
      {o.mean !== undefined && o.mean !== null ? (
        <G>
          <Path d={`M${round2(X(o.mean) - 8)} ${top - 2} L${round2(X(o.mean) + 8)} ${top - 2} L${round2(X(o.mean))} ${top + 10}Z`} fill={inf('Gold')} stroke={inf('Ink')} strokeWidth={1.2} />
          <Line x1={round2(X(o.mean))} y1={top + 10} x2={round2(X(o.mean))} y2={base} stroke={inf('Gold')} strokeWidth={2.4} />
          <Tx x={X(o.mean) - 6} y={top + 26} s={11.5} c={inf('GoldText')} w={700} a="end">
            {`المتوسط ${fmtNum(o.mean, o.pctScale)}`}
          </Tx>
        </G>
      ) : null}
    </Svg>
  );
}

// ---- histogram ------------------------------------------------------------------------------------------------
export function Histogram({ bins, w = 1010, h = 132 }: { bins: { label: string; color: string; count: number }[]; w?: number; h?: number }) {
  const padB = 30;
  const padT = 18;
  const padX = 10;
  const maxC = Math.max(1, ...bins.map((b) => b.count));
  const bw = (w - 2 * padX) / bins.length;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line x1={padX} y1={h - padB} x2={w - padX} y2={h - padB} stroke={inf('Hair')} />
      {bins.map((b, i) => {
        const x = padX + i * bw;
        const bh = (h - padB - padT) * (b.count / maxC);
        return (
          <G key={i}>
            {b.count ? (
              <>
                <Rect x={round2(x + 3)} y={round2(h - padB - bh)} width={round2(bw - 6)} height={round2(bh)} rx={4} fill={b.color} />
                <Tx x={x + bw / 2} y={h - padB - bh - 5} s={11} c={inf('Ink')} w={700}>
                  {String(b.count)}
                </Tx>
              </>
            ) : null}
            <Tx x={x + bw / 2} y={h - padB + 14} s={9.5} w={600}>
              {b.label}
            </Tx>
          </G>
        );
      })}
    </Svg>
  );
}

// ---- horizontal bars ------------------------------------------------------------------------------------------
export interface HBarRow {
  label: string;
  value: number;
  text: string;
  color: string;
  mark?: number | null;
}
export function HBars({ rows, w = 520, rowH = 26, labW = 130, valW = 54, fs = 12 }: { rows: HBarRow[]; w?: number; rowH?: number; labW?: number; valW?: number; fs?: number }) {
  const h = rows.length * rowH + 6;
  const bx = w - labW - 8;
  const bwMax = bx - valW - 8;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {rows.map((r, i) => {
        const y = i * rowH + 4;
        const bw = Math.max(0, Math.min(1, r.value)) * bwMax;
        const rr = (rowH - 10) / 2;
        const mx = r.mark !== undefined && r.mark !== null ? bx - Math.max(0, Math.min(1, r.mark)) * bwMax : null;
        return (
          <G key={i}>
            <Tx x={w - 2} y={y + rowH / 2 + 4} s={fs} c={inf('Ink')} w={600} a="end">
              {r.label}
            </Tx>
            <Rect x={round2(bx - bwMax)} y={y + 5} width={round2(bwMax)} height={rowH - 10} rx={rr} fill={inf('Mist')} />
            <Rect x={round2(bx - bw)} y={y + 5} width={round2(bw)} height={rowH - 10} rx={rr} fill={r.color} />
            {mx !== null ? <Line x1={round2(mx)} y1={y + 2} x2={round2(mx)} y2={y + rowH - 2} stroke={inf('Ink')} strokeWidth={2} /> : null}
            <Tx x={bx - bwMax - 6} y={y + rowH / 2 + 4} s={12} c={inf('Ink')} w={800} a="end">
              {r.text}
            </Tx>
          </G>
        );
      })}
    </Svg>
  );
}

// ---- box plot -------------------------------------------------------------------------------------------------
export interface BoxProps {
  w?: number;
  h?: number;
  max: number;
  scale: Scale;
  min: number;
  maxv: number;
  q1: number;
  q3: number;
  median: number;
  pctScale?: boolean;
}
export function BoxPlot(o: BoxProps) {
  const w = o.w ?? 380;
  const h = o.h ?? 84;
  const pad = 18;
  const y = 32;
  const X = (v: number) => pad + (w - 2 * pad) * (v / o.max);
  const lab = (v: number, dy: number) => (
    <Tx key={`${v}${dy}`} x={X(v)} y={y + dy} s={10.5} w={600}>
      {fmtNum(v, o.pctScale)}
    </Tx>
  );
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {o.scale.map((lv, i) => {
        const a = (lv.min / 100) * o.max;
        const b = i + 1 < o.scale.length ? (o.scale[i + 1].min / 100) * o.max : o.max;
        return <Rect key={i} x={round2(X(a))} y={y + 22} width={round2(X(b) - X(a))} height={5} fill={lvColor(i, o.scale.length)} />;
      })}
      <Line x1={round2(X(o.min))} y1={y} x2={round2(X(o.maxv))} y2={y} stroke={inf('Ink')} strokeWidth={2} />
      <Line x1={round2(X(o.min))} y1={y - 8} x2={round2(X(o.min))} y2={y + 8} stroke={inf('Ink')} strokeWidth={2} />
      <Line x1={round2(X(o.maxv))} y1={y - 8} x2={round2(X(o.maxv))} y2={y + 8} stroke={inf('Ink')} strokeWidth={2} />
      <Rect x={round2(X(o.q1))} y={y - 13} width={round2(Math.max(2, X(o.q3) - X(o.q1)))} height={26} rx={5} fill={inf('Blue')} fillOpacity={0.18} stroke={inf('Blue')} strokeWidth={2} />
      <Line x1={round2(X(o.median))} y1={y - 13} x2={round2(X(o.median))} y2={y + 13} stroke={inf('Gold')} strokeWidth={4} />
      {lab(o.min, -16)}
      {lab(o.maxv, -16)}
      <Tx x={X(o.median)} y={y - 20} s={11} c={inf('GoldText')} w={700}>
        {`الوسيط ${fmtNum(o.median, o.pctScale)}`}
      </Tx>
      {lab(o.q1, 42)}
      {lab(o.q3, 42)}
    </Svg>
  );
}

// ---- radar ----------------------------------------------------------------------------------------------------
export interface RadarAxis {
  label: string;
  v: number;
  ref?: number | null;
  color?: string;
}
export function Radar({ axes, size = 336, showRef = true }: { axes: RadarAxis[]; size?: number; showRef?: boolean }) {
  const cx = size / 2;
  const cy = size / 2 + 4;
  const R = size / 2 - 70;
  const n = axes.length;
  const ang = (i: number) => -Math.PI / 2 - (i * 2 * Math.PI) / n;
  const Pt = (i: number, v: number): [number, number] => [cx + R * v * Math.cos(ang(i)), cy + R * v * Math.sin(ang(i))];
  const poly = (f: (a: RadarAxis) => number) => axes.map((a, i) => Pt(i, Math.max(0, Math.min(1, f(a)))).map(round2).join(',')).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <Polygon key={k} points={axes.map((_, i) => Pt(i, k).map(round2).join(',')).join(' ')} fill={k === 1 ? inf('Mist') : 'none'} stroke={inf('Hair')} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = Pt(i, 1);
        const [lx, ly] = Pt(i, 1.2);
        // Physical anchors: labels right of the centre extend rightwards, left ones extend leftwards.
        const anc = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
        return (
          <G key={i}>
            <Line x1={cx} y1={cy} x2={round2(x)} y2={round2(y)} stroke={inf('Hair')} />
            <Tx x={lx} y={ly + 4} s={10.5} c={inf('Ink')} w={600} a={anc}>
              {a.label}
            </Tx>
          </G>
        );
      })}
      {showRef ? <Polygon points={poly((a) => a.ref ?? 0)} fill="none" stroke={inf('Mute')} strokeWidth={1.6} strokeDasharray="4 3" /> : null}
      <Polygon points={poly((a) => a.v || 0)} fill={inf('Blue')} fillOpacity={0.18} stroke={inf('Blue')} strokeWidth={2.4} />
      {axes.map((a, i) => {
        const [x, y] = Pt(i, Math.max(0, Math.min(1, a.v || 0)));
        return <Circle key={i} cx={round2(x)} cy={round2(y)} r={4.2} fill={a.color ?? inf('Blue')} stroke={colors.white} strokeWidth={1.5} />;
      })}
    </Svg>
  );
}

// ---- slope chart (earlier on the right, later on the left) -----------------------------------------------------
export function Slope({ pairs, w = 470, h = 430, ma, mb, la, lb }: { pairs: { a: number; b: number; d: number }[]; w?: number; h?: number; ma?: number; mb?: number; la: string; lb: string }) {
  const top = 34;
  const bot = h - 18;
  const xr = w - 70;
  const xl = 70;
  const Y = (v: number) => bot - (bot - top) * Math.max(0, Math.min(1, v));
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((k) => (
        <G key={k}>
          <Line x1={xl} y1={round2(Y(k))} x2={xr} y2={round2(Y(k))} stroke={inf('Hair')} strokeDasharray={k ? '3 4' : undefined} />
          <Tx x={xr + 26} y={Y(k) + 4} s={10} c={inf('Mute')} w={600}>
            {`${Math.round(k * 100)}%`}
          </Tx>
        </G>
      ))}
      {pairs.map((p, i) => {
        const col = p.d > 0.02 ? inf('Green') : p.d < -0.02 ? inf('Red') : inf('Stable');
        return (
          <G key={i}>
            <Line x1={xr} y1={round2(Y(p.a))} x2={xl} y2={round2(Y(p.b))} stroke={col} strokeWidth={Math.abs(p.d) > 0.02 ? 1.8 : 1.2} opacity={0.85} />
            <Circle cx={xr} cy={round2(Y(p.a))} r={3} fill={col} />
            <Circle cx={xl} cy={round2(Y(p.b))} r={3} fill={col} />
          </G>
        );
      })}
      {ma !== undefined && mb !== undefined ? <Line x1={xr} y1={round2(Y(ma))} x2={xl} y2={round2(Y(mb))} stroke={inf('Ink')} strokeWidth={4} strokeLinecap="round" /> : null}
      <Tx x={xr} y={top - 14} s={12} c={inf('Ink')} w={700}>
        {la}
      </Tx>
      <Tx x={xl} y={top - 14} s={12} c={inf('Ink')} w={700}>
        {lb}
      </Tx>
    </Svg>
  );
}

// ---- scatter (absence vs performance) -------------------------------------------------------------------------
export function Scatter({ pts, w = 470, h = 228, fit, xlab }: { pts: { x: number; y: number; color: string }[]; w?: number; h?: number; fit?: { a: number; b: number } | null; xlab?: string }) {
  const l = 40;
  const r = 14;
  const t = 14;
  const b = 34;
  const xmax = Math.max(1, ...pts.map((p) => p.x));
  const X = (x: number) => w - r - (w - l - r) * (x / xmax);
  const Y = (y: number) => h - b - (h - t - b) * Math.max(0, Math.min(1, y));
  const st = niceStep(xmax) < 1 ? 1 : Math.ceil(niceStep(xmax));
  const xs: number[] = [];
  for (let x = 0; x <= xmax + 1e-9; x += st) xs.push(x);
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((k) => (
        <G key={k}>
          <Line x1={l - 8} y1={round2(Y(k))} x2={w - r} y2={round2(Y(k))} stroke={inf('Hair')} />
          <Tx x={l - 12} y={Y(k) + 4} s={10} c={inf('Mute')} w={600} a="end">
            {`${Math.round(k * 100)}%`}
          </Tx>
        </G>
      ))}
      {xs.map((x) => (
        <Tx key={x} x={X(x)} y={h - b + 16} s={10} c={inf('Mute')} w={600}>
          {String(x)}
        </Tx>
      ))}
      <Tx x={(l + w - r) / 2} y={h - 3} s={11}>
        {xlab ?? ''}
      </Tx>
      {pts.map((p, i) => (
        <Circle key={i} cx={round2(X(p.x))} cy={round2(Y(p.y))} r={5.5} fill={p.color} fillOpacity={0.85} stroke={colors.white} strokeWidth={1.2} />
      ))}
      {fit ? <Line x1={round2(X(0))} y1={round2(Y(fit.a))} x2={round2(X(xmax))} y2={round2(Y(fit.a + fit.b * xmax))} stroke={inf('Ink')} strokeWidth={2} strokeDasharray="6 4" /> : null}
    </Svg>
  );
}
