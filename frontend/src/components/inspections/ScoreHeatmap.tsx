"use client"

import type { HeatmapRow } from "@/lib/api/inspection-analytics"

// No heatmap component exists anywhere else in this codebase — built fresh
// as a plain Tailwind CSS grid rather than forced into recharts (which has
// no real heatmap primitive).
export function ScoreHeatmap({ rows, emptyLabel }: { rows: HeatmapRow[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">{emptyLabel}</p>
  }

  const categories = [...new Set(rows.flatMap((r) => Object.keys(r.scoresByCategory)))]

  const cellColor = (score: number | undefined) => {
    if (score === undefined) return "bg-gray-50 text-gray-300"
    if (score >= 80) return "bg-green-100 text-green-800"
    if (score >= 60) return "bg-lime-100 text-lime-800"
    if (score >= 40) return "bg-amber-100 text-amber-800"
    return "bg-red-100 text-red-800"
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid text-xs min-w-[500px]"
        style={{ gridTemplateColumns: `160px repeat(${categories.length}, minmax(90px, 1fr))` }}
      >
        <div className="p-2 font-medium text-gray-500 sticky left-0 bg-white" />
        {categories.map((cat) => (
          <div key={cat} className="p-2 font-medium text-gray-500 text-center truncate" title={cat}>
            {cat}
          </div>
        ))}

        {rows.map((row) => (
          <div key={row.label} className="contents">
            <div className="p-2 font-medium text-gray-800 truncate border-t border-gray-100 sticky left-0 bg-white" title={row.label}>
              {row.label}
            </div>
            {categories.map((cat) => {
              const score = row.scoresByCategory[cat]
              return (
                <div key={cat} className={`p-2 text-center border-t border-gray-100 font-semibold ${cellColor(score)}`}>
                  {score !== undefined ? Math.round(score) : "—"}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
