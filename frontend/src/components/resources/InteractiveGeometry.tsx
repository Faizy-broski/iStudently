"use client"

// Interactive geometry construction board built on JSXGraph (MIT/LGPL-3.0 —
// license-clean for commercial use, unlike GeoGebra's web app, which requires
// a paid commercial license for use on a fee-charging platform like this one).
// JSXGraph is a vanilla-JS board library with no built-in toolbar UI, so the
// toolbar/tool-selection UX below is ours; the board itself is JSXGraph's.

import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  MousePointer2, Circle as CircleIcon, Minus, Spline, Hexagon,
  GitCommitHorizontal, PenTool, Type as TypeIcon, Eraser, Trash2, Compass,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
// jsxgraph's package.json `exports` map only exposes the root module, not
// `distrib/jsxgraph.css` — that subpath 404s under Node's exports encapsulation
// even though the file exists on disk. Vendoring the (small, stable) CSS file
// locally sidesteps that packaging gap.
import "./jsxgraph.css"

type ToolId =
  | "move" | "point" | "line" | "segment" | "circle" | "polygon"
  | "midpoint" | "perpendicular" | "parallel" | "angle" | "text" | "delete"

// Tools that act on click points the user places fresh (new point per click).
const FREEHAND_TOOLS: ToolId[] = ["point", "line", "segment", "circle", "polygon", "text"]
// Tools that act on EXISTING points already on the board (click near one to pick it).
const PICKING_TOOLS: ToolId[] = ["midpoint", "perpendicular", "parallel", "angle"]
const CLICKS_NEEDED: Partial<Record<ToolId, number>> = {
  point: 1, line: 2, segment: 2, circle: 2, text: 1,
  // perpendicular/parallel: first 2 picks define the reference line, the 3rd
  // picks the point the new line passes through.
  midpoint: 2, angle: 3, perpendicular: 3, parallel: 3,
}

const PICK_RADIUS = 0.35 // in board user-units

