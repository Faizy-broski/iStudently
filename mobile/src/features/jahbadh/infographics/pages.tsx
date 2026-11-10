// The 12 «إنفوجرافيك جهبذ» reports (brief B6-62) as A4-landscape pages for the app. Every figure and sentence comes from
// the shared functions (@studently/shared-utils); this file only arranges them, like the web and the offline tool.
// Pages are fixed-size paper (1123×794) with the `--inf-*` palette, so they capture exactly as they are previewed.
import {
  attendanceReport, branches, classBoard, compare, countWord, dayWord, heatmap, honor, JG_INFOGRAPHIC_REPORTS, jgFmt, jgPctText,
  levelIndex, levelMap, strengths, studentCard, subjectOverview, subjectRank, supportList, type JgInfModel,
} from '@studently/shared-utils';
import type { ReactNode } from 'react';
import { Image, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from '@/lib/colors';
import { cn } from '@/lib/utils';

import { BoxPlot, Donut, Gauge, HBars, Histogram, Ico, Radar, Ruler, Scatter, Slope, type InfIcon } from './charts';
import { PAGE_H, PAGE_W, inf, iso, lvColor, lvLight, one, who, type PageMeta, type PageOptions } from './palette';

export interface PageCtx {
  M: JgInfModel;
  meta: PageMeta;
  opts: PageOptions;
  subjectId: string;
  measureKey?: string;
  /** Earlier period (the «قارن مع» choice) for the comparison report. */
  cmp: JgInfModel | null;
}

export interface BuiltPage {
  key: string;
  file: string;
  title: string;
  node: ReactNode;
}

const P = (x: number | null | undefined) => jgPctText(x, 1);
const F = (x: number | null | undefined) => jgFmt(x, 2);
const V = (x: number | null | undefined, ps: boolean) => (ps ? P(x) : F(x));
const sg = (x: number, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${jgFmt(Math.abs(x), d)}`;
const today = () => {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// ---- text ---------------------------------------------------------------------------------------------------
const SIZE = { '2xs': 'text-2xs', xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl', '5xl': 'text-5xl' } as const;
const WEIGHT: Record<number, string> = { 400: 'font-normal', 500: 'font-medium', 600: 'font-semibold', 700: 'font-bold', 800: 'font-bold' };
type Size = keyof typeof SIZE;

/** Plain RN text with the page ink colour (never the theme's foreground: pages are paper in dark mode too). */
function T({ s = 'xs', w = 400, c, style, lines, children }: { s?: Size; w?: 400 | 500 | 600 | 700 | 800; c?: string; style?: StyleProp<TextStyle>; lines?: number; children?: ReactNode }) {
  return (
    <Text className={cn(SIZE[s], WEIGHT[w])} style={[{ color: c ?? inf('Ink'), writingDirection: 'rtl' }, style]} numberOfLines={lines}>
      {children}
    </Text>
  );
}

// ---- building blocks ---------------------------------------------------------------------------------------
function RulerLegend({ M }: { M: JgInfModel }) {
  const sc = M.scale;
  return (
    <View style={{ marginTop: 14, marginBottom: 12, direction: 'ltr' }}>
      <View style={{ flexDirection: 'row', height: 9, borderRadius: 5, overflow: 'hidden' }}>
        {sc.map((lv, i) => {
          const b = i + 1 < sc.length ? sc[i + 1].min : 100;
          return <View key={i} style={{ width: `${b - lv.min}%`, height: 9, backgroundColor: lvColor(i, sc.length) }} />;
        })}
      </View>
      <View style={{ height: 17, marginTop: 3 }}>
        {sc.map((lv, i) => {
          const b = i + 1 < sc.length ? sc[i + 1].min : 100;
          return (
            <View key={i}>
              <View style={{ position: 'absolute', left: `${(lv.min + b) / 2}%`, width: 120, marginLeft: -60, alignItems: 'center' }}>
                <T s="2xs" w={700} c={lvColor(i, sc.length)}>
                  {lv.label}
                </T>
              </View>
              {i > 0 ? (
                <View style={{ position: 'absolute', left: `${lv.min}%`, width: 40, marginLeft: -20, alignItems: 'center', top: 0 }}>
                  <T s="2xs" c={inf('Slate')}>{`${lv.min}%`}</T>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

type Chip = [string] | [string, 'k' | 'g' | ''];

interface FrameProps {
  ctx: PageCtx;
  title: string;
  sub?: string;
  chips?: Chip[];
  children: ReactNode;
  teacherLabel?: string;
  ruler?: boolean;
}

export function Frame({ ctx, title, sub, chips = [], children, teacherLabel = 'المعلم/ـة', ruler = true }: FrameProps) {
  const { meta, opts, M } = ctx;
  return (
    <View collapsable={false} style={{ width: PAGE_W, height: PAGE_H, backgroundColor: colors.white, direction: 'rtl', paddingTop: 26, paddingBottom: 18, paddingHorizontal: 34, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T s="4xl" w={800}>
            {title}
          </T>
          {sub ? (
            <View style={{ marginTop: 4 }}>
              <T s="sm" c={inf('Slate')}>
                {iso(sub)}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {chips.map((c, i) => {
              const kind = c[1] ?? '';
              const bg = kind === 'k' ? inf('Ink') : kind === 'g' ? inf('GoldL') : inf('Mist');
              const border = kind === 'k' ? inf('Ink') : kind === 'g' ? inf('GoldLine') : inf('Hair');
              const fg = kind === 'k' ? colors.white : kind === 'g' ? inf('GoldText') : inf('Ink2');
              return (
                <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
                  <T s="xs" w={kind ? 700 : 400} c={fg}>
                    {c[0]}
                  </T>
                </View>
              );
            })}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {opts.logoUrl ? <Image source={{ uri: opts.logoUrl }} style={{ width: 58, height: 58 }} resizeMode="contain" /> : null}
          <View>
            <T s="lg" w={800}>
              {meta.school || 'المدرسة'}
            </T>
            {meta.office ? <T s="xs" c={inf('Slate')}>{meta.office}</T> : null}
            {meta.municipality ? <T s="xs" c={inf('Slate')}>{`بلدية ${meta.municipality}`}</T> : null}
            {meta.year ? <T s="xs" c={inf('Slate')}>{`العام الدراسي ${meta.year}`}</T> : null}
          </View>
        </View>
      </View>
      {ruler ? <RulerLegend M={M} /> : <View style={{ height: 12 }} />}
      <View style={{ flex: 1, gap: 14 }}>{children}</View>
      <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center', borderTopWidth: 1, borderTopColor: inf('Hair'), paddingTop: 9, marginTop: 10 }}>
        <T s="xs" c={inf('Slate')}>{`${teacherLabel}: ${meta.teacher || '....................'}`}</T>
        <T s="xs" c={inf('Slate')}>{`مدير/ة المدرسة: ${meta.principal || '....................'}`}</T>
        <T s="xs" c={inf('Slate')}>{`تاريخ التقرير: ${today()}`}</T>
        <View style={{ flex: 1 }} />
        <T s="2xs" c={inf('Mute')}>أُعدّ بمنظومة جهبذ لرصد الدرجات</T>
      </View>
    </View>
  );
}

interface PanelProps {
  title?: string;
  icon?: InfIcon;
  iconColor?: string;
  variant?: 'tint' | 'ink';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}
function Panel({ title, icon, iconColor, variant, style, children }: PanelProps) {
  const base: ViewStyle = { borderWidth: 1, borderColor: inf('Hair'), borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 };
  if (variant === 'tint') Object.assign(base, { backgroundColor: inf('Mist'), borderColor: 'transparent' });
  if (variant === 'ink') Object.assign(base, { backgroundColor: inf('Ink'), borderColor: inf('Ink') });
  return (
    <View style={[base, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {icon ? <Ico name={icon} color={iconColor ?? (variant === 'ink' ? inf('Gold') : inf('Ink'))} size={19} /> : null}
          <T s="sm" w={700} c={variant === 'ink' ? inf('Gold') : undefined}>
            {title}
          </T>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Bullets({ items, color, light, size = 'xs' }: { items: (string | false | null | undefined)[]; color?: string; light?: boolean; size?: Size }) {
  return (
    <View style={{ gap: 7 }}>
      {items
        .filter((t): t is string => !!t)
        .map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, marginTop: 8, backgroundColor: color ?? inf('Ink') }} />
            <View style={{ flex: 1 }}>
              <T s={size} c={light ? colors.white : undefined}>
                {iso(t)}
              </T>
            </View>
          </View>
        ))}
    </View>
  );
}

interface LedgerCell {
  icon: InfIcon;
  label: string;
  value: string;
  small?: boolean;
  hl?: boolean;
  color?: string;
}
function Ledger({ cells, hlIndex }: { cells: LedgerCell[]; hlIndex?: number }) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: inf('Hair'), borderRadius: 12, overflow: 'hidden' }}>
      {cells.map((c, i) => {
        const hl = c.hl || hlIndex === i;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 9, paddingHorizontal: 8, borderEndWidth: i === cells.length - 1 ? 0 : 1, borderColor: inf('Hair'), backgroundColor: hl ? inf('Ink') : undefined }}>
            <View style={{ marginBottom: 4 }}>
              <Ico name={c.icon} color={hl ? inf('Gold') : inf('Slate')} size={18} />
            </View>
            <T s={c.small ? 'lg' : '2xl'} w={800} c={hl ? colors.white : (c.color ?? inf('Ink'))} lines={1}>
              {c.value}
            </T>
            <T s="2xs" c={hl ? inf('InkSoftText') : inf('Slate')} style={{ marginTop: 2, textAlign: 'center' }}>
              {c.label}
            </T>
          </View>
        );
      })}
    </View>
  );
}

const Dot = ({ color }: { color: string }) => <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />;

interface Col {
  flex?: number;
  width?: number;
  center?: boolean;
}
/** One row of a small table (flex rows instead of an HTML table). */
function TRow({ cols, children, head, last }: { cols: Col[]; children: ReactNode[]; head?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: head ? 4 : 5, paddingHorizontal: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: head ? inf('Hair') : inf('HairSoft') }}>
      {children.map((c, i) => (
        <View key={i} style={{ flex: cols[i].width ? undefined : (cols[i].flex ?? 1), width: cols[i].width, alignItems: cols[i].center ? 'center' : 'flex-start' }}>
          {typeof c === 'string' ? (
            <T s={head ? '2xs' : 'xs'} w={head ? 700 : 400} c={head ? inf('Slate') : undefined}>
              {c}
            </T>
          ) : (
            c
          )}
        </View>
      ))}
    </View>
  );
}
const Num = ({ children, c, s = 'xs' }: { children: ReactNode; c?: string; s?: Size }) => (
  <T s={s} w={700} c={c}>
    {children}
  </T>
);

function Quote({ children }: { children: string }) {
  return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: inf('GoldL'), alignItems: 'center' }}>
      <T s="base" w={700} style={{ textAlign: 'center' }}>
        {children}
      </T>
    </View>
  );
}

function NoData({ ctx, title }: { ctx: PageCtx; title: string }) {
  return (
    <Frame ctx={ctx} title={title} chips={[[ctx.M.scopeTitle, 'g']]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ico name="alert" color={inf('Slate')} size={60} />
        <T s="xl" w={800}>
          لا توجد بيانات كافية
        </T>
        <T s="sm" c={inf('Slate')} style={{ textAlign: 'center' }}>
          لا توجد درجات مرصودة في هذا الاختيار. غيّر المادة أو الفترة أو ما يُحلَّل.
        </T>
      </View>
    </Frame>
  );
}

const gradeChip = (ctx: PageCtx): Chip => [`${ctx.meta.grade}${ctx.meta.section ? ` — ${ctx.meta.section}` : ''}`.trim()];
const classChips = (ctx: PageCtx): Chip[] => [[gradeChip(ctx)[0], 'k'], [ctx.M.scopeTitle, 'g']];
const levelOf = (M: JgInfModel, p: number) => levelIndex(M.scale, p, 1);
const measureLine = (name: string, label: string) => `${name} — ${label}`;

function subjectOf(ctx: PageCtx) {
  const s = ctx.M.subjects.find((x) => x.id === ctx.subjectId);
  const m = s?.measures.find((x) => x.key === ctx.measureKey) ?? s?.measures[0];
  return { s, m };
}
function subjectChips(ctx: PageCtx): Chip[] {
  const { s, m } = subjectOf(ctx);
  const showMeasure = m && !['stage', 'final', 'ratio', 'month'].includes(m.kind);
  return [[s?.name ?? '', 'k'], [ctx.M.scopeTitle, 'g'], ...(showMeasure && m ? ([[m.label]] as Chip[]) : []), gradeChip(ctx)];
}

const Row = ({ children, gap = 14, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;

// ---- 1. نتائج المادة في لمحة -----------------------------------------------------------------------------------
function Overview({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx;
  const r = subjectOverview(M, ctx.subjectId, ctx.measureKey);
  if (!r) return <NoData ctx={ctx} title="نتائج المادة في لمحة" />;
  const d = r.data;
  const ps = r.measure.pctScale;
  const max = r.measure.max;
  const { s } = subjectOf(ctx);
  const cells: LedgerCell[] = [
    { icon: 'users', label: `عدد ${who(M.basic)}${d.missing ? ` (من ${d.total})` : ''}`, value: String(d.n) },
    { icon: 'target', label: 'الدرجة العظمى', value: ps ? '100%' : F(max) },
    { icon: 'sigma', label: 'المتوسط', value: V(d.mean, ps) },
    { icon: 'median', label: 'الوسيط', value: V(d.median, ps) },
    { icon: 'mode', label: 'المنوال', value: d.modes.length ? (d.modes.length > 2 ? 'متعدد' : d.modes.map((x) => V(x, ps)).join(' و')) : 'لا يوجد', small: d.modes.length > 1 },
    { icon: 'spread', label: 'الانحراف المعياري', value: V(d.sd, ps) },
    { icon: 'top', label: 'أعلى درجة', value: V(d.maxv, ps) },
    { icon: 'low', label: 'أقل درجة', value: V(d.min, ps) },
    { icon: 'check', label: r.passLabel, value: P(r.passShare) },
    { icon: 'pct', label: 'نسبة التحصيل', value: P(d.mastery), hl: true },
  ];
  const idx = levelOf(M, d.mastery ?? 0);
  const levels = [...d.levels].reverse();
  const tcols: Col[] = [{ flex: 1 }, { width: 46, center: true }, { width: 62, center: true }];
  return (
    <Frame ctx={ctx} title="نتائج المادة في لمحة" sub={`${measureLine(s?.name ?? '', r.measure.label)} — قراءة إحصائية لمستوى التحصيل`} chips={subjectChips(ctx)}>
      <Ledger cells={cells} />
      <Row style={{ flex: 1 }}>
        <Panel title="المتوسط على سلم التقدير" icon="target" style={{ width: 290 }}>
          <View style={{ alignItems: 'center' }}>
            <Gauge pct={d.mastery ?? 0} scale={M.scale} w={250} h={138} />
            <T s="3xl" w={800}>
              {iso(P(d.mastery))}
            </T>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <T s="xs" c={inf('Slate')}>تقدير المتوسط:</T>
              <T s="xs" w={700} c={lvColor(idx, M.scale.length)}>
                {r.estimate}
              </T>
            </View>
          </View>
        </Panel>
        <Panel title={`توزيع ${who(M.basic)} على المستويات`} icon="users" style={{ flex: 1 }}>
          <Row gap={10} style={{ alignItems: 'center' }}>
            <Donut parts={d.levels.map((l) => ({ count: l.count, color: lvColor(l.li, M.scale.length) }))} size={152} center={String(d.n)} sub={who(M.basic)} />
            <View style={{ flex: 1 }}>
              <TRow cols={tcols} head>
                {['المستوى', 'العدد', 'النسبة']}
              </TRow>
              {levels.map((l, i) => (
                <TRow key={l.li} cols={tcols} last={i === levels.length - 1}>
                  {[
                    <View key="a" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Dot color={lvColor(l.li, M.scale.length)} />
                      <T s="xs">{l.label}</T>
                    </View>,
                    <Num key="b">{String(l.count)}</Num>,
                    <Num key="c">{iso(P(l.share))}</Num>,
                  ]}
                </TRow>
              ))}
            </View>
          </Row>
        </Panel>
        <Panel title="الخلاصة" icon="bulb" variant="ink" style={{ flex: 1.1 }}>
          <Bullets items={r.summary} color={inf('Gold')} light />
        </Panel>
      </Row>
      <Panel title="كيف توزعت الدرجات؟" icon="bars" style={{ paddingBottom: 6, alignItems: 'center' }}>
        <Histogram
          w={1000}
          h={132}
          bins={r.bins.map((b) => ({
            count: b.count,
            color: lvColor(b.li, M.scale.length),
            label: ps ? `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%` : `${jgFmt(b.lo, 1)}–${jgFmt(b.hi, 1)}`,
          }))}
        />
      </Panel>
    </Frame>
  );
}

// ---- 2. خريطة المستويات ----------------------------------------------------------------------------------------
function GroupBox({ title, icon, color, light, stats, action }: { title: string; icon: InfIcon; color: string; light: string; stats: [string | number, string][]; action: string }) {
  return (
    <View style={{ width: 250, borderWidth: 1, borderColor: color, borderRadius: 12, backgroundColor: light, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Ico name={icon} color={color} size={18} />
        <T s="sm" w={700} c={color}>
          {title}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-end' }}>
        {stats.map((st, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <T s="2xl" w={800} c={color}>
              {String(st[0])}
            </T>
            <T s="2xs" c={inf('Slate')}>
              {st[1]}
            </T>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 6 }}>
        <T s="2xs" c={inf('Ink2')}>
          {action}
        </T>
      </View>
    </View>
  );
}

function LevelMap({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx;
  const r = levelMap(M, ctx.subjectId, ctx.measureKey);
  if (!r) return <NoData ctx={ctx} title="خريطة المستويات" />;
  const d = r.data;
  const n5 = M.scale.length;
  const { s } = subjectOf(ctx);
  const cards = [...d.levels].reverse();
  return (
    <Frame ctx={ctx} title="خريطة المستويات" sub={`${measureLine(s?.name ?? '', r.measure.label)} — تصنيف النتائج وفق سلم التقدير المعتمد في المدرسة`} chips={subjectChips(ctx)}>
      <Row gap={10}>
        {cards.map((l) => {
          const c = lvColor(l.li, n5);
          return (
            <View key={l.li} style={{ flex: 1, borderRadius: 12, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 12, backgroundColor: lvLight(l.li, n5), borderTopWidth: 5, borderTopColor: c }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T s="base" w={800} c={c}>
                  {l.label}
                </T>
                <T s="2xs" c={inf('Slate')}>
                  {r.ranges[l.li]}
                </T>
              </View>
              <T s="4xl" w={800}>
                {String(l.count)}
              </T>
              <View style={{ height: 7, backgroundColor: colors.white, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                <View style={{ height: 7, width: `${Math.round(l.share * 1000) / 10}%`, backgroundColor: c, borderRadius: 4 }} />
              </View>
              <View style={{ marginTop: 4 }}>
                <T s="xs" w={700} c={inf('Ink2')}>
                  {iso(`${P(l.share)} من ${who(M.basic)}`)}
                </T>
              </View>
            </View>
          );
        })}
      </Row>
      <Panel title={`كل ${one(M.basic)} نقطة على مسطرة التقدير`} icon="scale" style={{ paddingBottom: 2, alignItems: 'center' }}>
        <Ruler w={1000} h={182} max={r.measure.max} scale={M.scale} points={d.points} mean={d.mean} pass={r.pass} pctScale={r.measure.pctScale} dot={d.n > 34 ? 6 : 7.5} />
      </Panel>
      <Row gap={12} style={{ flex: 1 }}>
        <Panel title="قراءة التوزيع" icon="book" variant="tint" style={{ flex: 1 }}>
          <Bullets items={r.reading} color={inf('Teal')} />
        </Panel>
        <Panel title="ماذا تعني الأرقام؟" icon="bulb" variant="tint" style={{ flex: 1 }}>
          <Bullets items={r.meaning} color={inf('Gold')} />
        </Panel>
        <GroupBox
          title="فئة تستحق الاستثمار"
          icon="star"
          color={inf('Green')}
          light={inf('GreenBox')}
          stats={[[r.invest.levels[0]?.count ?? 0, r.invest.levels[0]?.label ?? ''], [r.invest.levels[1]?.count ?? 0, r.invest.levels[1]?.label ?? ''], [r.invest.total, 'معاً']]}
          action={r.invest.action}
        />
        <GroupBox
          title="فئة تحتاج دعماً عاجلاً"
          icon="bell"
          color={inf('Red')}
          light={inf('RedBox')}
          stats={[[r.urgent.below, iso(`دون ${P(M.follow)}`)], [r.urgent.lowest.count, `في «${r.urgent.lowest.label}»`]]}
          action={r.urgent.action}
        />
      </Row>
    </Frame>
  );
}

// ---- 3. القوة وفرص التحسين --------------------------------------------------------------------------------------
function Strengths({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = strengths(M, ctx.subjectId, ctx.measureKey);
  if (!r) return <NoData ctx={ctx} title="القوة وفرص التحسين" />;
  const ps = r.measure.pctScale;
  const { s } = subjectOf(ctx);
  const tiles = (list: { i: number; v: number; li: number }[]) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
      {list.slice(0, 5).map((p, k) => (
        <View key={k} style={{ flex: 1, borderRadius: 10, paddingTop: 8, paddingBottom: 7, paddingHorizontal: 4, alignItems: 'center', backgroundColor: lvLight(p.li, M.scale.length) }}>
          <T s="xl" w={800} c={lvColor(p.li, M.scale.length)}>
            {V(p.v, ps)}
          </T>
          {opts.names && M.students[p.i]?.name ? (
            <T s="2xs" c={inf('Slate')} lines={2} style={{ textAlign: 'center' }}>
              {M.students[p.i].name}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
  return (
    <Frame ctx={ctx} title="القوة وفرص التحسين" sub={`${measureLine(s?.name ?? '', r.measure.label)} — قراءة نوعية تكشف من أين يبدأ التحسين`} chips={subjectChips(ctx)}>
      <Row style={{ flex: 1 }}>
        <Panel title="نقاط القوة" icon="check" iconColor={inf('Green')} style={{ flex: 1, borderColor: inf('GreenLine'), backgroundColor: inf('GreenBg') }}>
          <Bullets items={r.strengths} color={inf('Green')} />
        </Panel>
        <View style={{ flex: 1.25, gap: 10 }}>
          <Panel title="أعلى الدرجات وأقلها" icon="trophy" iconColor={inf('Gold')} style={{ paddingVertical: 9, paddingHorizontal: 12 }}>
            <View style={{ gap: 6 }}>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <View style={{ width: 42 }}><T s="2xs" w={700} c={inf('GoldText')}>الأعلى</T></View>
                {tiles(r.top5)}
              </Row>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <View style={{ width: 42 }}><T s="2xs" w={700} c={inf('RedText')}>الأقل</T></View>
                {tiles(r.bottom5)}
              </Row>
            </View>
          </Panel>
          <Panel title={`أين يقف النصف الأوسط من ${who(M.basic)}؟`} icon="median" style={{ flex: 1, paddingTop: 8, paddingBottom: 4, alignItems: 'center' }}>
            <BoxPlot w={380} h={84} max={r.measure.max} scale={M.scale} min={r.box.min} maxv={r.box.max} q1={r.box.q1} q3={r.box.q3} median={r.box.median} pctScale={ps} />
          </Panel>
        </View>
        <Panel title="فجوات التعلم" icon="alert" iconColor={inf('Red')} style={{ flex: 1, borderColor: inf('RedLine'), backgroundColor: inf('RedBg') }}>
          <Bullets items={r.gaps} color={inf('Red')} />
        </Panel>
      </Row>
      <Row>
        <Panel title="أسئلة تستحق المراجعة" icon="question" variant="tint" style={{ flex: 1 }}>
          <Bullets items={r.questions} color={inf('Blue')} />
        </Panel>
        <Panel title="فرص التحسين" icon="seed" variant="tint" style={{ flex: 1 }}>
          <Bullets items={r.actions} color={inf('Teal')} />
        </Panel>
      </Row>
      <Quote>{r.quote}</Quote>
    </Frame>
  );
}

// ---- heat table (class fingerprint and branch mastery) ---------------------------------------------------------
function HeatCell({ w, h, bg, children, color }: { w?: number; h: number; bg?: string; children?: ReactNode; color?: string }) {
  return (
    <View style={{ width: w, flex: w ? undefined : 1, height: h, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? inf('HairSoft') }}>
      {children !== undefined && children !== null ? (
        <T s="2xs" w={700} c={color ?? colors.white} lines={1}>
          {children}
        </T>
      ) : null}
    </View>
  );
}
function NameCell({ w, h, children, bold }: { w: number; h: number; children: ReactNode; bold?: boolean }) {
  return (
    <View style={{ width: w, height: h, justifyContent: 'center' }}>
      <T s="2xs" w={bold ? 800 : 600} lines={1}>
        {children}
      </T>
    </View>
  );
}

// ---- 4. الفروع والمهارات ----------------------------------------------------------------------------------------
function Branches({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = branches(M, ctx.subjectId, ctx.measureKey);
  if (!r) return <NoData ctx={ctx} title="الفروع والمهارات" />;
  const n5 = M.scale.length;
  const { s } = subjectOf(ctx);
  const rows = r.heatmap.slice(0, 34);
  const hh = Math.max(11, Math.min(17, Math.floor(450 / (Math.min(r.heatmap.length, 34) + 1)) - 2));
  return (
    <Frame ctx={ctx} title="الفروع والمهارات" sub={`${measureLine(s?.name ?? '', r.measure.label)} — أي جزء من المادة أُتقن وأيها يحتاج عودة`} chips={subjectChips(ctx)}>
      <Row style={{ flex: 1 }}>
        <View style={{ flex: 1, gap: 12 }}>
          <Panel title="إتقان كل فرع" icon="bars" style={{ alignItems: 'center' }}>
            <HBars
              w={480}
              rowH={Math.min(34, Math.max(24, Math.floor(250 / r.branches.length)))}
              labW={150}
              rows={r.branches.map((b) => ({ label: b.label, value: b.mastery, text: P(b.mastery), color: lvColor(b.li, n5) }))}
            />
          </Panel>
          <Panel title="ماذا تقول الفروع؟" icon="bulb" variant="ink" style={{ flex: 1 }}>
            <Bullets items={r.tips} color={inf('Gold')} light />
          </Panel>
        </View>
        <Panel title={`خريطة ${who(M.basic)} × الفروع (نسبة الإتقان %)`} icon="users" style={{ flex: 1.05, overflow: 'hidden' }}>
          <View style={{ gap: 2 }}>
            <Row gap={2}>
              <View style={{ width: opts.names ? 150 : 34 }} />
              {r.branches.map((b, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <T s="2xs" w={700} c={inf('Ink2')} lines={2} style={{ textAlign: 'center' }}>
                    {b.label}
                  </T>
                </View>
              ))}
            </Row>
            {rows.map((o, k) => (
              <Row key={o.i} gap={2}>
                <NameCell w={opts.names ? 150 : 34} h={hh}>
                  {opts.names ? M.students[o.i].name : String(k + 1)}
                </NameCell>
                {o.cells.map((c, j) => (c === null ? <HeatCell key={j} h={hh}>—</HeatCell> : <HeatCell key={j} h={hh} bg={lvColor(levelOf(M, c), n5)}>{String(Math.round(c * 100))}</HeatCell>))}
              </Row>
            ))}
          </View>
        </Panel>
      </Row>
    </Frame>
  );
}

// ---- 5. من فترة إلى فترة ----------------------------------------------------------------------------------------
function Compare({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const { s, m } = subjectOf(ctx);
  if (!ctx.cmp) return <NoData ctx={ctx} title="من فترة إلى فترة" />;
  const cmpMeasure = ctx.cmp.subjects.find((x) => x.id === ctx.subjectId)?.measures.find((x) => x.key === ctx.measureKey)?.key;
  const r = compare(M, { model: ctx.cmp, subjectId: ctx.subjectId, measureKey: cmpMeasure }, { model: M, subjectId: ctx.subjectId, measureKey: ctx.measureKey });
  if (!r || r.empty) return <NoData ctx={ctx} title="من فترة إلى فترة" />;
  const name = (i: number, k: number) => (opts.names ? M.students[i].name : `${one(M.basic)} ${k + 1}`);
  const list = (arr: { i: number; a: number; b: number; d: number }[], color: string) => (
    <View style={{ gap: 6 }}>
      {arr.length ? (
        arr.map((p, k) => (
          <Row key={p.i} gap={8} style={{ alignItems: 'center' }}>
            <View style={{ flex: 1 }}><T s="xs" w={700} lines={1}>{name(p.i, k)}</T></View>
            <T s="2xs" c={inf('Slate')}>{`${Math.round(p.a * 100)}% ← ${Math.round(p.b * 100)}%`}</T>
            <View style={{ width: 54, alignItems: 'flex-end' }}><T s="xs" w={700} c={color}>{sg(p.d * 100)}</T></View>
          </Row>
        ))
      ) : (
        <T s="xs" c={inf('Slate')}>لا يوجد.</T>
      )}
    </View>
  );
  const diff = r.means.b - r.means.a;
  return (
    <Frame ctx={ctx} title="من فترة إلى فترة" sub={`${s?.name ?? ''} — ${m?.label ?? ''}: ${r.labels.a} ثم ${r.labels.b}`} chips={[[s?.name ?? '', 'k'], [`${r.labels.a} ← ${r.labels.b}`, 'g'], gradeChip(ctx)]}>
      <Row style={{ flex: 1 }}>
        <Panel title={`كل خط ${one(M.basic)}`} icon="up" style={{ width: 500, alignItems: 'center' }}>
          <Slope pairs={r.pairs} w={470} h={430} ma={r.means.a} mb={r.means.b} la={r.labels.a} lb={r.labels.b} />
          <Row gap={14} style={{ justifyContent: 'center', alignItems: 'center' }}>
            {([['تحسّن', inf('Green')], ['تراجع', inf('Red')], ['ثابت', inf('Stable')], ['متوسط الفصل', inf('Ink')]] as [string, string][]).map(([t, c]) => (
              <Row key={t} gap={5} style={{ alignItems: 'center' }}>
                <Dot color={c} />
                <T s="2xs" c={inf('Slate')}>{t}</T>
              </Row>
            ))}
          </Row>
        </Panel>
        <View style={{ flex: 1, gap: 12 }}>
          <Ledger
            cells={[
              { icon: 'up', label: 'تحسّنوا', value: String(r.counts.up), color: inf('Green') },
              { icon: 'down', label: 'تراجعوا', value: String(r.counts.down), color: inf('Red') },
              { icon: 'scale', label: 'ثابتون', value: String(r.counts.stable), color: inf('Slate') },
              { icon: 'pct', label: 'تغيّر المتوسط (نقطة)', value: sg(diff * 100), color: inf('Ink') },
            ]}
          />
          <Panel title="الخلاصة" icon="bulb" variant="ink">
            <Bullets items={r.tips} color={inf('Gold')} light />
          </Panel>
          <Row gap={12} style={{ flex: 1 }}>
            <Panel title="الأكثر تحسّناً" icon="up" iconColor={inf('Green')} style={{ flex: 1 }}>
              {list(r.mostImproved, inf('Green'))}
            </Panel>
            <Panel title="الأكثر تراجعاً" icon="down" iconColor={inf('Red')} style={{ flex: 1 }}>
              {list(r.mostDeclined, inf('Red'))}
            </Panel>
          </Row>
        </View>
      </Row>
    </Frame>
  );
}

// ---- 6. لوحة الفصل ---------------------------------------------------------------------------------------------
function ClassBoard({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = classBoard(M);
  if (!r) return <NoData ctx={ctx} title="لوحة الفصل" />;
  const d = r.data;
  const k = r.kinds;
  const cells: LedgerCell[] = [
    { icon: 'users', label: `عدد ${who(M.basic)}`, value: String(d.n) },
    { icon: 'pct', label: 'متوسط الفصل', value: P(d.mean), hl: true },
    { icon: 'top', label: 'أعلى نسبة', value: P(d.maxv) },
    { icon: 'low', label: 'أقل نسبة', value: P(d.min) },
  ];
  if (r.final) {
    cells.push({ icon: 'check', label: r.transfer ? 'ينقلون' : 'ناجحون', value: String(k.pass) });
    if (!r.transfer) {
      cells.push({ icon: 'alert', label: 'دور ثاني', value: String(k.r2) });
      cells.push({ icon: 'down', label: 'راسبون', value: String(k.fail) });
    }
    if (k.incomplete) cells.push({ icon: 'cal', label: 'غير مكتملة', value: String(k.incomplete) });
  } else {
    cells.push({ icon: 'star', label: `في «${r.topLevel.label}»`, value: String(r.topLevel.count) });
    cells.push({ icon: 'bell', label: 'دون حد المتابعة', value: String(r.below) });
  }
  const parts = r.final
    ? ([[r.transfer ? 'ينقل' : 'ناجح', k.pass, inf('Green')], ['دور ثاني', k.r2, inf('Orange')], ['راسب', k.fail, inf('Red')], ['غير مكتملة', k.incomplete, inf('Stable')]] as [string, number, string][]).filter((p) => p[1])
    : [];
  const ringTotal = parts.reduce((a, p) => a + p[1], 0);
  const legendRows = r.final
    ? parts.map((p) => ({ label: p[0], count: p[1], share: ringTotal ? p[1] / ringTotal : 0, color: p[2] }))
    : [...d.levels].reverse().map((l) => ({ label: l.label, count: l.count, share: l.share, color: lvColor(l.li, M.scale.length) }));
  const order = [1, 0, 2].map((i) => r.podium[i]);
  const heights = [62, 84, 48];
  const places = [2, 1, 3];
  const fills = [inf('Silver'), inf('Gold'), inf('Bronze')];
  const tcols: Col[] = [{ flex: 1 }, { width: 40, center: true }, { width: 58, center: true }];
  return (
    <Frame ctx={ctx} title="لوحة الفصل" sub={`نتائج الفصل في كل المواد — ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Ledger cells={cells} />
      <Row style={{ flex: 1 }}>
        <View style={{ flex: 1, gap: 12 }}>
          <Row gap={12}>
            <Panel title={r.final ? 'القرار النهائي' : 'المستويات في المجموع'} icon="users" style={{ flex: 1.1 }}>
              <Row gap={10} style={{ alignItems: 'center' }}>
                <Donut
                  parts={r.final ? parts.map((p) => ({ count: p[1], color: p[2] })) : d.levels.map((l) => ({ count: l.count, color: lvColor(l.li, M.scale.length) }))}
                  size={150}
                  center={String(r.final ? ringTotal : d.n)}
                  sub={r.final ? 'القرار' : who(M.basic)}
                />
                <View style={{ flex: 1 }}>
                  {legendRows.map((l, i) => (
                    <TRow key={i} cols={tcols} last={i === legendRows.length - 1}>
                      {[
                        <View key="a" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Dot color={l.color} />
                          <T s="xs">{l.label}</T>
                        </View>,
                        <Num key="b">{String(l.count)}</Num>,
                        <Num key="c">{iso(P(l.share))}</Num>,
                      ]}
                    </TRow>
                  ))}
                </View>
              </Row>
            </Panel>
            <Panel title="الأوائل" icon="trophy" iconColor={inf('Gold')} style={{ flex: 1 }}>
              <Row gap={8} style={{ alignItems: 'flex-end', height: 178 }}>
                {order.map((p, i) =>
                  p ? (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <T s="2xs" w={700} lines={2} style={{ textAlign: 'center', minHeight: 30 }}>
                        {opts.names ? p.name : ['الأول', 'الثاني', 'الثالث'][places[i] - 1]}
                      </T>
                      <T s="base" w={800} style={{ marginVertical: 2 }}>
                        {iso(P(p.pct))}
                      </T>
                      <View style={{ width: '100%', height: heights[i], borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: fills[i], alignItems: 'center', justifyContent: 'center' }}>
                        <T s="2xl" w={800}>
                          {String(places[i])}
                        </T>
                      </View>
                    </View>
                  ) : (
                    <View key={i} style={{ flex: 1 }} />
                  ),
                )}
              </Row>
            </Panel>
          </Row>
          <Panel title="الخلاصة" icon="bulb" variant="ink" style={{ flex: 1 }}>
            <Bullets items={r.tips} color={inf('Gold')} light />
          </Panel>
        </View>
        <Panel title="متوسط كل مادة" icon="bars" style={{ width: 500, alignItems: 'center' }}>
          <HBars
            w={470}
            rowH={Math.min(27, Math.floor(330 / Math.max(1, r.subjects.length)))}
            labW={128}
            fs={11.5}
            rows={r.subjects.map((sb) => ({ label: sb.name, value: sb.mean, text: P(sb.mean), color: lvColor(sb.li, M.scale.length) }))}
          />
        </Panel>
      </Row>
    </Frame>
  );
}

