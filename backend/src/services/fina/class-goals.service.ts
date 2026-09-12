import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { isValidReactionKind } from '../../utils/reaction-config'

/**
 * Positive & Skill-Based Reaction Engine — Class Goal Engine (spec: "aggregate
 * weekly reaction counts scoped to students within a specific classId toward
 * target milestones"). Minimal, deliberately: no cron, progress is computed
 * on read.
 *
 * Aggregation rule (see 300_create_fina_class_goals.sql's header for the
 * full reasoning): a goal's progress only counts reactions from STUDENTS in
 * that section, made on posts whose audience_type='classes' and whose
 * audience_ref.section_ids includes the goal's section. Reactions on
 * school-wide posts, and reactions from staff, never count — fina_posts has
 * no direct section_id column to join against, only the classes-audience
 * JSONB, so this is the only rule that doesn't require guessing a reacting
 * user's class from the reaction row alone.
 *
 * Section-ownership check is intentionally simple: any teacher/admin whose
 * resolved schoolId (campus) matches the section's school_id can create a
 * goal for it — this codebase has no teacher-to-section assignment table to
 * validate "their own section" more strictly, and COMPOSE_ROLES-style
 * gating at the route level already limits who can call this at all.
 */

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export interface CreateClassGoalInput {
  /** Exactly one of sectionId/gradeLevelId must be set — see migration 303's
   * header. gradeLevelId exists because the composer's section picker can
   * legitimately be empty for a grade (no sections created yet, or none
   * visible in the caller's resolved scope), which otherwise makes "New
   * goal" permanently unusable for that grade with no way to tell why. */
  sectionId?: string
  gradeLevelId?: string
  reactionKind: string
  targetCount: number
}

export async function createClassGoal(caller: CallerContext, input: CreateClassGoalInput) {
  if (!isValidReactionKind(input.reactionKind)) throw new Error(`Invalid reaction kind: ${input.reactionKind}`)
  if (!Number.isFinite(input.targetCount) || input.targetCount <= 0) throw new Error('targetCount must be a positive number')
  if (!input.sectionId && !input.gradeLevelId) throw new Error('Either a section or a grade level is required')
  if (input.sectionId && input.gradeLevelId) throw new Error('Provide a section or a grade level, not both')

  const now = new Date()
  const weekStart = mondayOf(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

  if (input.sectionId) {
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('id, school_id, campus_id')
      .eq('id', input.sectionId)
      .maybeSingle()
    if (sectionError || !section) throw new Error('Section not found')
    // Same defensive school_id/campus_id check as listComposerAudienceOptions
    // — a resolved caller.schoolId can be a campus id living in either
    // column depending on how the row was created.
    if (section.school_id !== caller.schoolId && section.campus_id !== caller.schoolId) throw new Error('Access denied')

    const { data, error } = await supabase
      .from('fina_class_goals')
      .upsert(
        {
          school_id: caller.schoolId,
          section_id: input.sectionId,
          grade_level_id: null,
          reaction_kind: input.reactionKind,
          target_count: input.targetCount,
          week_start: toDateStr(weekStart),
          week_end: toDateStr(weekEnd),
          created_by: caller.profileId,
        },
        { onConflict: 'section_id,reaction_kind,week_start' }
      )
      .select()
      .single()
    if (error) throw new Error(`Failed to create class goal: ${error.message}`)
    return data
  }

  const { data: grade, error: gradeError } = await supabase
    .from('grade_levels')
    .select('id, school_id, campus_id')
    .eq('id', input.gradeLevelId)
    .maybeSingle()
  if (gradeError || !grade) throw new Error('Grade level not found')
  if (grade.school_id !== caller.schoolId && grade.campus_id !== caller.schoolId) throw new Error('Access denied')

  const { data, error } = await supabase
    .from('fina_class_goals')
    .upsert(
      {
        school_id: caller.schoolId,
        section_id: null,
        grade_level_id: input.gradeLevelId,
        reaction_kind: input.reactionKind,
        target_count: input.targetCount,
        week_start: toDateStr(weekStart),
        week_end: toDateStr(weekEnd),
        created_by: caller.profileId,
      },
      { onConflict: 'grade_level_id,reaction_kind,week_start' }
    )
    .select()
    .single()
  if (error) throw new Error(`Failed to create class goal: ${error.message}`)
  return data
}

/** section_id XOR grade_level_id per the CHECK constraint added in migration
 * 303 — a grade-scoped goal aggregates across every section under that
 * grade, using the same audience_ref->section_ids matching rule a
 * section-scoped goal already used, just widened to "any section in the
 * grade" instead of "the one section". */
async function computeProgress(goal: { id: string; school_id: string; section_id: string | null; grade_level_id: string | null; reaction_kind: string; week_start: string; week_end: string }): Promise<number> {
  let sectionIds: string[]
  if (goal.section_id) {
    sectionIds = [goal.section_id]
  } else if (goal.grade_level_id) {
    const { data: gradeSections } = await supabase.from('sections').select('id').eq('grade_level_id', goal.grade_level_id)
    sectionIds = (gradeSections || []).map((s: any) => s.id as string)
    if (sectionIds.length === 0) return 0
  } else {
    return 0
  }

  const { data: students } = await supabase.from('students').select('profile_id').in('section_id', sectionIds)
  const studentProfileIds = new Set((students || []).map((s: any) => s.profile_id as string).filter(Boolean))
  if (studentProfileIds.size === 0) return 0

  const { data: posts } = await supabase
    .from('fina_posts')
    .select('id, audience_ref')
    .eq('school_id', goal.school_id)
    .eq('audience_type', 'classes')
    .eq('state', 'published')
  const sectionIdSet = new Set(sectionIds)
  const matchingPostIds = (posts || [])
    .filter((p: any) => (p.audience_ref?.section_ids || []).some((sid: string) => sectionIdSet.has(sid)))
    .map((p: any) => p.id as string)
  if (matchingPostIds.length === 0) return 0

  const { data: reactions } = await supabase
    .from('fina_reactions')
    .select('post_id, user_id, kind, created_at')
    .in('post_id', matchingPostIds)
    .eq('kind', goal.reaction_kind)
    .gte('created_at', `${goal.week_start}T00:00:00Z`)
    .lt('created_at', `${new Date(new Date(goal.week_end).getTime() + 86400000).toISOString().split('T')[0]}T00:00:00Z`)

  return (reactions || []).filter((r: any) => studentProfileIds.has(r.user_id)).length
}

export async function listClassGoals(caller: CallerContext, sectionId?: string) {
  let query = supabase.from('fina_class_goals').select('*').eq('school_id', caller.schoolId)
  if (sectionId) query = query.eq('section_id', sectionId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load class goals: ${error.message}`)

  const goals = data || []
  const withProgress = await Promise.all(
    goals.map(async (g: any) => ({ ...g, currentCount: await computeProgress(g) }))
  )
  return withProgress
}
