// The 12 «إنفوجرافيك جهبذ» reports (brief B6-62) as A4-landscape pages. Every figure and sentence comes from the shared
// functions (@/lib/jahbadh: subjectOverview … studentCard); this file only arranges them, like the offline tool does.
// Inline styles + explicit colours only: the pages print and save as images exactly as they appear.
import type { CSSProperties, ReactNode } from "react"
import {
  attendanceReport, branches, classBoard, compare, countWord, dayWord, heatmap, honor, JG_INFOGRAPHIC_REPORTS, jgFmt, jgPctText,
  levelIndex, levelMap, strengths, studentCard, subjectOverview, subjectRank, supportList,
  type JgInfModel,
} from "@/lib/jahbadh"
import {
  BoxPlot, Donut, Gauge, HBars, Histogram, Ico, Radar, Ruler, Scatter, Slope, type InfIcon,
} from "./charts"
import { FONT_HTML, INF, PAGE_H, PAGE_W, iso, lvColor, lvLight, one, who, type PageMeta, type PageOptions } from "./palette"

export interface PageCtx {
  M: JgInfModel
  meta: PageMeta
  opts: PageOptions
  subjectId: string
  measureKey?: string
  /** Earlier period (the «قارن مع» choice) for the comparison report. */
  cmp: JgInfModel | null
}

export interface BuiltPage {
  key: string
  /** File name for downloads. */
  file: string
  title: string
  node: ReactNode
}

const P = (x: number | null | undefined) => jgPctText(x, 1)
const F = (x: number | null | undefined) => jgFmt(x, 2)
const V = (x: number | null | undefined, ps: boolean) => (ps ? P(x) : F(x))
const sg = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${jgFmt(Math.abs(x), d)}`
const cw = (M: JgInfModel, n: number, k: "n" | "g" | "a" = "n") => countWord(n, M.basic, k)
const today = () => {
  const d = new Date()
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// ---- building blocks --------------------------------------------------------------------------------------
const num: CSSProperties = { fontWeight: 800, fontVariantNumeric: "tabular-nums" }

function RulerLegend({ M }: { M: JgInfModel }) {
  const sc = M.scale
  return (
    <div style={{ margin: "14px 0 12px" }} aria-label="سلم التقدير">
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", direction: "ltr" }}>
        {sc.map((lv, i) => {
          const b = i + 1 < sc.length ? sc[i + 1].min : 100
          return <i key={i} style={{ display: "block", height: "100%", width: `${b - lv.min}%`, background: lvColor(i, sc.length) }} />
        })}
      </div>
      <div style={{ display: "flex", direction: "ltr", fontSize: 11, color: INF.slate, marginTop: 3, position: "relative", height: 15 }}>
        {sc.map((lv, i) => {
          const a = lv.min
          const b = i + 1 < sc.length ? sc[i + 1].min : 100
          return (
            <span key={i}>
              <span style={{ position: "absolute", left: `${(a + b) / 2}%`, transform: "translateX(-50%)", whiteSpace: "nowrap", fontWeight: 700, color: lvColor(i, sc.length) }}>{lv.label}</span>
              {i > 0 ? <span style={{ position: "absolute", left: `${a}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{a}%</span> : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}

interface FrameProps {
  ctx: PageCtx
  title: string
  sub?: string
  chips?: ([string] | [string, "k" | "g" | ""])[]
  children: ReactNode
  rows?: string
  teacherLabel?: string
  ruler?: boolean
}

export function Frame({ ctx, title, sub, chips = [], children, rows, teacherLabel = "المعلم/ـة", ruler = true }: FrameProps) {
  const { meta, opts, M } = ctx
  const chip = (c: [string] | [string, "k" | "g" | ""], i: number) => {
    const kind = c[1] ?? ""
    const st: CSSProperties = { fontSize: 12.5, padding: "3px 10px", borderRadius: 20, background: INF.mist, color: INF.ink2, border: `1px solid ${INF.hair}` }
    if (kind === "k") Object.assign(st, { background: INF.ink, color: "#fff", borderColor: INF.ink, fontWeight: 700 })
    if (kind === "g") Object.assign(st, { background: INF.goldL, borderColor: INF.goldLine, color: INF.goldText, fontWeight: 700 })
    return <span key={i} style={st}>{c[0]}</span>
  }
  return (
    <section
      data-jgi-page=""
      style={{
        width: PAGE_W, height: PAGE_H, background: INF.paper, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
        padding: "26px 34px 18px", boxSizing: "border-box", direction: "rtl", fontFamily: FONT_HTML, color: INF.ink,
      }}
    >
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "start" }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 34, lineHeight: 1.15, margin: 0, letterSpacing: "-.2px", color: INF.ink }}>{title}</h1>
          {sub ? <p style={{ margin: "6px 0 0", fontSize: 14.5, color: INF.slate }}>{iso(sub)}</p> : null}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{chips.filter(Boolean).map(chip)}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", direction: "rtl" }}>
          {opts.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={opts.logoUrl} alt="" crossOrigin="anonymous" style={{ width: 58, height: 58, objectFit: "contain" }} />
          ) : null}
          <div style={{ textAlign: "left", lineHeight: 1.5 }}>
            <b style={{ display: "block", fontWeight: 800, fontSize: 17 }}>{meta.school || "المدرسة"}</b>
            {meta.office ? <span style={{ display: "block", fontSize: 12.5, color: INF.slate }}>{meta.office}</span> : null}
            {meta.municipality ? <span style={{ display: "block", fontSize: 12.5, color: INF.slate }}>بلدية {meta.municipality}</span> : null}
            {meta.year ? <span style={{ display: "block", fontSize: 12.5, color: INF.slate }}>العام الدراسي {meta.year}</span> : null}
          </div>
        </div>
      </header>
      {ruler ? <RulerLegend M={M} /> : <div style={{ height: 12 }} />}
      <main style={{ flex: 1, minHeight: 0, display: "grid", gap: 14, gridTemplateRows: rows }}>{children}</main>
      <footer style={{ display: "flex", gap: 24, alignItems: "center", borderTop: `1px solid ${INF.hair}`, paddingTop: 9, marginTop: 10, fontSize: 12, color: INF.slate }}>
        <span style={{ whiteSpace: "nowrap" }}>{teacherLabel}: {meta.teacher || "...................."}</span>
        <span style={{ whiteSpace: "nowrap" }}>مدير/ة المدرسة: {meta.principal || "...................."}</span>
        <span style={{ whiteSpace: "nowrap" }}>تاريخ التقرير: {today()}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: INF.mute, fontSize: 11 }}>أُعدّ بمنظومة جهبذ لرصد الدرجات</span>
      </footer>
    </section>
  )
}

