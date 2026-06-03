import { supabase } from '../config/supabase'

// ============================================================================
// Types
// ============================================================================

export interface DisciplineScoreBreakdown {
  referral_id: string
  incident_date: string
  field_name: string
  delta: number
  detail: string
}

export interface DisciplineScoreResult {
  score: number
  total_delta: number
  referral_count: number
  breakdown: DisciplineScoreBreakdown[]
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns the penalty value if the first option is a negative number, else null */
function parsePenalty(firstOption: string): number | null {
  const num = parseFloat(firstOption)
  return !isNaN(num) && num < 0 ? num : null
}

// ============================================================================
// Service
// ============================================================================

export async function getStudentDisciplineScore(params: {
  studentId: string
  schoolId: string
  campusId?: string | null
  academicYearId?: string | null
}): Promise<DisciplineScoreResult> {
  const { studentId, schoolId, campusId, academicYearId } = params

  // ── 1. Plugin check ──────────────────────────────────────────────────────
  let pluginActive = false

  if (campusId) {
    const { data: campusSettings } = await supabase
      .from('school_settings')
      .select('active_plugins')
      .eq('school_id', schoolId)
      .eq('campus_id', campusId)
      .maybeSingle()
    pluginActive = !!campusSettings?.active_plugins?.discipline_score
  }

  if (!pluginActive) {
    const { data: schoolSettings } = await supabase
      .from('school_settings')
      .select('active_plugins')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()
    pluginActive = !!schoolSettings?.active_plugins?.discipline_score
  }

  if (!pluginActive) throw new Error('PLUGIN_INACTIVE')

  // ── 2. Fetch discipline fields ───────────────────────────────────────────
  const { data: fields, error: fieldsError } = await supabase
    .from('discipline_fields')
    .select('id, name, field_type, options')
    .eq('school_id', schoolId)
    .eq('is_active', true)

  if (fieldsError) throw fieldsError

  // Index by both id and name so we can look up field_values keys either way
  const fieldMap: Record<string, { id: string; name: string; field_type: string; options: string[] | null }> = {}
  for (const f of (fields || [])) {
    fieldMap[f.name] = f
    fieldMap[f.id] = f
  }

  // ── 3. Fetch referrals for this student ──────────────────────────────────
  let query = supabase
    .from('discipline_referrals')
    .select('id, incident_date, field_values')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .order('incident_date', { ascending: false })

  if (campusId) query = (query as any).eq('campus_id', campusId)
  if (academicYearId) query = (query as any).eq('academic_year_id', academicYearId)

  const { data: referrals, error: refError } = await query
  if (refError) throw refError

  // ── 4. Calculate score from penalty markers ──────────────────────────────
  // Convention: if the first option of a field is a negative number it is a
  // penalty marker and does not appear as a selectable value.
  //   multiple_checkbox → penalty × number_of_items_selected
  //   select / multiple_radio → flat penalty once (if anything selected)
  let totalDelta = 0
  const breakdown: DisciplineScoreBreakdown[] = []

  for (const referral of (referrals || [])) {
    const fieldValues: Record<string, unknown> = referral.field_values || {}

    for (const [key, value] of Object.entries(fieldValues)) {
      const field = fieldMap[key]
      if (!field?.options || field.options.length === 0) continue

      const penalty = parsePenalty(field.options[0])
      if (penalty === null) continue // no penalty marker on this field

      let delta = 0
      let detail = ''

      if (field.field_type === 'multiple_checkbox') {
        // value is an array of selected labels (the penalty marker is not selectable)
        const selected = Array.isArray(value) ? (value as string[]) : []
        if (selected.length > 0) {
          delta = penalty * selected.length
          detail = `${selected.length} violation(s) selected`
        }
      } else if (field.field_type === 'select' || field.field_type === 'multiple_radio') {
        // value is a string — apply flat penalty once if anything is picked
        const selectedValue = Array.isArray(value) ? (value as string[])[0] : (value as string)
        if (selectedValue) {
          delta = penalty
          detail = String(selectedValue)
        }
      }

      if (delta !== 0) {
        totalDelta += delta
        breakdown.push({
          referral_id: referral.id,
          incident_date: referral.incident_date,
          field_name: field.name,
          delta,
          detail,
        })
      }
    }
  }

  const score = Math.max(0, Math.min(100, 100 + totalDelta))

  return {
    score,
    total_delta: totalDelta,
    referral_count: (referrals || []).length,
    breakdown,
  }
}