export function InteractiveGeometry() {
  const locale = useLocale()
  const isAr = locale === "ar"
  const tt = (en: string, ar: string) => (isAr ? ar : en)
  const tSidebar = useTranslations("sidebar")

  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<any>(null)
  const jxgRef = useRef<any>(null)
  const pendingRef = useRef<any[]>([]) // points/coords collected so far for the active tool
  const [tool, setTool] = useState<ToolId>("move")
  const [ready, setReady] = useState(false)
  const toolRef = useRef(tool)
  toolRef.current = tool

  useEffect(() => {
    let disposed = false
    import("jsxgraph").then((mod) => {
      if (disposed || !containerRef.current) return
      const JXG = (mod as any).default ?? mod
      jxgRef.current = JXG
      const board = JXG.JSXGraph.initBoard(containerRef.current, {
        boundingbox: [-8, 8, 8, -8],
        axis: true,
        grid: true,
        showCopyright: false,
        showNavigation: true,
        pan: { enabled: true, needShift: false },
        zoom: { enabled: true, wheel: true, needShift: false },
        keepAspectRatio: true,
      })
      boardRef.current = board

      board.on("down", (evt: any) => handleBoardClick(JXG, board, evt))
      setReady(true)
    })
    return () => {
      disposed = true
      if (boardRef.current && jxgRef.current) {
        jxgRef.current.JSXGraph.freeBoard(boardRef.current)
        boardRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function nearestExistingPoint(board: any, x: number, y: number) {
    let best: any = null
    let bestDist = PICK_RADIUS
    for (const obj of board.objectsList as any[]) {
      if (obj.elType !== "point") continue
      const d = Math.hypot(obj.X() - x, obj.Y() - y)
      if (d < bestDist) { best = obj; bestDist = d }
    }
    return best
  }

  function nearestObject(board: any, evt: any) {
    const [sx, sy] = board.getMousePosition(evt)
    let best: any = null
    for (const obj of board.objectsList as any[]) {
      if (typeof obj.hasPoint !== "function") continue
      try {
        if (obj.hasPoint(sx, sy)) { best = obj; break }
      } catch {
        // some element types' hasPoint signature differs; skip on error
      }
    }
    return best
  }

  function resetPending() {
    pendingRef.current = []
  }

  function handleBoardClick(JXG: any, board: any, evt: any) {
    const t = toolRef.current
    if (t === "move") return // native JSXGraph dragging handles this
    if (t === "delete") {
      const obj = nearestObject(board, evt)
      if (obj && obj.elType !== "axis" && !String(obj.id || "").includes("grid")) {
        board.removeObject(obj)
      }
      return
    }

    const usr = board.getUsrCoordsOfMouse(evt)
    const [x, y] = usr

    if (FREEHAND_TOOLS.includes(t)) {
      if (t === "text") {
        const content = window.prompt(tt("Label text:", "نص التسمية:"), "")
        if (content) board.create("text", [x, y, content], {})
        return
      }
      if (t === "point") {
        board.create("point", [x, y], {})
        return
      }
      pendingRef.current.push([x, y])
      const need = CLICKS_NEEDED[t] ?? 1
      if (pendingRef.current.length >= need) {
        const pts = pendingRef.current.map((c) => board.create("point", c, { withLabel: false }))
        if (t === "line") board.create("line", pts, {})
        else if (t === "segment") board.create("segment", pts, {})
        else if (t === "circle") board.create("circle", pts, {})
        else if (t === "polygon") board.create("polygon", pts, {})
        resetPending()
      }
      return
    }

    if (PICKING_TOOLS.includes(t)) {
      const picked = nearestExistingPoint(board, x, y)
      if (!picked) return // ignore clicks that don't land near an existing point
      pendingRef.current.push(picked)
      const need = CLICKS_NEEDED[t] ?? 2
      if (pendingRef.current.length >= need) {
        const pts = pendingRef.current
        if (t === "midpoint") board.create("midpoint", pts, {})
        else if (t === "angle") board.create("angle", pts, {})
        else if (t === "perpendicular" || t === "parallel") {
          // First 2 picks define the reference line (drawn hidden), the 3rd
          // pick is the point the new line passes through.
          const line = board.create("line", [pts[0], pts[1]], { visible: false })
          board.create(t, [line, pts[2]], {})
        }
        resetPending()
      }
      return
    }
  }

  const handleToolChange = (next: ToolId) => {
    resetPending()
    setTool(next)
  }

  const handleClearBoard = () => {
    const board = boardRef.current
    if (!board) return
    board.suspendUpdate()
    for (const obj of [...board.objectsList] as any[]) {
      if (obj.elType === "axis" || obj.elType === "grid" || obj.elType === "ticks") continue
      board.removeObject(obj)
    }
    board.unsuspendUpdate()
    board.update()
    resetPending()
  }

  const tools: { id: ToolId; icon: React.ReactNode; label: string }[] = [
    { id: "move", icon: <MousePointer2 className="h-4 w-4" />, label: tt("Move", "تحريك") },
    { id: "point", icon: <div className="h-2 w-2 rounded-full bg-current" />, label: tt("Point", "نقطة") },
    { id: "line", icon: <Spline className="h-4 w-4" />, label: tt("Line", "خط مستقيم") },
    { id: "segment", icon: <Minus className="h-4 w-4" />, label: tt("Segment", "قطعة مستقيمة") },
    { id: "circle", icon: <CircleIcon className="h-4 w-4" />, label: tt("Circle", "دائرة") },
    { id: "polygon", icon: <Hexagon className="h-4 w-4" />, label: tt("Polygon", "مضلع") },
    { id: "midpoint", icon: <GitCommitHorizontal className="h-4 w-4" />, label: tt("Midpoint", "منتصف") },
    { id: "perpendicular", icon: <PenTool className="h-4 w-4" />, label: tt("Perpendicular", "عمودي") },
    { id: "parallel", icon: <PenTool className="h-4 w-4 rotate-90" />, label: tt("Parallel", "متوازي") },
    { id: "angle", icon: <Compass className="h-4 w-4" />, label: tt("Angle", "زاوية") },
    { id: "text", icon: <TypeIcon className="h-4 w-4" />, label: tt("Text", "نص") },
    { id: "delete", icon: <Eraser className="h-4 w-4" />, label: tt("Delete", "حذف عنصر") },
  ]

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2 dark:bg-gray-900">
        <h1 className="mr-2 flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-300">
          <Compass className="h-4 w-4" />
          {tSidebar("interactive_geometry")}
        </h1>
        <div className="mx-2 h-6 w-px bg-border" />
        {tools.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tool === t.id ? "default" : "outline"}
            onClick={() => handleToolChange(t.id)}
            title={t.label}
            className={cn("gap-1.5", tool === t.id && "bg-blue-700 hover:bg-blue-800")}
          >
            {t.icon}
            <span className="hidden lg:inline">{t.label}</span>
          </Button>
        ))}
        <div className="mx-2 h-6 w-px bg-border" />
        <Button size="sm" variant="outline" onClick={handleClearBoard} className="gap-1.5 text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
          <span className="hidden lg:inline">{tt("Clear board", "مسح اللوحة")}</span>
        </Button>
      </div>

      {(tool !== "move" && tool !== "delete") && (
        <div className="border-b bg-blue-50 px-3 py-1 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {PICKING_TOOLS.includes(tool)
            ? tt("Click existing points on the board to select them.", "انقر على نقاط موجودة في اللوحة لاختيارها.")
            : tt("Click on the board to place points.", "انقر على اللوحة لوضع النقاط.")}
        </div>
      )}

      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {tt("Loading board…", "جارٍ تحميل اللوحة…")}
          </div>
        )}
      </div>
    </div>
  )
}
