"use client"

// Recreation of the "Derati" electrical-circuit-diagram tool (derati.vercel.app)
// as an in-app Resources tool. A form drives a live SVG schematic — pure client
// state, no persistence, matching the reference tool's ephemeral nature.
//
// Rendering trick that keeps the geometry simple: every wire is drawn first as
// one full straight line, then component symbols are layered on top with an
// opaque background (matching the canvas background) so they visually "sit on"
// and interrupt the wire — no need to compute stub segments around each part.

import { useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Download, FilePlus2, Plus, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────

type ConnectionMethod = "series" | "parallel"
type Polarity = "left-plus" | "left-minus"
type SourceType = "battery" | "generator"
type SwitchState = "closed" | "open" | "none"
type FuseState = "with" | "without"
type ElementType = "lamp" | "led" | "resistor" | "rheostat" | "diode" | "buzzer" | "motor"

interface CircuitElementState {
  id: number
  name: string
  type: ElementType
  power: string
  meaning: string
  ammeter: boolean
  voltmeter: boolean
}

interface CircuitState {
  connectionMethod: ConnectionMethod
  showArrows: boolean
  polarity: Polarity
  numCells: number
  sourceType: SourceType
  sourceIndication: string
  sourceName: string
  mainAmmeter: boolean
  mainVoltmeter: boolean
  fuseState: FuseState
  fuseName: string
  switchState: SwitchState
  showLabels: boolean
  elements: CircuitElementState[]
}

const ELEMENT_TYPES: { value: ElementType; en: string; ar: string }[] = [
  { value: "lamp", en: "Incandescent Lamp", ar: "مصباح توهج" },
  { value: "led", en: "LED", ar: "ثنائي ضوئي (LED)" },
  { value: "resistor", en: "Resistor", ar: "ناقل أومي" },
  { value: "rheostat", en: "Rheostat", ar: "ريوستا" },
  { value: "diode", en: "Diode", ar: "ثنائي" },
  { value: "buzzer", en: "Buzzer", ar: "جرس" },
  { value: "motor", en: "Motor", ar: "محرك" },
]

const CANVAS_BG = "#ffffff"
const WIRE_COLOR = "#111827"
const ARROW_COLOR = "#dc2626"

let nextElementId = 1
const makeElement = (): CircuitElementState => ({
  id: nextElementId++,
  name: "",
  type: "lamp",
  power: "",
  meaning: "",
  ammeter: false,
  voltmeter: false,
})

const makeDefaultState = (): CircuitState => ({
  connectionMethod: "series",
  showArrows: true,
  polarity: "left-plus",
  numCells: 1,
  sourceType: "battery",
  sourceIndication: "",
  sourceName: "",
  mainAmmeter: false,
  mainVoltmeter: false,
  fuseState: "without",
  fuseName: "",
  switchState: "closed",
  showLabels: true,
  elements: [makeElement(), makeElement()],
})

// ── Drawing model ────────────────────────────────────────────────────────

type Dir = "up" | "down" | "left" | "right"
interface Line { x1: number; y1: number; x2: number; y2: number }
interface ArrowMark { x: number; y: number; dir: Dir }
interface Stub { x: number; y1: number; y2: number; kind: "A" | "V" }
interface InlinePart {
  x: number
  y: number
  kind: ElementType | "ammeter" | "voltmeter" | "fuse" | "switch-closed" | "switch-open"
  label?: { name?: string; power?: string; meaning?: string }
}

interface DiagramModel {
  width: number
  height: number
  lines: Line[]
  arrows: ArrowMark[]
  stubs: Stub[]
  parts: InlinePart[]
  batteryAt: { x: number; y: number }
}

const RUNG_GAP = 90
const TOP_Y = 70

function buildInlineRun(
  startX: number,
  endX: number,
  y: number,
  items: { kind: InlinePart["kind"]; label?: InlinePart["label"] }[]
): InlinePart[] {
  if (items.length === 0) return []
  const usableStart = startX + 40
  const usableEnd = endX - 40
  const step = items.length === 1 ? 0 : (usableEnd - usableStart) / (items.length - 1)
  return items.map((item, i) => ({
    x: items.length === 1 ? (startX + endX) / 2 : usableStart + step * i,
    y,
    kind: item.kind,
    label: item.label,
  }))
}

function buildModel(state: CircuitState, reversed: boolean): DiagramModel {
  const n = Math.max(1, state.elements.length)
  const elementSpacing = 190

  // ── Shared: the "top run" carries the battery + fuse/switch/ammeter, in
  // series between the left rail/corner and the right rail/corner.
  const rightInline: { kind: InlinePart["kind"]; label?: InlinePart["label"] }[] = []
  if (state.fuseState === "with") rightInline.push({ kind: "fuse", label: { name: state.fuseName } })
  if (state.switchState !== "none")
    rightInline.push({ kind: state.switchState === "closed" ? "switch-closed" : "switch-open" })
  if (state.mainAmmeter) rightInline.push({ kind: "ammeter" })

  if (state.connectionMethod === "series") {
    const width = Math.max(640, 180 + (n - 1) * elementSpacing + 220)
    const height = 320
    const leftX = 90
    const rightX = width - 90
    const topY = TOP_Y
    const bottomY = height - 70
    const batteryX = leftX + (rightX - leftX) * 0.32

    const lines: Line[] = [
      { x1: leftX, y1: topY, x2: rightX, y2: topY },
      { x1: rightX, y1: topY, x2: rightX, y2: bottomY },
      { x1: rightX, y1: bottomY, x2: leftX, y2: bottomY },
      { x1: leftX, y1: bottomY, x2: leftX, y2: topY },
    ]

    const parts: InlinePart[] = [
      ...buildInlineRun(batteryX + 40, rightX, topY, rightInline),
    ]

    const elementXs = state.elements.map((_, i) =>
      n === 1 ? (leftX + rightX) / 2 : leftX + 90 + ((rightX - 90 - (leftX + 90)) * i) / (n - 1)
    )
    const stubs: Stub[] = []
    state.elements.forEach((el, i) => {
      parts.push({
        x: elementXs[i],
        y: bottomY,
        kind: el.type,
        label: { name: el.name, power: el.power, meaning: el.meaning },
      })
      if (el.ammeter) {
        parts.push({ x: elementXs[i] + 55, y: bottomY, kind: "ammeter" })
      }
      if (el.voltmeter) {
        stubs.push({ x: elementXs[i], y1: bottomY, y2: bottomY + 45, kind: "V" })
      }
    })
    if (state.mainVoltmeter) {
      stubs.push({ x: batteryX, y1: topY, y2: topY + 45, kind: "V" })
    }

    const horizArrowDir: Dir = reversed ? "right" : "left"
    const bottomArrowDir: Dir = reversed ? "left" : "right"
    const leftVertDir: Dir = reversed ? "up" : "down"
    const rightVertDir: Dir = reversed ? "down" : "up"

    const arrows: ArrowMark[] = [
      { x: (leftX + batteryX - 20) / 2, y: topY, dir: horizArrowDir },
      { x: (batteryX + 60 + rightX) / 2, y: topY, dir: horizArrowDir },
      { x: leftX, y: (topY + bottomY) / 2, dir: leftVertDir },
      { x: rightX, y: (topY + bottomY) / 2, dir: rightVertDir },
    ]
    const bottomArrowXs = n === 1 ? [(leftX + rightX) / 2] : [leftX + 60, (leftX + rightX) / 2, rightX - 60]
    bottomArrowXs.forEach((x) => arrows.push({ x, y: bottomY, dir: bottomArrowDir }))

    return { width, height, lines, arrows, stubs, parts, batteryAt: { x: batteryX, y: topY } }
  }

  // ── Parallel ("on the branch"): two vertical rails, one rung per element.
  const railL = 130
  const railR = 400
  const width = 520
  const topY = TOP_Y
  const rungYs = state.elements.map((_, i) => topY + 90 + i * RUNG_GAP)
  const bottomOfRails = (rungYs[rungYs.length - 1] ?? topY + 90) + 40
  const height = bottomOfRails + 40
  const batteryX = railL + (railR - railL) * 0.4

  const lines: Line[] = [
    { x1: railL, y1: topY, x2: railR, y2: topY },
    { x1: railL, y1: topY, x2: railL, y2: bottomOfRails },
    { x1: railR, y1: topY, x2: railR, y2: bottomOfRails },
  ]

  const parts: InlinePart[] = [...buildInlineRun(batteryX + 40, railR, topY, rightInline)]
  const stubs: Stub[] = []
  state.elements.forEach((el, i) => {
    const y = rungYs[i]
    lines.push({ x1: railL, y1: y, x2: railR, y2: y })
    parts.push({
      x: (railL + railR) / 2,
      y,
      kind: el.type,
      label: { name: el.name, power: el.power, meaning: el.meaning },
    })
    if (el.ammeter) parts.push({ x: (railL + railR) / 2 + 65, y, kind: "ammeter" })
    if (el.voltmeter) stubs.push({ x: (railL + railR) / 2, y1: y, y2: y - 40, kind: "V" })
  })
  if (state.mainVoltmeter) stubs.push({ x: batteryX, y1: topY, y2: topY + 40, kind: "V" })

  const horizArrowDir: Dir = reversed ? "right" : "left"
  const rungArrowDir: Dir = reversed ? "left" : "right"
  const leftRailDir: Dir = reversed ? "up" : "down"
  const rightRailDir: Dir = reversed ? "down" : "up"

  const arrows: ArrowMark[] = [
    { x: (railL + batteryX - 20) / 2, y: topY, dir: horizArrowDir },
    { x: (batteryX + 60 + railR) / 2, y: topY, dir: horizArrowDir },
    { x: railL, y: (topY + bottomOfRails) / 2, dir: leftRailDir },
    { x: railR, y: (topY + bottomOfRails) / 2, dir: rightRailDir },
  ]
  rungYs.forEach((y) => arrows.push({ x: (railL + railR) / 2 - 60, y, dir: rungArrowDir }))

  return { width, height, lines, arrows, stubs, parts, batteryAt: { x: batteryX, y: topY } }
}

// ── Symbol rendering ─────────────────────────────────────────────────────

function ArrowGlyph({ x, y, dir }: ArrowMark) {
  const rot = { up: -90, down: 90, left: 180, right: 0 }[dir]
  return (
    <path
      d="M -8,-6 L 8,0 L -8,6 Z"
      fill={ARROW_COLOR}
      transform={`translate(${x} ${y}) rotate(${rot})`}
    />
  )
}

function OccludeCircle({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={20} fill={CANVAS_BG} stroke={WIRE_COLOR} strokeWidth={2} />
}

function PartSymbol({ part, showLabels, tt }: { part: InlinePart; showLabels: boolean; tt: (en: string, ar: string) => string }) {
  const { x, y, kind } = part
  const label = part.label

  let body: React.ReactNode = null
  switch (kind) {
    case "lamp":
      body = (
        <>
          <OccludeCircle x={x} y={y} />
          <line x1={x - 11} y1={y - 11} x2={x + 11} y2={y + 11} stroke={WIRE_COLOR} strokeWidth={1.5} />
          <line x1={x - 11} y1={y + 11} x2={x + 11} y2={y - 11} stroke={WIRE_COLOR} strokeWidth={1.5} />
        </>
      )
      break
    case "buzzer":
      body = (
        <>
          <OccludeCircle x={x} y={y} />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>B</text>
        </>
      )
      break
    case "motor":
      body = (
        <>
          <OccludeCircle x={x} y={y} />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>M</text>
        </>
      )
      break
    case "ammeter":
      body = (
        <>
          <OccludeCircle x={x} y={y} />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>A</text>
        </>
      )
      break
    case "voltmeter":
      body = (
        <>
          <OccludeCircle x={x} y={y} />
          <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>V</text>
        </>
      )
      break
    case "resistor":
    case "rheostat":
      body = (
        <>
          <rect x={x - 26} y={y - 12} width={52} height={24} fill={CANVAS_BG} />
          <polyline
            points={`${x - 22},${y} ${x - 14},${y - 8} ${x - 6},${y + 8} ${x + 2},${y - 8} ${x + 10},${y + 8} ${x + 18},${y - 8} ${x + 22},${y}`}
            fill="none"
            stroke={WIRE_COLOR}
            strokeWidth={1.5}
          />
          {kind === "rheostat" && (
            <g>
              <line x1={x - 20} y1={y + 16} x2={x + 20} y2={y - 16} stroke={WIRE_COLOR} strokeWidth={1.5} />
              <path d="M -6,-4 L 6,0 L -6,4 Z" fill={WIRE_COLOR} transform={`translate(${x + 20} ${y - 16}) rotate(-38)`} />
            </g>
          )}
        </>
      )
      break
    case "diode":
    case "led":
      body = (
        <>
          <rect x={x - 18} y={y - 14} width={36} height={28} fill={CANVAS_BG} />
          <polygon points={`${x - 12},${y - 10} ${x - 12},${y + 10} ${x + 8},${y}`} fill="none" stroke={WIRE_COLOR} strokeWidth={1.5} />
          <line x1={x + 8} y1={y - 11} x2={x + 8} y2={y + 11} stroke={WIRE_COLOR} strokeWidth={1.5} />
          {kind === "led" && (
            <g stroke={WIRE_COLOR} strokeWidth={1.2}>
              <line x1={x + 2} y1={y - 14} x2={x + 10} y2={y - 22} />
              <path d="M -4,-3 L 4,0 L -4,3 Z" fill={WIRE_COLOR} transform={`translate(${x + 10} ${y - 22}) rotate(-45)`} />
              <line x1={x + 9} y1={y - 10} x2={x + 17} y2={y - 18} />
              <path d="M -4,-3 L 4,0 L -4,3 Z" fill={WIRE_COLOR} transform={`translate(${x + 17} ${y - 18}) rotate(-45)`} />
            </g>
          )}
        </>
      )
      break
    case "fuse":
      body = (
        <>
          <rect x={x - 16} y={y - 9} width={32} height={18} rx={7} fill={CANVAS_BG} stroke={WIRE_COLOR} strokeWidth={1.5} />
          <line x1={x - 16} y1={y} x2={x + 16} y2={y} stroke={WIRE_COLOR} strokeWidth={1} />
        </>
      )
      break
    case "switch-closed":
      body = (
        <>
          <rect x={x - 20} y={y - 10} width={40} height={20} fill={CANVAS_BG} />
          <circle cx={x - 15} cy={y} r={2.5} fill={WIRE_COLOR} />
          <circle cx={x + 15} cy={y} r={2.5} fill={WIRE_COLOR} />
          <line x1={x - 15} y1={y} x2={x + 15} y2={y} stroke={WIRE_COLOR} strokeWidth={1.5} />
        </>
      )
      break
    case "switch-open":
      body = (
        <>
          <rect x={x - 20} y={y - 14} width={40} height={24} fill={CANVAS_BG} />
          <circle cx={x - 15} cy={y} r={2.5} fill={WIRE_COLOR} />
          <circle cx={x + 15} cy={y} r={2.5} fill={WIRE_COLOR} />
          <line x1={x - 15} y1={y} x2={x + 13} y2={y - 12} stroke={WIRE_COLOR} strokeWidth={1.5} />
        </>
      )
      break
  }

  const showText = showLabels && label && (label.name || label.power || label.meaning)

  return (
    <g>
      {body}
      {showText && (
        <text x={x} y={y - 26} textAnchor="middle" fontSize={11} fill="#1e40af">
          {[label?.name, label?.power, label?.meaning].filter(Boolean).join("  ")}
        </text>
      )}
    </g>
  )
}

function BatterySymbol({ x, y, cells, polarity }: { x: number; y: number; cells: number; polarity: Polarity }) {
  const gap = 14
  const start = x - ((cells - 1) * gap) / 2
  const plusFirst = polarity === "left-plus"
  return (
    <g>
      <rect x={start - gap * cells - 4} y={y - 22} width={gap * cells * 2 + 8} height={44} fill={CANVAS_BG} />
      {Array.from({ length: cells }).map((_, i) => {
        const cx = start + i * gap
        return (
          <g key={i}>
            <line x1={cx - gap / 2} y1={y - 16} x2={cx - gap / 2} y2={y + 16} stroke={WIRE_COLOR} strokeWidth={3} />
            <line x1={cx + gap / 2} y1={y - 8} x2={cx + gap / 2} y2={y + 8} stroke={WIRE_COLOR} strokeWidth={1.5} />
          </g>
        )
      })}
      <text x={start - gap * (cells - 0.5) - 14} y={y - 22} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>
        {plusFirst ? "+" : "-"}
      </text>
      <text x={start + gap * (cells - 0.5) + 14} y={y - 22} textAnchor="middle" fontSize={13} fontWeight={700} fill={WIRE_COLOR}>
        {plusFirst ? "-" : "+"}
      </text>
    </g>
  )
}

// ── Main component ──────────────────────────────────────────────────────

export function CircuitSimulator() {
  const locale = useLocale()
  const isAr = locale === "ar"
  const tt = (en: string, ar: string) => (isAr ? ar : en)
  const tSidebar = useTranslations("sidebar")
  const svgRef = useRef<SVGSVGElement>(null)

  const [state, setState] = useState<CircuitState>(() => makeDefaultState())

  const update = (partial: Partial<CircuitState>) => setState((s) => ({ ...s, ...partial }))
  const updateElement = (id: number, partial: Partial<CircuitElementState>) =>
    setState((s) => ({
      ...s,
      elements: s.elements.map((el) => (el.id === id ? { ...el, ...partial } : el)),
    }))
  const addElement = () => setState((s) => ({ ...s, elements: [...s.elements, makeElement()] }))
  const removeElement = (id: number) =>
    setState((s) => ({ ...s, elements: s.elements.filter((el) => el.id !== id) }))
  const resetAll = () => setState(makeDefaultState())

  const reversed = state.polarity === "left-minus"
  const model = useMemo(() => buildModel(state, reversed), [state, reversed])

  const handleDownload = () => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgEl)
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement("canvas")
      canvas.width = model.width * scale
      canvas.height = model.height * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.fillStyle = CANVAS_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) return
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = "circuit-diagram.png"
        link.click()
        URL.revokeObjectURL(link.href)
      })
    }
    img.src = url
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 dark:bg-gray-900">
        <div className="flex gap-2">
          <Button onClick={handleDownload} className="bg-green-600 text-white hover:bg-green-700">
            <Download className="h-4 w-4" />
            {tt("Download the diagram", "تحميل المخطط")}
          </Button>
          <Button variant="outline" onClick={resetAll}>
            <FilePlus2 className="h-4 w-4" />
            {tt("New plan", "مخطط جديد")}
          </Button>
        </div>
        <div className="text-center">
          <h1 className="flex items-center gap-2 text-lg font-bold text-blue-900 dark:text-blue-300">
            <Zap className="h-5 w-5" />
            {tSidebar("circuit_simulator")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {tt("Draw an electrical circuit diagram", "رسم مخطط الدارة الكهربائية")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={state.showLabels} onCheckedChange={(v) => update({ showLabels: !!v })} />
          {tt("Show labels and meanings", "إظهار الأسماء والدلالات")}
        </label>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
        {/* Canvas */}
        <div
          className="flex flex-1 items-center justify-center rounded-lg border p-6"
          style={{
            backgroundColor: "#eef2fb",
            backgroundImage:
              "linear-gradient(#dbe3f5 1px, transparent 1px), linear-gradient(90deg, #dbe3f5 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="max-w-full overflow-auto rounded-md bg-white p-4 shadow-sm">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${model.width} ${model.height}`}
              width={model.width}
              height={model.height}
              style={{ background: CANVAS_BG }}
            >
              {model.lines.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={WIRE_COLOR} strokeWidth={2} />
              ))}
              {model.stubs.map((s, i) => (
                <g key={i}>
                  <line x1={s.x} y1={s.y1} x2={s.x} y2={s.y2} stroke={WIRE_COLOR} strokeWidth={1.5} />
                  <PartSymbol part={{ x: s.x, y: s.y2, kind: "voltmeter" }} showLabels={false} tt={tt} />
                </g>
              ))}
              <BatterySymbol x={model.batteryAt.x} y={model.batteryAt.y} cells={state.numCells} polarity={state.polarity} />
              {model.parts.map((p, i) => (
                <PartSymbol key={i} part={p} showLabels={state.showLabels} tt={tt} />
              ))}
              {state.showArrows && model.arrows.map((a, i) => <ArrowGlyph key={i} {...a} />)}
              {state.showLabels && (state.sourceName || state.sourceIndication) && (
                <text x={model.batteryAt.x} y={model.batteryAt.y + 44} textAnchor="middle" fontSize={12} fill="#1e40af">
                  {[state.sourceName, state.sourceIndication].filter(Boolean).join("  ")}
                </text>
              )}
            </svg>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full space-y-4 lg:w-[420px] lg:shrink-0">
          <Section title={tt("1. Connection method", "1. طريقة التوصيل")}>
            <div className="grid grid-cols-2 gap-2">
              <ToggleTile
                active={state.connectionMethod === "parallel"}
                onClick={() => update({ connectionMethod: "parallel" })}
                label={tt("On the branch", "على التفرع")}
              />
              <ToggleTile
                active={state.connectionMethod === "series"}
                onClick={() => update({ connectionMethod: "series" })}
                label={tt("In sequence", "على التسلسل")}
              />
            </div>
          </Section>

          <Section title={tt("2. Conventional current direction", "2. الجانب التقليدي للتيار")}>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={state.showArrows} onCheckedChange={(v) => update({ showArrows: !!v })} />
              {tt("Show current direction arrows", "إظهار أسهم اتجاه التيار")}
            </label>
          </Section>

          <Section title={tt("3. Power supply and circuit control", "3. مصدر التغذية والتحكم")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tt("Battery polarity", "قطبية المولد")}>
                <Select value={state.polarity} onValueChange={(v) => update({ polarity: v as Polarity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left-plus">(+ | -)</SelectItem>
                    <SelectItem value="left-minus">(- | +)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("Number of cells", "عدد الأعمدة")}>
                <Select value={String(state.numCells)} onValueChange={(v) => update({ numCells: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>{tt(`column ${n}`, `عمود ${n}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("Source", "المصدر")}>
                <Select value={state.sourceType} onValueChange={(v) => update({ sourceType: v as SourceType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="battery">{tt("battery", "مولد بطارية")}</SelectItem>
                    <SelectItem value="generator">{tt("generator", "مولد")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("Source indication", "بيان المصدر")}>
                <Input placeholder={tt("Example: 4.5V", "مثال: 4.5V")} value={state.sourceIndication}
                  onChange={(e) => update({ sourceIndication: e.target.value })} />
              </Field>
              <Field label={tt("Source name", "اسم المصدر")}>
                <Input placeholder={tt("Example: E", "مثال: E")} value={state.sourceName}
                  onChange={(e) => update({ sourceName: e.target.value })} />
              </Field>
              <Field label={tt("Fuse", "الصهير")}>
                <Select value={state.fuseState} onValueChange={(v) => update({ fuseState: v as FuseState })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="without">{tt("without", "بدون")}</SelectItem>
                    <SelectItem value="with">{tt("with", "مع")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {state.fuseState === "with" && (
                <Field label={tt("Fuse name", "اسم الصهير")}>
                  <Input placeholder={tt("Example: K", "مثال: K")} value={state.fuseName}
                    onChange={(e) => update({ fuseName: e.target.value })} />
                </Field>
              )}
              <Field label={tt("Main switch", "القاطعة الرئيسية")}>
                <Select value={state.switchState} onValueChange={(v) => update({ switchState: v as SwitchState })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closed">{tt("Closed switch", "قاطعة مغلقة")}</SelectItem>
                    <SelectItem value="open">{tt("Open switch", "قاطعة مفتوحة")}</SelectItem>
                    <SelectItem value="none">{tt("None", "بدون")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex gap-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={state.mainAmmeter} onCheckedChange={(v) => update({ mainAmmeter: !!v })} />
                {tt("Adding an ammeter", "إضافة أميرمتر")}
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={state.mainVoltmeter} onCheckedChange={(v) => update({ mainVoltmeter: !!v })} />
                {tt("Adding a voltmeter", "إضافة فولتمتر")}
              </label>
            </div>
          </Section>

          <Section title={tt(`4. Adding other electrical components (${state.elements.length})`, `4. إضافة عناصر كهربائية (${state.elements.length})`)}>
            <div className="space-y-3">
              {state.elements.map((el, i) => (
                <div key={el.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{tt(`Element (${i + 1})`, `العنصر (${i + 1})`)}</span>
                    <button
                      onClick={() => removeElement(el.id)}
                      className="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200"
                      aria-label={tt("Remove element", "حذف العنصر")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={tt("Name (e.g. L1)", "الاسم (مثال L1)")} value={el.name}
                      onChange={(e) => updateElement(el.id, { name: e.target.value })} />
                    <Select value={el.type} onValueChange={(v) => updateElement(el.id, { type: v as ElementType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ELEMENT_TYPES.map((et) => (
                          <SelectItem key={et.value} value={et.value}>{tt(et.en, et.ar)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder={tt("Power (e.g. 6W)", "القدرة (مثال 6W)")} value={el.power}
                      onChange={(e) => updateElement(el.id, { power: e.target.value })} />
                    <Input placeholder={tt("Rating (e.g. 6V)", "الدلالة (مثال 6V)")} value={el.meaning}
                      onChange={(e) => updateElement(el.id, { meaning: e.target.value })} />
                  </div>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox checked={el.ammeter} onCheckedChange={(v) => updateElement(el.id, { ammeter: !!v })} />
                      {tt("Ammeter", "أميرمتر")}
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <Checkbox checked={el.voltmeter} onCheckedChange={(v) => updateElement(el.id, { voltmeter: !!v })} />
                      {tt("Voltmeter", "فولتمتر")}
                    </label>
                  </div>
                </div>
              ))}
              <button
                onClick={addElement}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-blue-400 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                {tt("Add an electrical element", "إضافة عنصر كهربائي")}
              </button>
            </div>
          </Section>

          <Button
            className="w-full bg-blue-800 text-white hover:bg-blue-900"
            onClick={() => setState((s) => ({ ...s }))}
          >
            <Zap className="h-4 w-4" />
            {tt("Automatically draws the circuit diagram", "رسم المخطط تلقائيًا")}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-bold text-blue-900 dark:text-blue-300">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ToggleTile({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border py-2 text-sm font-semibold transition-colors",
        active ? "border-blue-600 bg-blue-50 text-blue-800" : "border-input text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  )
}
