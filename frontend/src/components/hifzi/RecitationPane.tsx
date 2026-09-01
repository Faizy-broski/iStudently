'use client'

import { cn } from '@/lib/utils'
import { ErrorTypePicker, ERROR_TYPE_COLORS, type ErrorType } from './ErrorTypePicker'
import type { AyahWithText } from '@/lib/api/quran'

export interface WordMark {
    ayahId: string
    wordIndex: number
    errorType: ErrorType
}

interface RecitationPaneProps {
    ayahs: AyahWithText[]
    marks: Map<string, WordMark>
    activePickerKey: string | null
    onWordTap: (ayahId: string, wordIndex: number) => void
    onSelectType: (ayahId: string, wordIndex: number, type: ErrorType) => void
}

export function wordKey(ayahId: string, wordIndex: number): string {
    return `${ayahId}:${wordIndex}`
}

/**
 * Renders a Quran range word-by-word (spec §8.5's tap-to-mark flow). Large
 * type / high-contrast is just the default styling here — most teachers are
 * older, per the spec's explicit note — no separate "accessibility mode" is
 * implemented as a toggle in this pass, the base styling already targets it.
 */
export function RecitationPane({ ayahs, marks, activePickerKey, onWordTap, onSelectType }: RecitationPaneProps) {
    return (
        <div dir="rtl" className="leading-loose text-3xl font-arabic p-6 bg-card rounded-lg border select-none" style={{ lineHeight: 2.4 }}>
            {ayahs.map((ayah) => {
                const words = ayah.textUthmani.split(/\s+/).filter(Boolean)
                return (
                    <span key={ayah.id} className="inline">
                        {words.map((word, i) => {
                            const key = wordKey(ayah.id, i)
                            const mark = marks.get(key)
                            const showPicker = activePickerKey === key
                            return (
                                <span key={key} className="relative inline-block">
                                    <span
                                        onClick={() => onWordTap(ayah.id, i)}
                                        className={cn(
                                            'cursor-pointer rounded px-1 transition-colors hover:bg-muted',
                                            mark && ERROR_TYPE_COLORS[mark.errorType]
                                        )}
                                    >
                                        {word}
                                    </span>{' '}
                                    {showPicker && (
                                        <span className="absolute top-full start-0 mt-1" onClick={(e) => e.stopPropagation()}>
                                            <ErrorTypePicker onSelect={(type) => onSelectType(ayah.id, i, type)} />
                                        </span>
                                    )}
                                </span>
                            )
                        })}
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full border text-sm text-muted-foreground mx-1 align-middle">
                            {ayah.ayahNumber}
                        </span>
                    </span>
                )
            })}
        </div>
    )
}