// ---- 7. بصمة الفصل ---------------------------------------------------------------------------------------------
function Heat({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = heatmap(M);
  if (!r) return <NoData ctx={ctx} title="بصمة الفصل" />;
  const n5 = M.scale.length;
  const h = Math.max(11, Math.min(18, Math.floor(430 / (r.rows.length + 1)) - 2));
  const nmW = opts.names ? 170 : 40;
  const totW = 46;
  // Panel inner width: page 1123 − padding 68 − panel padding/border 26.
  const inner = PAGE_W - 68 - 26;
  const n = r.subjects.length;
  const cellW = Math.max(18, (inner - nmW - totW - 2 * (n + 1)) / Math.max(1, n));
  const head = (t: string, w: number, key: string, bold?: boolean) => (
    <View key={key} style={{ width: w, height: 92 }}>
      <View style={{ position: 'absolute', width: 92, height: w, left: (w - 92) / 2, top: (92 - w) / 2, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-90deg' }] }}>
        <T s="2xs" w={bold ? 800 : 700} c={inf('Ink2')} lines={1}>
          {t}
        </T>
      </View>
    </View>
  );
  return (
    <Frame ctx={ctx} title="بصمة الفصل" sub={`خريطة حرارية لكل ${one(M.basic)} في كل مادة، مرتبة من الأعلى — ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Panel title={`كل صف ${one(M.basic)}، وكل عمود مادة (النسبة المئوية)`} icon="users" style={{ paddingVertical: 10, paddingHorizontal: 12, overflow: 'hidden' }}>
        <View style={{ gap: 2 }}>
          <Row gap={2}>
            <View style={{ width: nmW }} />
            {r.subjects.map((sb) => head(sb.name, cellW, sb.id))}
            {head('المجموع', totW, 'total', true)}
          </Row>
          {r.rows.map((row, k) => (
            <Row key={row.i} gap={2}>
              <NameCell w={nmW} h={h}>
                {opts.names ? row.name : String(k + 1)}
              </NameCell>
              {row.cells.map((c, j) => (c ? <HeatCell key={j} w={cellW} h={h} bg={lvColor(c.li, n5)}>{String(Math.round(c.p * 100))}</HeatCell> : <HeatCell key={j} w={cellW} h={h} />))}
              <View style={{ width: totW, height: h, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: inf('Mist'), borderWidth: 2, borderColor: lvColor(levelOf(M, row.pct ?? 0), n5) }}>
                <T s="2xs" w={700}>{String(Math.round((row.pct ?? 0) * 100))}</T>
              </View>
            </Row>
          ))}
          <Row gap={2}>
            <NameCell w={nmW} h={h} bold>
              متوسط المادة
            </NameCell>
            {r.averages.map((a, j) => (a === null ? <HeatCell key={j} w={cellW} h={h} /> : <HeatCell key={j} w={cellW} h={h} bg={inf('Mist')} color={inf('Ink')}>{String(Math.round(a * 100))}</HeatCell>))}
            <HeatCell w={totW} h={h} bg={inf('Mist')} color={inf('Ink')}>
              {String(Math.round((r.overall ?? 0) * 100))}
            </HeatCell>
          </Row>
        </View>
      </Panel>
    </Frame>
  );
}

// ---- 8. ترتيب المواد -------------------------------------------------------------------------------------------
function SubjectRank({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx;
  const r = subjectRank(M);
  if (!r) return <NoData ctx={ctx} title="ترتيب المواد" />;
  const n5 = M.scale.length;
  const bar = (v: number, col: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
      <View style={{ flex: 1, height: 12, backgroundColor: inf('Mist'), borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ height: 12, width: `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`, backgroundColor: col, borderRadius: 6 }} />
      </View>
      <View style={{ width: 52 }}><Num>{iso(P(v))}</Num></View>
    </View>
  );
  const cols: Col[] = [{ width: 30, center: true }, { flex: 1.2 }, { flex: 1.6 }, { flex: 0.8, center: true }, { flex: 0.8, center: true }, { flex: 0.8, center: true }, ...(r.hasGender ? [{ flex: 0.7, center: true }, { flex: 0.7, center: true }] : [])];
  const head = ['', 'المادة', 'متوسط النسبة', r.final ? 'نسبة النجاح' : 'بلغوا حد النجاح', `في «${r.topLabel}»`, 'دون المتابعة', ...(r.hasGender ? ['الذكور', 'الإناث'] : [])];
  return (
    <Frame ctx={ctx} title="ترتيب المواد" sub={`أين يتفوق الفصل وأين يحتاج دعماً — ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Panel title="المواد من الأعلى متوسطاً إلى الأدنى" icon="bars" style={{ flex: 1 }}>
        <TRow cols={cols} head>
          {head}
        </TRow>
        {r.rows.map((s, i) => (
          <TRow key={s.id} cols={cols} last={i === r.rows.length - 1}>
            {[
              <Num key="a" c={inf('Mute')}>{String(s.rank)}</Num>,
              <T key="b" s="sm" w={700}>{s.name}</T>,
              bar(s.mean, lvColor(s.li, n5)),
              <Num key="d">{s.passRate !== null && s.passRate !== undefined ? iso(P(s.passRate)) : '—'}</Num>,
              <Num key="e" c={inf('Green')}>{iso(P(s.topShare))}</Num>,
              <Num key="f" c={inf('Red')}>{String(s.below)}</Num>,
              ...(r.hasGender ? [<Num key="g">{s.male !== null && s.male !== undefined ? iso(P(s.male)) : '—'}</Num>, <Num key="h">{s.female !== null && s.female !== undefined ? iso(P(s.female)) : '—'}</Num>] : []),
            ]}
          </TRow>
        ))}
      </Panel>
      <Panel title="الخلاصة" icon="bulb" variant="ink">
        <Bullets items={r.tips} color={inf('Gold')} light />
      </Panel>
    </Frame>
  );
}

// ---- 9. لوحة الشرف ---------------------------------------------------------------------------------------------
function Honor({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = honor(M);
  if (!r) return <NoData ctx={ctx} title="لوحة الشرف" />;
  const medal = (k: number) => [inf('Gold'), inf('Medal2'), inf('Medal3')][k - 1];
  const box = (k: number) => (k === 1 ? inf('GoldBox') : k === 2 ? inf('SilverBox') : inf('BronzeBox'));
  return (
    <Frame ctx={ctx} title="لوحة الشرف" sub={`الأوائل في ${M.scopeTitle}${r.final ? ' حسب ترتيب «النتائج»' : ' حسب النسبة المئوية'}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Row>
        {r.podium.map((p) => (
          <View key={p.i} style={{ flex: 1, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 14, alignItems: 'center', backgroundColor: box(p.rk), borderWidth: 2, borderColor: medal(p.rk) }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: medal(p.rk), alignItems: 'center', justifyContent: 'center' }}>
              <T s="3xl" w={800}>{String(p.rk)}</T>
            </View>
            <T s="xl" w={800} lines={2} style={{ textAlign: 'center', marginTop: 10, minHeight: 56 }}>
              {opts.names ? p.name : `${one(M.basic)} ${p.rk}`}
            </T>
            <T s="3xl" w={800} style={{ marginTop: 4 }}>{iso(P(p.pct))}</T>
            <T s="xs" c={inf('Slate')}>{p.estimate ?? ''}</T>
          </View>
        ))}
      </Row>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
        {r.rest.map((p) => (
          <View key={p.i} style={{ width: (PAGE_W - 68 - 14 - 8) / 2 - 2, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: inf('Mist') }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <T s="sm" w={800}>{String(p.rk)}</T>
            </View>
            <View style={{ flex: 1 }}><T s="sm" w={700} lines={1}>{opts.names ? p.name : `${one(M.basic)} ${p.rk}`}</T></View>
            <T s="base" w={800}>{iso(P(p.pct))}</T>
          </View>
        ))}
      </View>
      <Quote>{`تهنئة لكل ${M.basic ? 'تلميذ اجتهد' : 'طالب اجتهد'}؛ والطريق مفتوح لكل من يريد أن يكون هنا في المرة القادمة.`}</Quote>
    </Frame>
  );
}

// ---- 10. من يحتاج متابعة؟ --------------------------------------------------------------------------------------
function Support({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = supportList(M);
  if (!r) return <NoData ctx={ctx} title="من يحتاج متابعة؟" />;
  const n5 = M.scale.length;
  const fin = M.scope.kind === 'final';
  const cap = 15;
  const cols: Col[] = [{ width: 26, center: true }, { width: 190 }, { width: 62, center: true }, { flex: 1 }, { width: 220 }];
  return (
    <Frame ctx={ctx} title="من يحتاج متابعة؟" sub={`قائمة عملية للدعم في ${M.scopeTitle}، مرتبة حسب عدد المواد`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Panel title="قائمة المتابعة" icon="bell" style={{ flex: 1, overflow: 'hidden' }}>
        {r.rows.length ? (
          <>
            <TRow cols={cols} head>
              {['', 'الاسم', 'النسبة', iso(`المواد دون حد المتابعة (${P(M.follow)})${fin ? ' أو بدور ثاني' : ''}`), 'المقترح']}
            </TRow>
            {r.rows.slice(0, cap).map((o, k) => (
              <TRow key={o.i} cols={cols} last={k === Math.min(cap, r.rows.length) - 1}>
                {[
                  <Num key="a" c={inf('Mute')}>{String(k + 1)}</Num>,
                  <T key="b" s="xs" w={700} lines={1}>{opts.names ? o.name : `${one(M.basic)} ${k + 1}`}</T>,
                  <Num key="c">{iso(P(o.pct))}</Num>,
                  <View key="d" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {o.weak.map((w, j) => (
                      <View key={j} style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 12, backgroundColor: lvLight(levelOf(M, w.p), n5) }}>
                        <T s="2xs" w={700} c={lvColor(levelOf(M, w.p), n5)}>
                          {`${w.name} ${iso(P(w.p))}${w.res === 'r2' ? ' · دور ثاني' : w.res === 'fail' ? ' · راسب' : ''}`}
                        </T>
                      </View>
                    ))}
                  </View>,
                  <T key="e" s="2xs" c={inf('Slate')}>{o.action}</T>,
                ]}
              </TRow>
            ))}
            {r.rows.length > cap ? (
              <View style={{ marginTop: 6 }}>
                <T s="2xs" c={inf('Slate')}>{`و${r.rows.length - cap} آخرون في القائمة الكاملة داخل منظومة جهبذ (ورقة «الطلاب على الحافة»).`}</T>
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <T s="lg" w={700} c={inf('Green')}>{`لا يوجد ${one(M.basic)} دون حد المتابعة في أي مادة.`}</T>
          </View>
        )}
      </Panel>
      <Panel title="الخلاصة" icon="bulb" variant="ink">
        <Bullets items={r.tips} color={inf('Gold')} light />
      </Panel>
    </Frame>
  );
}

// ---- 11. الحضور والانضباط --------------------------------------------------------------------------------------
function Attendance({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx;
  const r = attendanceReport(M);
  if (!r) return <NoData ctx={ctx} title="الحضور والانضباط" />;
  const mx = Math.max(1, ...r.mostAbsent.map((x) => x.days));
  const cells: LedgerCell[] = [
    { icon: 'cal', label: 'أيام الدراسة المرصودة', value: String(r.days) },
    { icon: 'door', label: 'مجموع أيام الغياب', value: String(r.totals.unexcused + r.totals.excused) },
    { icon: 'alert', label: 'غياب بدون عذر', value: String(r.totals.unexcused) },
    { icon: 'check', label: 'غياب بعذر', value: String(r.totals.excused) },
    { icon: 'clock', label: 'حالات التأخر', value: String(r.totals.late) },
    { icon: 'star', label: 'بلا غياب', value: String(r.totals.zeroAbsence) },
  ];
  return (
    <Frame ctx={ctx} title="الحضور والانضباط" sub={`الغياب والتأخر وعلاقتهما بالأداء — ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Ledger cells={cells} hlIndex={1} />
      <Row style={{ flex: 1 }}>
        <Panel title="الأكثر غياباً" icon="door" style={{ flex: 1, alignItems: 'center' }}>
          {r.mostAbsent.length ? (
            <>
              <HBars
                w={450}
                rowH={25}
                labW={150}
                valW={70}
                fs={11.5}
                rows={r.mostAbsent.map((x, k) => ({ label: opts.names ? x.name : `${one(M.basic)} ${k + 1}`, value: x.days / mx, text: dayWord(x.days), color: x.unexcused >= x.excused ? inf('Red') : inf('Orange') }))}
              />
              <Row gap={6} style={{ alignItems: 'center' }}>
                <Dot color={inf('Red')} />
                <T s="2xs" c={inf('Slate')}>أغلبه بدون عذر</T>
                <Dot color={inf('Orange')} />
                <T s="2xs" c={inf('Slate')}>أغلبه بعذر</T>
              </Row>
            </>
          ) : (
            <T s="sm" w={700} c={inf('Green')}>لا غياب مسجل في هذه الفترة.</T>
          )}
        </Panel>
        <Panel title={`الغياب والأداء (كل نقطة ${one(M.basic)})`} icon="scale" style={{ flex: 1, alignItems: 'center' }}>
          <Scatter pts={r.scatter.map((p) => ({ x: p.x, y: p.y, color: lvColor(p.li, M.scale.length) }))} w={470} h={228} fit={r.fit} xlab="أيام الغياب ←" />
        </Panel>
      </Row>
      <Panel title="الخلاصة" icon="bulb" variant="ink">
        <Bullets items={r.tips} color={inf('Gold')} light />
      </Panel>
    </Frame>
  );
}

// ---- 12. بطاقة الطالب ------------------------------------------------------------------------------------------
function StudentCard({ ctx, index }: { ctx: PageCtx; index: number }) {
  const { M } = ctx;
  const r = studentCard(M, index);
  if (!r) return <NoData ctx={ctx} title={`بطاقة ${one(M.basic)}`} />;
  const n5 = M.scale.length;
  const have = r.axes.filter((a) => a.v !== null && a.v !== undefined) as { id: string; label: string; v: number; ref: number | null; li: number | null }[];
  const axes = have.map((a) => ({ label: a.label, v: a.v, ref: a.ref, color: lvColor(a.li ?? 0, n5) }));
  const N = classBoard(M)?.data.n ?? M.students.length;
  const kind = r.decisionKind;
  return (
    <Frame ctx={ctx} title={`بطاقة ${one(M.basic)}`} sub={`ملف الأداء في ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Row style={{ flex: 1 }}>
        <View style={{ width: 350, gap: 12 }}>
          <Panel variant="ink" style={{ alignItems: 'center', padding: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: inf('Gold'), alignItems: 'center', justifyContent: 'center' }}>
              <Ico name="users" color={inf('Ink')} size={34} />
            </View>
            <T s="xl" w={800} c={colors.white} style={{ marginTop: 10, textAlign: 'center' }}>
              {r.student.name}
            </T>
            <Row gap={24} style={{ marginTop: 14 }}>
              <View style={{ alignItems: 'center' }}>
                <T s="4xl" w={800} c={inf('Gold')}>{iso(P(r.pct))}</T>
                <T s="2xs" c={inf('InkSoftText')}>النسبة العامة</T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T s="4xl" w={800} c={colors.white}>{String(r.rank)}</T>
                <T s="2xs" c={inf('InkSoftText')}>{`الترتيب من ${N}`}</T>
              </View>
            </Row>
            <View style={{ marginTop: 10, alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: 10, paddingVertical: 6, alignItems: 'center' }}>
              <T s="lg" w={800} c={lvColor(levelOf(M, r.pct), n5)}>{r.estimate}</T>
            </View>
            {r.decision ? (
              <View style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: kind === 'pass' ? inf('GreenLine') : inf('GoldLine'), backgroundColor: kind === 'pass' ? inf('GreenSoft') : inf('GoldL') }}>
                <T s="xs" w={700} c={kind === 'pass' ? inf('GreenText') : inf('GoldText')}>{r.decision}</T>
              </View>
            ) : null}
            {r.absence ? (
              <T s="2xs" c={inf('InkSoftText')} style={{ marginTop: 8, textAlign: 'center' }}>{`الغياب: ${r.absence.u} بدون عذر، ${r.absence.e} بعذر، ${r.absence.l} تأخر`}</T>
            ) : null}
          </Panel>
          <Panel title="ملخص" icon="bulb" variant="tint" style={{ flex: 1 }}>
            <Bullets items={r.tips.slice(0, 4)} color={inf('Gold')} />
          </Panel>
        </View>
        <Panel title="ملف المواد" icon="star" style={{ flex: 1, alignItems: 'center' }}>
          {r.radar ? <Radar axes={axes} size={336} /> : <T s="xs" style={{ padding: 30 }}>يحتاج الرسم ثلاث مواد على الأقل.</T>}
          <Row gap={14} style={{ alignItems: 'center' }}>
            <Row gap={5} style={{ alignItems: 'center' }}><Dot color={inf('Blue')} /><T s="2xs" c={inf('Slate')}>{r.student.name.split(' ')[0]}</T></Row>
            <Row gap={5} style={{ alignItems: 'center' }}><Dot color={inf('Mute')} /><T s="2xs" c={inf('Slate')}>متوسط الفصل</T></Row>
          </Row>
        </Panel>
        <Panel title="النسبة في كل مادة" icon="bars" style={{ flex: 1, alignItems: 'center' }}>
          <HBars
            w={322}
            rowH={Math.min(28, Math.floor(390 / Math.max(1, have.length)))}
            labW={112}
            valW={50}
            fs={11}
            rows={have.map((a) => ({ label: a.label, value: a.v, text: P(a.v), color: lvColor(a.li ?? 0, n5), mark: a.ref }))}
          />
          <T s="2xs" c={inf('Slate')} style={{ marginTop: 4 }}>الخط العمودي = متوسط الفصل في المادة.</T>
        </Panel>
      </Row>
      <View style={{ flexDirection: 'row', gap: 20, borderWidth: 1, borderColor: inf('Hair'), borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}><T s="xs">ملاحظة المعلم/ـة: ................................................</T></View>
        <View style={{ flex: 1 }}><T s="xs">توقيع ولي الأمر: ..................................</T></View>
        <View style={{ flex: 1 }}><T s="xs">التاريخ: ....../....../..........</T></View>
      </View>
    </Frame>
  );
}

// ---- assembling the selected pages ------------------------------------------------------------------------
export type Availability = Record<string, boolean>;

/** Which reports have data for the current choice (the others are disabled in the picker). */
export function availability(ctx: PageCtx): Availability {
  const { M } = ctx;
  return {
    branches: branches(M, ctx.subjectId, ctx.measureKey) !== null,
    compare: !!ctx.cmp,
    attendance: attendanceReport(M) !== null,
  };
}

export function buildPages(ctx: PageCtx, selected: Set<string>, studentIndexes: number[]): BuiltPage[] {
  const out: BuiltPage[] = [];
  const subjName = subjectOf(ctx).s?.name ?? '';
  for (const rep of JG_INFOGRAPHIC_REPORTS) {
    if (!selected.has(rep.id)) continue;
    if (rep.id === 'card') {
      for (const i of studentIndexes) {
        const nm = ctx.M.students[i]?.name;
        if (!nm) continue;
        out.push({ key: `card-${i}`, file: `${rep.title} ${ctx.opts.names ? nm : i + 1}`, title: `${rep.title}: ${ctx.opts.names ? nm : i + 1}`, node: <StudentCard ctx={ctx} index={i} /> });
      }
      continue;
    }
    const node =
      rep.id === 'overview' ? <Overview ctx={ctx} />
      : rep.id === 'levels' ? <LevelMap ctx={ctx} />
      : rep.id === 'strengths' ? <Strengths ctx={ctx} />
      : rep.id === 'branches' ? <Branches ctx={ctx} />
      : rep.id === 'compare' ? <Compare ctx={ctx} />
      : rep.id === 'board' ? <ClassBoard ctx={ctx} />
      : rep.id === 'heat' ? <Heat ctx={ctx} />
      : rep.id === 'rank' ? <SubjectRank ctx={ctx} />
      : rep.id === 'support' ? <Support ctx={ctx} />
      : rep.id === 'honor' ? <Honor ctx={ctx} />
      : <Attendance ctx={ctx} />;
    out.push({ key: rep.id, file: rep.group === 'subject' ? `${rep.title} ${subjName}` : rep.title, title: rep.title, node });
  }
  return out;
}
