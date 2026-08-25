/**
 * Best-effort guess of an academic-year label (e.g. "2025-2026") from a
 * calendar date, using an August cutover.
 *
 * This is only a fallback for when the school's actual current academic
 * year (from `useAcademic()` in AcademicContext) hasn't loaded yet or
 * doesn't exist — always prefer `currentAcademicYear?.name` when available,
 * since the school's real academic_years record is the source of truth
 * fee structures/fees are actually tagged with, and may not follow this
 * naming convention.
 *
 * Shared by /admin/fees/structures and /admin/fees/generate so their
 * fallback guesses can't silently diverge from each other.
 */
export function guessAcademicYear(date: Date): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 1-12
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}