interface PanelProps {
  title?: string
  icon?: InfIcon
  iconColor?: string
  variant?: "tint" | "ink"
  style?: CSSProperties
  children: ReactNode
}
export function Panel({ title, icon, iconColor, variant, style, children }: PanelProps) {
  const base: CSSProperties = { border: `1px solid ${INF.hair}`, borderRadius: 12, padding: "12px 14px", minWidth: 0, minHeight: 0, position: "relative" }
  if (variant === "tint") Object.assign(base, { background: INF.mist, borderColor: "transparent" })
  if (variant === "ink") Object.assign(base, { background: INF.ink, color: "#fff", borderColor: INF.ink })
  return (
    <div style={{ ...base, ...style }}>
      {title ? (
        <h3 style={{ fontWeight: 700, fontSize: 15, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8, color: variant === "ink" ? INF.gold : undefined }}>
          {icon ? <Ico name={icon} color={iconColor ?? (variant === "ink" ? INF.gold : INF.ink)} size={19} /> : null}
          {title}
        </h3>
      ) : null}
      {children}
    </div>
  )
}

export function Bullets({ items, color = INF.ink, size = 13.4, light }: { items: (string | false | null | undefined)[]; color?: string; size?: number; light?: boolean }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
      {items.filter((t): t is string => !!t).map((t, i) => (
        <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: size, lineHeight: 1.65, color: light ? "#fff" : undefined }}>
          <span style={{ flex: "none", width: 7, height: 7, borderRadius: 2, background: color, marginTop: 9 }} />
          <span style={{ minWidth: 0 }}>{iso(t)}</span>
        </li>
      ))}
    </ul>
  )
}

interface LedgerCell {
  icon: InfIcon
  label: string
  value: string
  mod?: "hl" | "sm" | "gd"
  color?: string
}
export function Ledger({ cells, hlIndex }: { cells: LedgerCell[]; hlIndex?: number }) {
  return (
    <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", border: `1px solid ${INF.hair}`, borderRadius: 12, overflow: "hidden" }}>
      {cells.map((c, i) => {
        const hl = c.mod === "hl" || hlIndex === i
        return (
          <div key={i} style={{ padding: "10px 8px 9px", textAlign: "center", borderLeft: i === cells.length - 1 ? 0 : `1px solid ${INF.hair}`, position: "relative", background: hl ? INF.ink : undefined, color: hl ? "#fff" : undefined }}>
            <Ico name={c.icon} color={hl ? INF.gold : INF.slate} size={18} style={{ display: "block", margin: "0 auto 4px" }} />
            <b style={{ display: "block", fontWeight: 800, fontSize: c.mod === "sm" ? 19 : 24, lineHeight: c.mod === "sm" ? 1.5 : 1.15, fontVariantNumeric: "tabular-nums", whiteSpace: c.mod === "sm" ? "nowrap" : undefined, color: c.color ?? (c.mod === "gd" ? INF.goldD : undefined) }}>{c.value}</b>
            <span style={{ display: "block", fontSize: 11.5, color: hl ? INF.inkSoftText : INF.slate, marginTop: 2 }}>{c.label}</span>
          </div>
        )
      })}
    </div>
  )
}

const Dot = ({ color }: { color: string }) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, marginLeft: 6, background: color }} />

const th: CSSProperties = { fontWeight: 700, color: INF.slate, textAlign: "right", padding: "4px 6px", borderBottom: `1px solid ${INF.hair}`, fontSize: 11.5 }
const td: CSSProperties = { padding: "5px 6px", borderBottom: `1px solid ${INF.hairSoft}` }
const tdn: CSSProperties = { ...td, ...num, textAlign: "center", fontWeight: 700 }

function Quote({ children }: { children: ReactNode }) {
  return <div style={{ textAlign: "center", fontWeight: 700, fontSize: 16, color: INF.ink, padding: "10px 14px", borderRadius: 12, background: INF.goldL }}>{children}</div>
}

function NoData({ ctx, title }: { ctx: PageCtx; title: string }) {
  return (
    <Frame ctx={ctx} title={title} chips={[[ctx.M.scopeTitle, "g"]]}>
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <div style={{ textAlign: "center", maxWidth: 560, color: INF.slate, lineHeight: 1.9 }}>
          <div style={{ margin: "0 auto 10px", width: 60 }}><Ico name="alert" color={INF.slate} size={60} /></div>
          <div style={{ fontWeight: 800, fontSize: 20, color: INF.ink }}>لا توجد بيانات كافية</div>
          <div style={{ fontSize: 14 }}>لا توجد درجات مرصودة في هذا الاختيار. غيّر المادة أو الفترة أو ما يُحلَّل.</div>
        </div>
      </div>
    </Frame>
  )
}

const gradeChip = (ctx: PageCtx): [string] => [`${ctx.meta.grade}${ctx.meta.section ? ` — ${ctx.meta.section}` : ""}`.trim()]
const classChips = (ctx: PageCtx): ([string] | [string, "k" | "g" | ""])[] => [[gradeChip(ctx)[0], "k"], [ctx.M.scopeTitle, "g"]]
const levelOf = (M: JgInfModel, p: number) => levelIndex(M.scale, p, 1)
const measureLine = (name: string, label: string) => `${name} — ${label}`

function subjectOf(ctx: PageCtx) {
  const s = ctx.M.subjects.find((x) => x.id === ctx.subjectId)
  const m = s?.measures.find((x) => x.key === ctx.measureKey) ?? s?.measures[0]
  return { s, m }
}
function subjectChips(ctx: PageCtx): ([string] | [string, "k" | "g" | ""])[] {
  const { s, m } = subjectOf(ctx)
  const showMeasure = m && !["stage", "final", "ratio", "month"].includes(m.kind)
  return [[s?.name ?? "", "k"], [ctx.M.scopeTitle, "g"], ...(showMeasure && m ? ([[m.label]] as [string][]) : []), gradeChip(ctx)]
}

