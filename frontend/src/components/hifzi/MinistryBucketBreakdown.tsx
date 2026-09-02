'use client'

import { useTranslations } from 'next-intl'

// Read-only display of the ministry's 4 Tajweed/elocution rubric buckets
// (Pronunciation, Tajweed Rules, Memory Retention, Fluency) — a pure
// read-time classification of the same 12 error types the recite screen's
// ErrorTypePicker already uses (grading-engine.service.ts's
// computeMinistryBucketScores), never a separate write path. Used by the
// (future) ministry report card and, in Phase 3, the inspector dashboard.

export interface MinistryBucketScores {
  pronunciation: number
  tajweed_rules: number
  memory_retention: number
  fluency: number
}

const BUCKET_ORDER: (keyof MinistryBucketScores)[] = ['pronunciation', 'tajweed_rules', 'memory_retention', 'fluency']

function bucketColor(score: number): string {
  if (score >= 8.5) return 'bg-green-500'
  if (score >= 6.5) return 'bg-blue-500'
  if (score >= 5.0) return 'bg-amber-500'
  return 'bg-red-500'
}

export function MinistryBucketBreakdown({ scores }: { scores: MinistryBucketScores }) {
    const t = useTranslations('hifzi.ministryBuckets')

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BUCKET_ORDER.map((bucket) => (
                <div key={bucket} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t(bucket)}</span>
                        <span className="font-semibold">{scores[bucket].toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className={`h-full rounded-full ${bucketColor(scores[bucket])}`}
                            style={{ width: `${Math.max(0, Math.min(100, scores[bucket] * 10))}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}
