'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { HeatmapCell } from '@/lib/api/hifzi'

// ============================================================================
// Plain Tailwind CSS grid, not recharts — copying the approach already
// established in frontend/src/components/inspections/ScoreHeatmap.tsx
// (recharts has no real heatmap primitive). Cells grouped by juz (30 rows),
// banded by color.
// ============================================================================

const BAND_COLORS: Record<HeatmapCell['band'], string> = {
    mastered: 'bg-green-700 dark:bg-green-600',
    strong: 'bg-green-400 dark:bg-green-500',
    review_due: 'bg-yellow-400 dark:bg-yellow-500',
    weak: 'bg-orange-400 dark:bg-orange-500',
    critical: 'bg-red-500 dark:bg-red-600',
}

interface MushafHeatmapProps {
    cells: HeatmapCell[]
}

export function MushafHeatmap({ cells }: MushafHeatmapProps) {
    const t = useTranslations('hifzi.heatmap')

    if (cells.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-8">{t('empty')}</p>
    }

    const byJuz = new Map<number, HeatmapCell[]>()
    for (const cell of cells) {
        if (!byJuz.has(cell.juzNumber)) byJuz.set(cell.juzNumber, [])
        byJuz.get(cell.juzNumber)!.push(cell)
    }

    const bands: HeatmapCell['band'][] = ['mastered', 'strong', 'review_due', 'weak', 'critical']

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap text-xs">
                {bands.map((band) => (
                    <span key={band} className="flex items-center gap-1.5">
                        <span className={cn('h-3 w-3 rounded-sm', BAND_COLORS[band])} />
                        {t(band)}
                    </span>
                ))}
            </div>

            <div className="space-y-1.5">
                {[...byJuz.entries()].sort(([a], [b]) => a - b).map(([juz, juzCells]) => (
                    <div key={juz} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">{juz}</span>
                        <div className="flex flex-1 gap-0.5 flex-wrap">
                            {juzCells.map((cell) => (
                                <div
                                    key={cell.unitId}
                                    title={`${Math.round(cell.strength)}%`}
                                    className={cn('h-4 w-4 rounded-sm', BAND_COLORS[cell.band])}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