// ---- 1. نتائج المادة في لمحة ---------------------------------------------------------------------------------
function Overview({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx
  const r = subjectOverview(M, ctx.subjectId, ctx.measureKey)
  if (!r) return <NoData ctx={ctx} title="نتائج المادة في لمحة" />
  const d = r.data
  const ps = r.measure.pctScale
  const max = r.measure.max
  const { s } = subjectOf(ctx)
  const cells: LedgerCell[] = [
    { icon: "users", label: `عدد ${who(M.basic)}${d.missing ? ` (من ${d.total})` : ""}`, value: String(d.n) },
    { icon: "target", label: "الدرجة العظمى", value: ps ? "100%" : F(max) },
    { icon: "sigma", label: "المتوسط", value: V(d.mean, ps) },
    { icon: "median", label: "الوسيط", value: V(d.median, ps) },
    { icon: "mode", label: "المنوال", value: d.modes.length ? (d.modes.length > 2 ? "متعدد" : d.modes.map((x) => V(x, ps)).join(" و")) : "لا يوجد", mod: d.modes.length > 1 ? "sm" : undefined },
    { icon: "spread", label: "الانحراف المعياري", value: V(d.sd, ps) },
    { icon: "top", label: "أعلى درجة", value: V(d.maxv, ps) },
    { icon: "low", label: "أقل درجة", value: V(d.min, ps) },
    { icon: "check", label: r.passLabel, value: P(r.passShare) },
    { icon: "pct", label: "نسبة التحصيل", value: P(d.mastery), mod: "hl" },
  ]
  const idx = levelOf(M, d.mastery ?? 0)
  const levels = [...d.levels].reverse()
  return (
    <Frame ctx={ctx} title="نتائج المادة في لمحة" sub={`${measureLine(s?.name ?? "", r.measure.label)} — قراءة إحصائية لمستوى التحصيل`} chips={subjectChips(ctx)} rows="auto 1fr auto">
      <Ledger cells={cells} />
      <div style={{ display: "grid", gridTemplateColumns: "290px 1fr 1.1fr", gap: 14, minHeight: 0 }}>
        <Panel title="المتوسط على سلم التقدير" icon="target">
          <div style={{ textAlign: "center" }}>
            <Gauge pct={d.mastery ?? 0} scale={M.scale} w={250} h={138} />
            <div style={{ ...num, fontSize: 28, lineHeight: 1.1 }}>{P(d.mastery)}</div>
            <div style={{ fontSize: 13, color: INF.slate }}>تقدير المتوسط: <b style={{ color: lvColor(idx, M.scale.length) }}>{r.estimate}</b></div>
          </div>
        </Panel>
        <Panel title={`توزيع ${who(M.basic)} على المستويات`} icon="users">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Donut parts={d.levels.map((l) => ({ count: l.count, color: lvColor(l.li, M.scale.length) }))} size={152} center={String(d.n)} sub={who(M.basic)} />
            <div style={{ flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                <tbody>
                  <tr><th style={th}>المستوى</th><th style={{ ...th, textAlign: "center" }}>العدد</th><th style={{ ...th, textAlign: "center" }}>النسبة</th></tr>
                  {levels.map((l) => (
                    <tr key={l.li}>
                      <td style={td}><Dot color={lvColor(l.li, M.scale.length)} />{l.label}</td>
                      <td style={tdn}>{l.count}</td>
                      <td style={tdn}>{iso(P(l.share))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
        <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.summary} color={INF.gold} light /></Panel>
      </div>
      <Panel title="كيف توزعت الدرجات؟" icon="bars" style={{ paddingBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Histogram
            w={1010}
            h={132}
            bins={r.bins.map((b) => ({
              count: b.count,
              color: lvColor(b.li, M.scale.length),
              label: ps ? `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%` : `${jgFmt(b.lo, 1)}–${jgFmt(b.hi, 1)}`,
            }))}
          />
        </div>
      </Panel>
    </Frame>
  )
}

// ---- 2. خريطة المستويات --------------------------------------------------------------------------------------
function GroupBox({ title, icon, color, light, stats, action }: { title: string; icon: InfIcon; color: string; light: string; stats: [string | number, string][]; action: string }) {
  return (
    <div style={{ border: `1px solid ${color}66`, borderRadius: 12, background: light, padding: "10px 12px", minWidth: 0 }}>
      <h3 style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px", color, display: "flex", alignItems: "center", gap: 8 }}><Ico name={icon} color={color} size={18} />{title}</h3>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ ...num, fontSize: 26, lineHeight: 1.1, color }}>{s[0]}</div>
            <div style={{ fontSize: 11, color: INF.slate, whiteSpace: "nowrap" }}>{s[1]}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: INF.ink2, marginTop: 6, lineHeight: 1.55 }}>{action}</div>
    </div>
  )
}

function LevelMap({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx
  const r = levelMap(M, ctx.subjectId, ctx.measureKey)
  if (!r) return <NoData ctx={ctx} title="خريطة المستويات" />
  const d = r.data
  const n5 = M.scale.length
  const { s } = subjectOf(ctx)
  const cards = [...d.levels].reverse()
  return (
    <Frame ctx={ctx} title="خريطة المستويات" sub={`${measureLine(s?.name ?? "", r.measure.label)} — تصنيف النتائج وفق سلم التقدير المعتمد في المدرسة`} chips={subjectChips(ctx)} rows="auto auto 1fr">
      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 10 }}>
        {cards.map((l) => {
          const c = lvColor(l.li, n5)
          return (
            <div key={l.li} style={{ borderRadius: 12, padding: "10px 12px 11px", background: lvLight(l.li, n5), borderTop: `5px solid ${c}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b style={{ fontWeight: 800, fontSize: 16, color: c }}>{l.label}</b>
                <span style={{ fontSize: 11.5, color: INF.slate, direction: "ltr" }}>{r.ranges[l.li]}</span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 34, lineHeight: 1.1, marginTop: 4 }}>{l.count}</div>
              <div style={{ height: 7, background: "rgba(255,255,255,.8)", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                <i style={{ display: "block", height: "100%", width: `${(l.share * 100).toFixed(1)}%`, background: c, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 12.5, marginTop: 4, color: INF.ink2, fontWeight: 700 }}>{iso(`${P(l.share)} من ${who(M.basic)}`)}</div>
            </div>
          )
        })}
      </div>
      <Panel title={`كل ${one(M.basic)} نقطة على مسطرة التقدير`} icon="scale" style={{ paddingBottom: 2 }}>
        <div style={{ display: "flex", justifyContent: "center", marginTop: -6 }}>
          <Ruler w={1050} h={182} max={r.measure.max} scale={M.scale} points={d.points} mean={d.mean} pass={r.pass} pctScale={r.measure.pctScale} dot={d.n > 34 ? 6 : 7.5} />
        </div>
      </Panel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 250px 250px", gap: 12, minHeight: 0 }}>
        <Panel title="قراءة التوزيع" icon="book" variant="tint"><Bullets items={r.reading} color={INF.teal} /></Panel>
        <Panel title="ماذا تعني الأرقام؟" icon="bulb" variant="tint"><Bullets items={r.meaning} color={INF.gold} /></Panel>
        <GroupBox
          title="فئة تستحق الاستثمار"
          icon="star"
          color={INF.green}
          light="#F2FAF4"
          stats={[[r.invest.levels[0]?.count ?? 0, r.invest.levels[0]?.label ?? ""], [r.invest.levels[1]?.count ?? 0, r.invest.levels[1]?.label ?? ""], [r.invest.total, "معاً"]]}
          action={r.invest.action}
        />
        <GroupBox
          title="فئة تحتاج دعماً عاجلاً"
          icon="bell"
          color={INF.red}
          light="#FFF5F5"
          stats={[[r.urgent.below, iso(`دون ${P(M.follow)}`)], [r.urgent.lowest.count, `في «${r.urgent.lowest.label}»`]]}
          action={r.urgent.action}
        />
      </div>
    </Frame>
  )
}

// ---- 3. القوة وفرص التحسين ------------------------------------------------------------------------------------
function Strengths({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = strengths(M, ctx.subjectId, ctx.measureKey)
  if (!r) return <NoData ctx={ctx} title="القوة وفرص التحسين" />
  const ps = r.measure.pctScale
  const { s } = subjectOf(ctx)
  const tiles = (list: { i: number; v: number; li: number }[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {list.slice(0, 5).map((p, k) => (
        <div key={k} style={{ borderRadius: 10, padding: "8px 4px 7px", textAlign: "center", background: lvLight(p.li, M.scale.length) }}>
          <b style={{ display: "block", fontWeight: 800, fontSize: 22, lineHeight: 1.1, color: lvColor(p.li, M.scale.length) }}>{V(p.v, ps)}</b>
          {opts.names && M.students[p.i]?.name ? <span style={{ display: "block", fontSize: 10, color: INF.slate, marginTop: 3, lineHeight: 1.3, maxHeight: "2.6em", overflow: "hidden" }}>{M.students[p.i].name}</span> : null}
        </div>
      ))}
    </div>
  )
  return (
    <Frame ctx={ctx} title="القوة وفرص التحسين" sub={`${measureLine(s?.name ?? "", r.measure.label)} — قراءة نوعية تكشف من أين يبدأ التحسين`} chips={subjectChips(ctx)} rows="1fr auto auto">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 14, minHeight: 0 }}>
        <Panel title="نقاط القوة" icon="check" iconColor={INF.green} style={{ borderColor: INF.greenLine, background: INF.greenBg }}><Bullets items={r.strengths} color={INF.green} /></Panel>
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 10, minHeight: 0 }}>
          <Panel title="أعلى الدرجات وأقلها" icon="trophy" iconColor={INF.gold} style={{ padding: "9px 12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: "6px 8px", alignItems: "center" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: INF.goldText }}>الأعلى</span>
              {tiles(r.top5)}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: INF.redText }}>الأقل</span>
              {tiles(r.bottom5)}
            </div>
          </Panel>
          <Panel title={`أين يقف النصف الأوسط من ${who(M.basic)}؟`} icon="median" style={{ padding: "8px 12px 4px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <BoxPlot w={380} h={84} max={r.measure.max} scale={M.scale} min={r.box.min} maxv={r.box.max} q1={r.box.q1} q3={r.box.q3} median={r.box.median} pctScale={ps} />
            </div>
          </Panel>
        </div>
        <Panel title="فجوات التعلم" icon="alert" iconColor={INF.red} style={{ borderColor: INF.redLine, background: INF.redBg }}><Bullets items={r.gaps} color={INF.red} /></Panel>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel title="أسئلة تستحق المراجعة" icon="question" variant="tint"><Bullets items={r.questions} color={INF.blue} /></Panel>
        <Panel title="فرص التحسين" icon="seed" variant="tint"><Bullets items={r.actions} color={INF.teal} /></Panel>
      </div>
      <Quote>{r.quote}</Quote>
    </Frame>
  )
}

// ---- heat table (branches and class) ------------------------------------------------------------------------
const hmCell = (h: number, fs: number): CSSProperties => ({ textAlign: "center", borderRadius: 3, height: h, lineHeight: `${h}px`, padding: 0, fontWeight: 700, fontSize: fs, color: "#fff" })
const naCell = (h: number, fs: number): CSSProperties => ({ ...hmCell(h, fs), background: `repeating-linear-gradient(45deg, ${INF.naStripeA} 0 3px, ${INF.naStripeB} 3px 6px)`, color: INF.mute })
const nameCell = (h: number, fs: number): CSSProperties => ({ textAlign: "right", color: INF.ink, fontWeight: 600, fontSize: fs, height: h, lineHeight: `${h}px`, padding: "0 2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })

// ---- 4. الفروع والمهارات --------------------------------------------------------------------------------------
function Branches({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = branches(M, ctx.subjectId, ctx.measureKey)
  if (!r) return <NoData ctx={ctx} title="الفروع والمهارات" />
  const n5 = M.scale.length
  const { s } = subjectOf(ctx)
  const rows = r.heatmap.slice(0, 34)
  const hh = Math.max(11, Math.min(17, Math.floor(450 / (Math.min(r.heatmap.length, 34) + 1)) - 2))
  const fs = hh < 14 ? 8.5 : 9.5
  return (
    <Frame ctx={ctx} title="الفروع والمهارات" sub={`${measureLine(s?.name ?? "", r.measure.label)} — أي جزء من المادة أُتقن وأيها يحتاج عودة`} chips={subjectChips(ctx)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 14, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, minHeight: 0 }}>
          <Panel title="إتقان كل فرع" icon="bars">
            <HBars
              w={500}
              rowH={Math.min(34, Math.max(24, Math.floor(250 / r.branches.length)))}
              labW={150}
              rows={r.branches.map((b) => ({ label: b.label, value: b.mastery, text: P(b.mastery), color: lvColor(b.li, n5) }))}
            />
          </Panel>
          <Panel title="ماذا تقول الفروع؟" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
        </div>
        <Panel title={`خريطة ${who(M.basic)} × الفروع (نسبة الإتقان %)`} icon="users" style={{ overflow: "hidden" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 9.5, width: "100%", tableLayout: "fixed" }}>
            <colgroup><col style={{ width: opts.names ? 150 : 34 }} />{r.branches.map((_, i) => <col key={i} />)}</colgroup>
            <tbody>
              <tr><th />{r.branches.map((b, i) => <th key={i} style={{ fontSize: 10, color: INF.ink2, padding: 2 }}>{b.label}</th>)}</tr>
              {rows.map((o, k) => (
                <tr key={o.i}>
                  <td style={nameCell(hh, fs)}>{opts.names ? M.students[o.i].name : k + 1}</td>
                  {o.cells.map((c, j) => (c === null
                    ? <td key={j} style={naCell(hh, fs)}>—</td>
                    : <td key={j} style={{ ...hmCell(hh, fs), background: lvColor(levelOf(M, c), n5) }}>{Math.round(c * 100)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Frame>
  )
}

// ---- 5. من فترة إلى فترة --------------------------------------------------------------------------------------
function Compare({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const { s, m } = subjectOf(ctx)
  if (!ctx.cmp) return <NoData ctx={ctx} title="من فترة إلى فترة" />
  const cmpMeasure = ctx.cmp.subjects.find((x) => x.id === ctx.subjectId)?.measures.find((x) => x.key === ctx.measureKey)?.key
  const r = compare(M, { model: ctx.cmp, subjectId: ctx.subjectId, measureKey: cmpMeasure }, { model: M, subjectId: ctx.subjectId, measureKey: ctx.measureKey })
  if (!r || r.empty) return <NoData ctx={ctx} title="من فترة إلى فترة" />
  const name = (i: number, k: number) => (opts.names ? M.students[i].name : `${one(M.basic)} ${k + 1}`)
  const list = (arr: { i: number; a: number; b: number; d: number }[], color: string) => (
    <div style={{ display: "grid", gap: 6 }}>
      {arr.length ? arr.map((p, k) => (
        <div key={p.i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{name(p.i, k)}</span>
          <span style={{ color: INF.slate, direction: "ltr" }}>{`${Math.round(p.a * 100)}% ← ${Math.round(p.b * 100)}%`}</span>
          <b style={{ color, width: 54, textAlign: "left", direction: "ltr" }}>{sg(p.d * 100)}</b>
        </div>
      )) : <span style={{ fontSize: 12.5, color: INF.slate }}>لا يوجد.</span>}
    </div>
  )
  const diff = r.means.b - r.means.a
  return (
    <Frame ctx={ctx} title="من فترة إلى فترة" sub={`${s?.name ?? ""} — ${m?.label ?? ""}: ${r.labels.a} ثم ${r.labels.b}`} chips={[[s?.name ?? "", "k"], [`${r.labels.a} ← ${r.labels.b}`, "g"], gradeChip(ctx)]}>
      <div style={{ display: "grid", gridTemplateColumns: "500px 1fr", gap: 14, minHeight: 0 }}>
        <Panel title={`كل خط ${one(M.basic)}`} icon="up">
          <div style={{ display: "flex", justifyContent: "center" }}><Slope pairs={r.pairs} w={470} h={430} ma={r.means.a} mb={r.means.b} la={r.labels.a} lb={r.labels.b} /></div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 12, color: INF.slate }}>
            <span><Dot color={INF.green} />تحسّن</span><span><Dot color={INF.red} />تراجع</span><span><Dot color={INF.stable} />ثابت</span><span><Dot color={INF.ink} />متوسط الفصل</span>
          </div>
        </Panel>
        <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12, minHeight: 0 }}>
          <Ledger
            cells={[
              { icon: "up", label: "تحسّنوا", value: String(r.counts.up), color: INF.green },
              { icon: "down", label: "تراجعوا", value: String(r.counts.down), color: INF.red },
              { icon: "scale", label: "ثابتون", value: String(r.counts.stable), color: INF.slate },
              { icon: "pct", label: "تغيّر المتوسط (نقطة)", value: sg(diff * 100), color: INF.ink },
            ]}
          />
          <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>
            <Panel title="الأكثر تحسّناً" icon="up" iconColor={INF.green}>{list(r.mostImproved, INF.green)}</Panel>
            <Panel title="الأكثر تراجعاً" icon="down" iconColor={INF.red}>{list(r.mostDeclined, INF.red)}</Panel>
          </div>
        </div>
      </div>
    </Frame>
  )
}

// ---- 6. لوحة الفصل -------------------------------------------------------------------------------------------
function ClassBoard({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = classBoard(M)
  if (!r) return <NoData ctx={ctx} title="لوحة الفصل" />
  const d = r.data
  const k = r.kinds
  const cells: LedgerCell[] = [
    { icon: "users", label: `عدد ${who(M.basic)}`, value: String(d.n) },
    { icon: "pct", label: "متوسط الفصل", value: P(d.mean), mod: "hl" },
    { icon: "top", label: "أعلى نسبة", value: P(d.maxv) },
    { icon: "low", label: "أقل نسبة", value: P(d.min) },
  ]
  if (r.final) {
    cells.push({ icon: "check", label: r.transfer ? "ينقلون" : "ناجحون", value: String(k.pass) })
    if (!r.transfer) {
      cells.push({ icon: "alert", label: "دور ثاني", value: String(k.r2) })
      cells.push({ icon: "down", label: "راسبون", value: String(k.fail) })
    }
    if (k.incomplete) cells.push({ icon: "cal", label: "غير مكتملة", value: String(k.incomplete) })
  } else {
    cells.push({ icon: "star", label: `في «${r.topLevel.label}»`, value: String(r.topLevel.count) })
    cells.push({ icon: "bell", label: "دون حد المتابعة", value: String(r.below) })
  }
  const parts = r.final
    ? ([[r.transfer ? "ينقل" : "ناجح", k.pass, INF.green], ["دور ثاني", k.r2, INF.orange], ["راسب", k.fail, INF.red], ["غير مكتملة", k.incomplete, INF.stable]] as [string, number, string][]).filter((p) => p[1])
    : []
  const ringTotal = parts.reduce((a, p) => a + p[1], 0)
  const legendRows = r.final
    ? parts.map((p) => ({ label: p[0], count: p[1], share: ringTotal ? p[1] / ringTotal : 0, color: p[2] }))
    : [...d.levels].reverse().map((l) => ({ label: l.label, count: l.count, share: l.share, color: lvColor(l.li, M.scale.length) }))
  const order = [1, 0, 2].map((i) => r.podium[i])
  const heights = [62, 84, 48]
  const places = [2, 1, 3]
  const fills = [INF.silver, INF.gold, INF.bronze]
  return (
    <Frame ctx={ctx} title="لوحة الفصل" sub={`نتائج الفصل في كل المواد — ${M.scopeTitle}`} chips={classChips(ctx)} rows="auto 1fr" teacherLabel="رائد/ة الفصل">
      <Ledger cells={cells} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 500px", gap: 14, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12 }}>
            <Panel title={r.final ? "القرار النهائي" : "المستويات في المجموع"} icon="users">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Donut
                  parts={r.final ? parts.map((p) => ({ count: p[1], color: p[2] })) : d.levels.map((l) => ({ count: l.count, color: lvColor(l.li, M.scale.length) }))}
                  size={150}
                  center={String(r.final ? ringTotal : d.n)}
                  sub={r.final ? "القرار" : who(M.basic)}
                />
                <div style={{ flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    <tbody>
                      {legendRows.map((l, i) => (
                        <tr key={i}><td style={td}><Dot color={l.color} />{l.label}</td><td style={tdn}>{l.count}</td><td style={tdn}>{iso(P(l.share))}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
            <Panel title="الأوائل" icon="trophy" iconColor={INF.gold}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end", height: 178 }}>
                {order.map((p, i) => (p ? (
                  <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, minHeight: "2.6em", lineHeight: 1.3, color: INF.ink }}>{opts.names ? p.name : ["الأول", "الثاني", "الثالث"][places[i] - 1]}</div>
                    <div style={{ ...num, fontSize: 16, color: INF.ink, margin: "2px 0 4px" }}>{iso(P(p.pct))}</div>
                    <div style={{ height: heights[i], borderRadius: "10px 10px 0 0", background: fills[i], display: "grid", placeItems: "center", ...num, fontSize: 26, color: INF.ink }}>{places[i]}</div>
                  </div>
                ) : <div key={i} />))}
              </div>
            </Panel>
          </div>
          <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
        </div>
        <Panel title="متوسط كل مادة" icon="bars">
          <HBars
            w={470}
            rowH={Math.min(27, Math.floor(330 / Math.max(1, r.subjects.length)))}
            labW={128}
            fs={11.5}
            rows={r.subjects.map((s) => ({ label: s.name, value: s.mean, text: P(s.mean), color: lvColor(s.li, M.scale.length) }))}
          />
        </Panel>
      </div>
    </Frame>
  )
}

// ---- 7. بصمة الفصل -------------------------------------------------------------------------------------------
function Heat({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = heatmap(M)
  if (!r) return <NoData ctx={ctx} title="بصمة الفصل" />
  const n5 = M.scale.length
  const h = Math.max(11, Math.min(18, Math.floor(430 / (r.rows.length + 1)) - 2))
  const fs = h < 14 ? 8.5 : 9.5
  const nmW = opts.names ? 170 : 40
  const head = (t: string, key: string, bold?: boolean) => (
    <th key={key} style={{ position: "relative", height: 92, padding: 2, verticalAlign: "bottom" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 92, transform: "translate(-50%,-50%) rotate(-90deg)", textAlign: "center", whiteSpace: "nowrap", fontSize: 11, fontWeight: bold ? 800 : 700, color: INF.ink2 }}>{t}</div>
    </th>
  )
  return (
    <Frame ctx={ctx} title="بصمة الفصل" sub={`خريطة حرارية لكل ${one(M.basic)} في كل مادة، مرتبة من الأعلى — ${M.scopeTitle}`} chips={classChips(ctx)} teacherLabel="رائد/ة الفصل">
      <Panel title={`كل صف ${one(M.basic)}، وكل عمود مادة (النسبة المئوية)`} icon="users" style={{ padding: "10px 12px", overflow: "hidden" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 10.5, width: "100%", tableLayout: "fixed" }}>
          <colgroup><col style={{ width: nmW }} />{r.subjects.map((s) => <col key={s.id} />)}<col style={{ width: 46 }} /></colgroup>
          <tbody>
            <tr><th />{r.subjects.map((s) => head(s.name, s.id))}{head("المجموع", "total", true)}</tr>
            {r.rows.map((row, k) => (
              <tr key={row.i}>
                <td style={nameCell(h, fs + 1)}>{opts.names ? row.name : k + 1}</td>
                {row.cells.map((c, j) => (c
                  ? <td key={j} style={{ ...hmCell(h, fs), background: lvColor(c.li, n5) }}>{Math.round(c.p * 100)}</td>
                  : <td key={j} style={naCell(h, fs)} />))}
                <td style={{ ...hmCell(h, fs), color: INF.ink, background: INF.mist, boxShadow: `inset 0 0 0 2px ${lvColor(levelOf(M, row.pct ?? 0), n5)}` }}>{Math.round((row.pct ?? 0) * 100)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...nameCell(h, fs + 1), fontWeight: 800 }}>متوسط المادة</td>
              {r.averages.map((a, j) => (a === null ? <td key={j} style={naCell(h, fs)} /> : <td key={j} style={{ ...hmCell(h, fs), color: INF.ink, background: INF.mist }}>{Math.round(a * 100)}</td>))}
              <td style={{ ...hmCell(h, fs), color: INF.ink, background: INF.mist }}>{Math.round((r.overall ?? 0) * 100)}</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </Frame>
  )
}

// ---- 8. ترتيب المواد -----------------------------------------------------------------------------------------
function SubjectRank({ ctx }: { ctx: PageCtx }) {
  const { M } = ctx
  const r = subjectRank(M)
  if (!r) return <NoData ctx={ctx} title="ترتيب المواد" />
  const n5 = M.scale.length
  const bar = (v: number, col: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 12, background: INF.mist, borderRadius: 6, overflow: "hidden" }}>
        <i style={{ display: "block", height: "100%", width: `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`, background: col, borderRadius: 6 }} />
      </div>
      <b style={{ ...num, fontSize: 13, width: 52 }}>{iso(P(v))}</b>
    </div>
  )
  const center: CSSProperties = { ...th, textAlign: "center" }
  return (
    <Frame ctx={ctx} title="ترتيب المواد" sub={`أين يتفوق الفصل وأين يحتاج دعماً — ${M.scopeTitle}`} chips={classChips(ctx)} rows="1fr auto" teacherLabel="رائد/ة الفصل">
      <Panel title="المواد من الأعلى متوسطاً إلى الأدنى" icon="bars">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            <tr>
              <th style={th} /><th style={th}>المادة</th><th style={th}>متوسط النسبة</th>
              <th style={center}>{r.final ? "نسبة النجاح" : "بلغوا حد النجاح"}</th>
              <th style={center}>{`في «${r.topLabel}»`}</th>
              <th style={center}>دون المتابعة</th>
              {r.hasGender ? <><th style={center}>الذكور</th><th style={center}>الإناث</th></> : null}
            </tr>
            {r.rows.map((s) => (
              <tr key={s.id}>
                <td style={{ ...tdn, color: INF.mute }}>{s.rank}</td>
                <td style={{ ...td, fontWeight: 700 }}>{s.name}</td>
                <td style={{ ...td, width: 220 }}>{bar(s.mean, lvColor(s.li, n5))}</td>
                <td style={tdn}>{s.passRate !== null && s.passRate !== undefined ? iso(P(s.passRate)) : "—"}</td>
                <td style={{ ...tdn, color: INF.green }}>{iso(P(s.topShare))}</td>
                <td style={{ ...tdn, color: INF.red }}>{s.below}</td>
                {r.hasGender ? <><td style={tdn}>{s.male !== null && s.male !== undefined ? iso(P(s.male)) : "—"}</td><td style={tdn}>{s.female !== null && s.female !== undefined ? iso(P(s.female)) : "—"}</td></> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
    </Frame>
  )
}

// ---- 9. لوحة الشرف -------------------------------------------------------------------------------------------
function Honor({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = honor(M)
  if (!r) return <NoData ctx={ctx} title="لوحة الشرف" />
  const medal = (k: number) => [INF.gold, "#AEB9CC", "#D9A26B"][k - 1]
  const k3 = (k: number) => (k === 1 ? "#FFF8E4" : k === 2 ? "#F4F6FA" : "#FBF2EA")
  return (
    <Frame ctx={ctx} title="لوحة الشرف" sub={`الأوائل في ${M.scopeTitle}${r.final ? " حسب ترتيب «النتائج»" : " حسب النسبة المئوية"}`} chips={classChips(ctx)} rows="auto 1fr auto" teacherLabel="رائد/ة الفصل">
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, r.podium.length)}, 1fr)`, gap: 14 }}>
        {r.podium.map((p) => (
          <div key={p.i} style={{ borderRadius: 16, padding: "18px 14px", textAlign: "center", background: k3(p.rk), border: `2px solid ${medal(p.rk)}` }}>
            <div style={{ width: 58, height: 58, margin: "0 auto", borderRadius: "50%", background: medal(p.rk), display: "grid", placeItems: "center", fontWeight: 800, fontSize: 28, color: INF.ink }}>{p.rk}</div>
            <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.35, marginTop: 10, minHeight: "2.7em" }}>{opts.names ? p.name : `${one(M.basic)} ${p.rk}`}</div>
            <div style={{ ...num, fontSize: 30, marginTop: 4 }}>{iso(P(p.pct))}</div>
            <div style={{ fontSize: 13, color: INF.slate }}>{p.estimate ?? ""}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px", alignContent: "start" }}>
        {r.rest.map((p) => (
          <div key={p.i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 10, background: INF.mist }}>
            <span style={{ ...num, width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontSize: 15 }}>{p.rk}</span>
            <b style={{ flex: 1, fontSize: 14.5 }}>{opts.names ? p.name : `${one(M.basic)} ${p.rk}`}</b>
            <span style={{ ...num, fontSize: 17 }}>{iso(P(p.pct))}</span>
          </div>
        ))}
      </div>
      <Quote>{`تهنئة لكل ${M.basic ? "تلميذ اجتهد" : "طالب اجتهد"}؛ والطريق مفتوح لكل من يريد أن يكون هنا في المرة القادمة.`}</Quote>
    </Frame>
  )
}

// ---- 10. من يحتاج متابعة؟ ------------------------------------------------------------------------------------
function Support({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = supportList(M)
  if (!r) return <NoData ctx={ctx} title="من يحتاج متابعة؟" />
  const n5 = M.scale.length
  const fin = M.scope.kind === "final"
  const cap = 15
  return (
    <Frame ctx={ctx} title="من يحتاج متابعة؟" sub={`قائمة عملية للدعم في ${M.scopeTitle}، مرتبة حسب عدد المواد`} chips={classChips(ctx)} rows="1fr auto" teacherLabel="رائد/ة الفصل">
      <Panel title="قائمة المتابعة" icon="bell" style={{ overflow: "hidden" }}>
        {r.rows.length ? (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                <tr><th style={th} /><th style={th}>الاسم</th><th style={{ ...th, textAlign: "center" }}>النسبة</th><th style={th}>{iso(`المواد دون حد المتابعة (${P(M.follow)})${fin ? " أو بدور ثاني" : ""}`)}</th><th style={th}>المقترح</th></tr>
                {r.rows.slice(0, cap).map((o, k) => (
                  <tr key={o.i}>
                    <td style={{ ...tdn, color: INF.mute }}>{k + 1}</td>
                    <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{opts.names ? o.name : `${one(M.basic)} ${k + 1}`}</td>
                    <td style={tdn}>{iso(P(o.pct))}</td>
                    <td style={td}>
                      {o.weak.map((w, j) => (
                        <span key={j} style={{ display: "inline-block", margin: "2px 0 2px 6px", padding: "2px 9px", borderRadius: 12, fontSize: 11.5, background: lvLight(levelOf(M, w.p), n5), color: lvColor(levelOf(M, w.p), n5), fontWeight: 700 }}>
                          {w.name} {iso(P(w.p))}{w.res === "r2" ? " · دور ثاني" : w.res === "fail" ? " · راسب" : ""}
                        </span>
                      ))}
                    </td>
                    <td style={{ ...td, fontSize: 11.5, color: INF.slate }}>{o.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.rows.length > cap ? <div style={{ fontSize: 12, color: INF.slate, marginTop: 6 }}>{`و${r.rows.length - cap} آخرون في القائمة الكاملة داخل منظومة جهبذ (ورقة «الطلاب على الحافة»).`}</div> : null}
          </>
        ) : (
          <div style={{ padding: 30, textAlign: "center", fontWeight: 700, fontSize: 18, color: INF.green }}>{`لا يوجد ${one(M.basic)} دون حد المتابعة في أي مادة.`}</div>
        )}
      </Panel>
      <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
    </Frame>
  )
}

// ---- 11. الحضور والانضباط -------------------------------------------------------------------------------------
function Attendance({ ctx }: { ctx: PageCtx }) {
  const { M, opts } = ctx
  const r = attendanceReport(M)
  if (!r) return <NoData ctx={ctx} title="الحضور والانضباط" />
  const mx = Math.max(1, ...r.mostAbsent.map((x) => x.days))
  const cells: LedgerCell[] = [
    { icon: "cal", label: "أيام الدراسة المرصودة", value: String(r.days) },
    { icon: "door", label: "مجموع أيام الغياب", value: String(r.totals.unexcused + r.totals.excused) },
    { icon: "alert", label: "غياب بدون عذر", value: String(r.totals.unexcused) },
    { icon: "check", label: "غياب بعذر", value: String(r.totals.excused) },
    { icon: "clock", label: "حالات التأخر", value: String(r.totals.late) },
    { icon: "star", label: `بلا غياب`, value: String(r.totals.zeroAbsence) },
  ]
  return (
    <Frame ctx={ctx} title="الحضور والانضباط" sub={`الغياب والتأخر وعلاقتهما بالأداء — ${M.scopeTitle}`} chips={classChips(ctx)} rows="auto 1fr auto" teacherLabel="رائد/ة الفصل">
      <Ledger cells={cells} hlIndex={1} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minHeight: 0 }}>
        <Panel title="الأكثر غياباً" icon="door">
          {r.mostAbsent.length ? (
            <>
              <HBars
                w={450}
                rowH={25}
                labW={150}
                valW={70}
                fs={11.5}
                rows={r.mostAbsent.map((x, k) => ({ label: opts.names ? x.name : `${one(M.basic)} ${k + 1}`, value: x.days / mx, text: dayWord(x.days), color: x.unexcused >= x.excused ? INF.red : INF.orange }))}
              />
              <div style={{ fontSize: 11.5, color: INF.slate, marginTop: 2 }}><Dot color={INF.red} />أغلبه بدون عذر <Dot color={INF.orange} />أغلبه بعذر</div>
            </>
          ) : <div style={{ padding: 20, textAlign: "center", color: INF.green, fontWeight: 700 }}>لا غياب مسجل في هذه الفترة.</div>}
        </Panel>
        <Panel title={`الغياب والأداء (كل نقطة ${one(M.basic)})`} icon="scale">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Scatter pts={r.scatter.map((p) => ({ x: p.x, y: p.y, color: lvColor(p.li, M.scale.length) }))} w={470} h={228} fit={r.fit} xlab="أيام الغياب ←" />
          </div>
        </Panel>
      </div>
      <Panel title="الخلاصة" icon="bulb" variant="ink"><Bullets items={r.tips} color={INF.gold} light /></Panel>
    </Frame>
  )
}

// ---- 12. بطاقة الطالب ----------------------------------------------------------------------------------------
function StudentCard({ ctx, index }: { ctx: PageCtx; index: number }) {
  const { M } = ctx
  const r = studentCard(M, index)
  if (!r) return <NoData ctx={ctx} title={`بطاقة ${one(M.basic)}`} />
  const n5 = M.scale.length
  const have = r.axes.filter((a) => a.v !== null && a.v !== undefined) as { id: string; label: string; v: number; ref: number | null; li: number | null }[]
  const axes = have.map((a) => ({ label: a.label, v: a.v, ref: a.ref, color: lvColor(a.li ?? 0, n5) }))
  const N = classBoard(M)?.data.n ?? M.students.length
  const kind = r.decisionKind
  return (
    <Frame ctx={ctx} title={`بطاقة ${one(M.basic)}`} sub={`ملف الأداء في ${M.scopeTitle}`} chips={classChips(ctx)} rows="1fr auto" teacherLabel="رائد/ة الفصل">
      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr 1fr", gap: 14, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 12, minHeight: 0 }}>
          <Panel variant="ink" style={{ textAlign: "center", padding: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: INF.gold, display: "grid", placeItems: "center", margin: "0 auto" }}><Ico name="users" color={INF.ink} size={34} /></div>
            <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.35, marginTop: 10 }}>{r.student.name}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 14 }}>
              <div><div style={{ ...num, fontSize: 34, color: INF.gold }}>{iso(P(r.pct))}</div><div style={{ fontSize: 12, color: INF.inkSoftText }}>النسبة العامة</div></div>
              <div><div style={{ ...num, fontSize: 34 }}>{r.rank}</div><div style={{ fontSize: 12, color: INF.inkSoftText }}>الترتيب من {N}</div></div>
            </div>
            <div style={{ marginTop: 10, fontWeight: 800, fontSize: 18, color: lvColor(levelOf(M, r.pct), n5), background: "#fff", borderRadius: 10, padding: 6 }}>{r.estimate}</div>
            {r.decision ? (
              <div style={{ fontSize: 13, marginTop: 6, display: "inline-block", padding: "3px 10px", borderRadius: 20, border: `1px solid ${kind === "pass" ? INF.greenLine : INF.goldLine}`, background: kind === "pass" ? INF.greenSoft : INF.goldL, color: kind === "pass" ? INF.greenText : INF.goldText, fontWeight: 700 }}>{r.decision}</div>
            ) : null}
            {r.absence ? <div style={{ fontSize: 12, color: INF.inkSoftText, marginTop: 8 }}>{`الغياب: ${r.absence.u} بدون عذر، ${r.absence.e} بعذر، ${r.absence.l} تأخر`}</div> : null}
          </Panel>
          <Panel title="ملخص" icon="bulb" variant="tint" style={{ fontSize: 12.5 }}><Bullets items={r.tips.slice(0, 4)} color={INF.gold} size={12.4} /></Panel>
        </div>
        <Panel title="ملف المواد" icon="star">
          <div style={{ display: "flex", justifyContent: "center" }}>
            {r.radar ? <Radar axes={axes} size={336} /> : <div style={{ padding: 30, fontSize: 13 }}>يحتاج الرسم ثلاث مواد على الأقل.</div>}
          </div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 12, color: INF.slate }}>
            <span><Dot color={INF.blue} />{r.student.name.split(" ")[0]}</span><span><Dot color={INF.mute} />متوسط الفصل</span>
          </div>
        </Panel>
        <Panel title="النسبة في كل مادة" icon="bars">
          <HBars
            w={322}
            rowH={Math.min(28, Math.floor(390 / Math.max(1, have.length)))}
            labW={112}
            valW={50}
            fs={11}
            rows={have.map((a) => ({ label: a.label, value: a.v, text: P(a.v), color: lvColor(a.li ?? 0, n5), mark: a.ref }))}
          />
          <div style={{ fontSize: 11.5, color: INF.slate, marginTop: 4 }}>الخط العمودي = متوسط الفصل في المادة.</div>
        </Panel>
      </div>
      <div style={{ border: `1px solid ${INF.hair}`, borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, padding: "12px 16px" }}>
        <div style={{ fontSize: 13 }}>ملاحظة المعلم/ـة: ................................................</div>
        <div style={{ fontSize: 13 }}>توقيع ولي الأمر: ..................................</div>
        <div style={{ fontSize: 13 }}>التاريخ: ....../....../..........</div>
      </div>
    </Frame>
  )
}

// ---- assembling the selected pages ------------------------------------------------------------------------
export interface Availability {
  [reportId: string]: boolean
}

/** Which reports have data for the current choice (the others are disabled in the picker). */
export function availability(ctx: PageCtx): Availability {
  const { M } = ctx
  return {
    branches: branches(M, ctx.subjectId, ctx.measureKey) !== null,
    compare: !!ctx.cmp,
    attendance: attendanceReport(M) !== null,
  }
}

export const REPORT_GROUPS = { subject: "مادة", class: "فصل", student: "طالب" } as const

export function buildPages(ctx: PageCtx, selected: Set<string>, studentIndexes: number[]): BuiltPage[] {
  const out: BuiltPage[] = []
  const { s } = subjectOf(ctx)
  const subjName = s?.name ?? ""
  for (const rep of JG_INFOGRAPHIC_REPORTS) {
    if (!selected.has(rep.id)) continue
    if (rep.id === "card") {
      for (const i of studentIndexes) {
        const nm = ctx.M.students[i]?.name
        if (!nm) continue
        out.push({ key: `card-${i}`, file: `${rep.title} ${ctx.opts.names ? nm : i + 1}`, title: `${rep.title}: ${ctx.opts.names ? nm : i + 1}`, node: <StudentCard ctx={ctx} index={i} /> })
      }
      continue
    }
    const node =
      rep.id === "overview" ? <Overview ctx={ctx} />
      : rep.id === "levels" ? <LevelMap ctx={ctx} />
      : rep.id === "strengths" ? <Strengths ctx={ctx} />
      : rep.id === "branches" ? <Branches ctx={ctx} />
      : rep.id === "compare" ? <Compare ctx={ctx} />
      : rep.id === "board" ? <ClassBoard ctx={ctx} />
      : rep.id === "heat" ? <Heat ctx={ctx} />
      : rep.id === "rank" ? <SubjectRank ctx={ctx} />
      : rep.id === "support" ? <Support ctx={ctx} />
      : rep.id === "honor" ? <Honor ctx={ctx} />
      : <Attendance ctx={ctx} />
    out.push({ key: rep.id, file: rep.group === "subject" ? `${rep.title} ${subjName}` : rep.title, title: rep.title, node })
  }
  return out
}

