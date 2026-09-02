'use client'

import type { HifziCompletionRow } from '@/lib/api/hifzi'

// Single-metric completion % per row (circle, for the admin single-school
// view, or school, for the cross-school inspector view) — a plain progress-
// bar list rather than inspections/ScoreHeatmap.tsx's 2D category grid,
// since that component's shape (many score categories per row) doesn't fit
// this data (one completion % per row). Same color-banding language as
// MinistryBucketBreakdown.tsx for visual consistency across the module.
function bandColor(percent: number): string {
    if (percent >= 85) return 'bg-green-500'
    if (percent >= 65) return 'bg-blue-500'
    if (percent >= 40) return 'bg-amber-500'
    return 'bg-red-500'
}

export function SyllabusCompletionHeatmap({ rows, emptyLabel }: { rows: HifziCompletionRow[]; emptyLabel: string }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>
    }

    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{row.label}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {row.completionPercent.toFixed(1)}% · {row.studentCount}
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className={`h-full rounded-full ${bandColor(row.completionPercent)}`}
                            style={{ width: `${Math.max(0, Math.min(100, row.completionPercent))}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}
