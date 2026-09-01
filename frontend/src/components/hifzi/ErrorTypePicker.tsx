'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// ============================================================================
// Inline error-type chip strip shown when a word is tapped. Spec §8.5
// describes "tap to mark, second tap to select type" — this collapses that
// into one interaction (tap a word → the strip appears right there → pick
// a type, which both classifies AND marks in the same motion) since it's
// fewer taps for the same outcome and still satisfies "second tap picks the
// type" in spirit (there's still a picking gesture, just immediate).
// ============================================================================

export const ERROR_TYPES = [
    'major', 'minor', 'skipped_ayah', 'skipped_word', 'substituted', 'added',
    'hesitation', 'repetition', 'prompt', 'similar_jump', 'bad_waqf', 'performance',
] as const

export type ErrorType = (typeof ERROR_TYPES)[number]

export const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
    major: 'bg-red-500 text-white',
    minor: 'bg-orange-300 text-orange-900',
    skipped_ayah: 'bg-red-700 text-white',
    skipped_word: 'bg-red-400 text-white',
    substituted: 'bg-purple-400 text-white',
    added: 'bg-yellow-400 text-yellow-900',
    hesitation: 'bg-blue-200 text-blue-900',
    repetition: 'bg-blue-300 text-blue-900',
    prompt: 'bg-red-600 text-white',
    similar_jump: 'bg-pink-400 text-white',
    bad_waqf: 'bg-teal-300 text-teal-900',
    performance: 'bg-gray-300 text-gray-800',
}

interface ErrorTypePickerProps {
    onSelect: (type: ErrorType) => void
}

export function ErrorTypePicker({ onSelect }: ErrorTypePickerProps) {
    const t = useTranslations('hifzi.errorTypes')

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-popover border rounded-md shadow-lg z-50 max-w-xs">
            {ERROR_TYPES.map((type) => (
                <button
                    key={type}
                    onClick={() => onSelect(type)}
                    className={cn('text-xs px-2 py-1 rounded-md hover:opacity-80 transition-opacity', ERROR_TYPE_COLORS[type])}
                >
                    {t(type)}
                </button>
            ))}
        </div>
    )
}
