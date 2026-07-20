import { supabase } from '../config/supabase'

export type LogoShape = 'circle' | 'rounded' | 'square' | 'rectangle'

export interface LogoAppearance {
  logo_shape: LogoShape
  logo_border_width: number
  logo_border_color: string
}

export const DEFAULT_LOGO_APPEARANCE: LogoAppearance = {
  logo_shape: 'circle',
  logo_border_width: 0,
  logo_border_color: '#000000',
}

const VALID_SHAPES: LogoShape[] = ['circle', 'rounded', 'square', 'rectangle']

/**
 * Logo appearance is a school-wide setting (one row per school in
 * school_settings, campus_id null) — matches how logo_url itself is a
 * single value per school row, not per-campus.
 */
export const getLogoAppearance = async (schoolId: string): Promise<LogoAppearance> => {
  const { data } = await supabase
    .from('school_settings')
    .select('logo_shape, logo_border_width, logo_border_color')
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .maybeSingle()

  return {
    logo_shape: (data?.logo_shape as LogoShape) || DEFAULT_LOGO_APPEARANCE.logo_shape,
    logo_border_width: data?.logo_border_width ?? DEFAULT_LOGO_APPEARANCE.logo_border_width,
    logo_border_color: data?.logo_border_color || DEFAULT_LOGO_APPEARANCE.logo_border_color,
  }
}

export const updateLogoAppearance = async (
  schoolId: string,
  input: Partial<LogoAppearance>
): Promise<LogoAppearance> => {
  if (input.logo_shape && !VALID_SHAPES.includes(input.logo_shape)) {
    throw new Error(`Invalid logo_shape. Must be one of: ${VALID_SHAPES.join(', ')}`)
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.logo_shape !== undefined) updates.logo_shape = input.logo_shape
  if (input.logo_border_width !== undefined) updates.logo_border_width = input.logo_border_width
  if (input.logo_border_color !== undefined) updates.logo_border_color = input.logo_border_color

  const { data: updatedRows, error: updateError } = await supabase
    .from('school_settings')
    .update(updates)
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .select('id')

  if (updateError) throw new Error(updateError.message)

  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase
      .from('school_settings')
      .insert({ school_id: schoolId, campus_id: null, ...updates })
    if (insertError) throw new Error(insertError.message)
  }

  return getLogoAppearance(schoolId)
}

/**
 * Batch-merges logo appearance into a list of school/campus rows (each must
 * have an `id`), for list endpoints (school directory, campus list) so they
 * don't need a second per-row request. Schools with no school_settings row
 * yet fall back to the defaults.
 */
export async function attachLogoAppearance<T extends { id: string }>(rows: T[]): Promise<(T & LogoAppearance)[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data } = await supabase
    .from('school_settings')
    .select('school_id, logo_shape, logo_border_width, logo_border_color')
    .in('school_id', ids)
    .is('campus_id', null)

  const bySchoolId = new Map((data || []).map((row: any) => [row.school_id, row]))

  return rows.map((row) => {
    const settings = bySchoolId.get(row.id)
    return {
      ...row,
      logo_shape: (settings?.logo_shape as LogoShape) || DEFAULT_LOGO_APPEARANCE.logo_shape,
      logo_border_width: settings?.logo_border_width ?? DEFAULT_LOGO_APPEARANCE.logo_border_width,
      logo_border_color: settings?.logo_border_color || DEFAULT_LOGO_APPEARANCE.logo_border_color,
    }
  })
}
