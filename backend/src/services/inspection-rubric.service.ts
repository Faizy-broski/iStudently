import { supabase } from '../config/supabase'
import type { RubricTemplate, RubricCategory, RubricCriterion } from '../types/inspection-rubric.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'
const canRead = (role: string) => isAdminRole(role) || role === 'inspector'

// The §4-fold-in default: "Student Outputs & Assessment" ships baked into the
// auto-seeded default template so it's never accidentally left out — see
// ensureDefaultTemplate() below.
const DEFAULT_CATEGORIES: Array<{ name: string; weight: number; criteria: string[] }> = [
  {
    name: 'Lesson Delivery & Classroom Management',
    weight: 30,
    criteria: [
      'Clarity of lesson objectives',
      'Pacing and time management',
      'Student engagement and participation',
      'Classroom management and behavior handling',
    ],
  },
  {
    name: 'Instructional Practices',
    weight: 25,
    criteria: [
      'Use of varied teaching methods',
      'Differentiation for student needs',
      'Use of instructional resources/technology',
    ],
  },
  {
    name: 'Student Outputs & Assessment',
    weight: 25,
    criteria: [
      'Notebook grading commitment',
      'Feedback quality on student work',
      'Exam comprehensiveness',
      'Ministry-spec curriculum alignment',
    ],
  },
  {
    name: 'Professional Conduct',
    weight: 20,
    criteria: [
      'Punctuality and preparedness',
      'Communication with students',
    ],
  },
]

/** Returns the org-wide active template with nested categories/criteria, or null if none configured yet. */
export async function getActiveRubric(caller: CallerContext): Promise<RubricTemplate | null> {
  if (!canRead(caller.role)) throw new Error('Access denied')

  const { data: template, error } = await supabase
    .from('rubric_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load rubric: ${error.message}`)
  if (!template) return null

  return hydrateTemplate(template)
}

/** Exported for inspection-evaluation.service.ts, which needs to hydrate a
 *  SPECIFIC (possibly no-longer-active) template snapshot by id, not just
 *  "whatever the currently active one is" — getActiveRubric() only reads
 *  is_active=true, which wouldn't find an older template. */
export async function hydrateTemplate(template: RubricTemplate): Promise<RubricTemplate> {
  const { data: categories, error: catError } = await supabase
    .from('rubric_categories')
    .select('*')
    .eq('template_id', template.id)
    .order('sort_order', { ascending: true })

  if (catError) throw new Error(`Failed to load rubric categories: ${catError.message}`)

  const categoryIds = (categories || []).map((c) => c.id)
  let criteriaByCategory: Record<string, RubricCriterion[]> = {}

  if (categoryIds.length > 0) {
    const { data: criteria, error: critError } = await supabase
      .from('rubric_criteria')
      .select('*')
      .in('category_id', categoryIds)
      .order('sort_order', { ascending: true })

    if (critError) throw new Error(`Failed to load rubric criteria: ${critError.message}`)

    criteriaByCategory = (criteria || []).reduce((acc, c) => {
      ;(acc[c.category_id] ||= []).push(c)
      return acc
    }, {} as Record<string, RubricCriterion[]>)
  }

  return {
    ...template,
    categories: (categories || []).map((c) => ({ ...c, criteria: criteriaByCategory[c.id] || [] })),
  }
}

/** Admin-only: creates the org's default template (with §4 baked in) if none exists yet. Idempotent. */
export async function ensureDefaultTemplate(caller: CallerContext): Promise<RubricTemplate> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const existing = await getActiveRubric(caller)
  if (existing) return existing

  const { data: template, error: templateError } = await supabase
    .from('rubric_templates')
    .insert({ name: 'Default Inspection Rubric', is_active: true, created_by: caller.profileId })
    .select('*')
    .single()

  if (templateError) throw new Error(`Failed to create default rubric: ${templateError.message}`)

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i]
    const { data: category, error: catError } = await supabase
      .from('rubric_categories')
      .insert({ template_id: template.id, name: cat.name, weight: cat.weight, sort_order: i })
      .select('*')
      .single()

    if (catError) throw new Error(`Failed to seed rubric category: ${catError.message}`)

    const criteriaRows = cat.criteria.map((name, j) => ({ category_id: category.id, name, sort_order: j }))
    const { error: critError } = await supabase.from('rubric_criteria').insert(criteriaRows)
    if (critError) throw new Error(`Failed to seed rubric criteria: ${critError.message}`)
  }

  return (await getActiveRubric(caller))!
}

// ============================================================================
// CATEGORY CRUD (admin only)
// ============================================================================

export async function createCategory(
  caller: CallerContext,
  templateId: string,
  dto: { name: string; weight?: number; sort_order?: number }
): Promise<RubricCategory> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (!dto.name?.trim()) throw new Error('name is required')

  const { data, error } = await supabase
    .from('rubric_categories')
    .insert({ template_id: templateId, name: dto.name.trim(), weight: dto.weight ?? 0, sort_order: dto.sort_order ?? 0 })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create category: ${error.message}`)
  return data as RubricCategory
}

export async function updateCategory(
  caller: CallerContext,
  id: string,
  dto: { name?: string; weight?: number; sort_order?: number }
): Promise<RubricCategory> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (dto.name !== undefined) patch.name = dto.name.trim()
  if (dto.weight !== undefined) patch.weight = dto.weight
  if (dto.sort_order !== undefined) patch.sort_order = dto.sort_order

  const { data, error } = await supabase.from('rubric_categories').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(`Failed to update category: ${error.message}`)
  return data as RubricCategory
}

export async function deleteCategory(caller: CallerContext, id: string): Promise<void> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const { error } = await supabase.from('rubric_categories').delete().eq('id', id)
  if (error) {
    // FK RESTRICT from rubric_criteria (and transitively evaluation scores)
    // blocks deleting a category that's ever been scored — surface that
    // plainly instead of a raw Postgres constraint error.
    if ((error as any).code === '23503') {
      throw new Error('Cannot delete a category that has criteria with recorded evaluation scores')
    }
    throw new Error(`Failed to delete category: ${error.message}`)
  }
}

// ============================================================================
// CRITERIA CRUD (admin only)
// ============================================================================

export async function createCriterion(
  caller: CallerContext,
  categoryId: string,
  dto: { name: string; description?: string; sort_order?: number }
): Promise<RubricCriterion> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (!dto.name?.trim()) throw new Error('name is required')

  const { data, error } = await supabase
    .from('rubric_criteria')
    .insert({
      category_id: categoryId,
      name: dto.name.trim(),
      description: dto.description || null,
      sort_order: dto.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create criterion: ${error.message}`)
  return data as RubricCriterion
}

export async function updateCriterion(
  caller: CallerContext,
  id: string,
  dto: { name?: string; description?: string; sort_order?: number }
): Promise<RubricCriterion> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (dto.name !== undefined) patch.name = dto.name.trim()
  if (dto.description !== undefined) patch.description = dto.description
  if (dto.sort_order !== undefined) patch.sort_order = dto.sort_order

  const { data, error } = await supabase.from('rubric_criteria').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(`Failed to update criterion: ${error.message}`)
  return data as RubricCriterion
}

export async function deleteCriterion(caller: CallerContext, id: string): Promise<void> {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const { error } = await supabase.from('rubric_criteria').delete().eq('id', id)
  if (error) {
    if ((error as any).code === '23503') {
      throw new Error('Cannot delete a criterion that has recorded evaluation scores')
    }
    throw new Error(`Failed to delete criterion: ${error.message}`)
  }
}
