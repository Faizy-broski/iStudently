import { supabase } from '../config/supabase'

export interface LibraryPolicy {
  fine_per_day: number
  max_books_per_student: number
  loan_duration_days: number
}

/** Same fallbacks the library uses when a school has no library settings. */
export const LIBRARY_POLICY_DEFAULTS: LibraryPolicy = { fine_per_day: 0.5, max_books_per_student: 3, loan_duration_days: 14 }

/** Normalises a stored `settings.library` object: accepts the legacy `max_books` key and drops invalid numbers. */
export function normalizeLibraryPolicy(raw: any): LibraryPolicy {
  const lib = raw && typeof raw === 'object' ? raw : {}
  const fine = Number(lib.fine_per_day)
  const maxBooks = Number(lib.max_books_per_student ?? lib.max_books)
  const days = Number(lib.loan_duration_days)
  return {
    fine_per_day: lib.fine_per_day !== undefined && lib.fine_per_day !== null && Number.isFinite(fine) && fine >= 0 ? fine : LIBRARY_POLICY_DEFAULTS.fine_per_day,
    max_books_per_student: Number.isInteger(maxBooks) && maxBooks >= 1 ? maxBooks : LIBRARY_POLICY_DEFAULTS.max_books_per_student,
    loan_duration_days: Number.isInteger(days) && days >= 1 ? days : LIBRARY_POLICY_DEFAULTS.loan_duration_days,
  }
}

/**
 * The library policy that applies to a school or campus: its own `settings.library`, otherwise the
 * main school's (a campus inherits), otherwise the defaults. The library, the loan rules and the
 * settings screen all read through this, so what a librarian saves is what the loans use.
 */
export async function resolveLibraryPolicy(schoolId: string): Promise<LibraryPolicy> {
  const { data: school } = await supabase.from('schools').select('settings, parent_school_id').eq('id', schoolId).maybeSingle()
  let lib = (school as any)?.settings?.library
  const parentId = (school as any)?.parent_school_id as string | null | undefined
  if (!lib && parentId) {
    const { data: parent } = await supabase.from('schools').select('settings').eq('id', parentId).maybeSingle()
    lib = (parent as any)?.settings?.library
  }
  return normalizeLibraryPolicy(lib)
}
