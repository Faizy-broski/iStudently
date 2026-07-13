import { supabase } from '../config/supabase'
import { createGradeLevel, createSection } from './academics.service'
import { periodsService } from './periods.service'
import { gradingScalesService } from './grading-scales.service'
import { markingPeriodsService } from './marking-periods.service'
import { customFieldsService, type EntityType } from './custom-fields.service'
import { DefaultFieldOrderService } from './default-field-order.service'

export interface CopySchoolSettingsOptions {
  gradeLevels?: boolean
  periods?: boolean
  gradingScales?: boolean
  defaultFieldOrders?: boolean
  customFields?: boolean
  markingPeriods?: boolean
}

export interface CopySchoolSettingsResult {
  counts: {
    gradeLevels: number
    sections: number
    periods: number
    gradingScales: number
    defaultFieldOrders: number
    customFields: number
    markingPeriods: number
  }
  errors: string[]
}

const FIELD_ORDER_ENTITY_TYPES = ['student', 'parent', 'teacher', 'staff'] as const
const CUSTOM_FIELD_ENTITY_TYPES: EntityType[] = ['student', 'teacher', 'parent', 'staff']

// Marking periods form a strict hierarchy (FY -> SEM -> QTR -> PRO); copying in this
// order guarantees a child's parent has already been created (and id-mapped) before
// the child itself is inserted.
const MARKING_PERIOD_TYPE_ORDER = ['FY', 'SEM', 'QTR', 'PRO'] as const

export async function copySchoolSettings(
  sourceSchoolId: string,
  targetSchoolId: string,
  options: CopySchoolSettingsOptions
): Promise<CopySchoolSettingsResult> {
  const counts = {
    gradeLevels: 0,
    sections: 0,
    periods: 0,
    gradingScales: 0,
    defaultFieldOrders: 0,
    customFields: 0,
    markingPeriods: 0,
  }
  const errors: string[] = []

  if (options.gradeLevels) {
    try {
      const { gradeLevels, sections } = await copyGradeLevelsAndSections(sourceSchoolId, targetSchoolId)
      counts.gradeLevels = gradeLevels
      counts.sections = sections
    } catch (err: any) {
      errors.push(`Grade levels: ${err.message || err}`)
    }
  }

  if (options.periods) {
    try {
      counts.periods = await copyPeriods(sourceSchoolId, targetSchoolId)
    } catch (err: any) {
      errors.push(`Periods: ${err.message || err}`)
    }
  }

  if (options.gradingScales) {
    try {
      counts.gradingScales = await copyGradingScales(sourceSchoolId, targetSchoolId)
    } catch (err: any) {
      errors.push(`Grading scales: ${err.message || err}`)
    }
  }

  if (options.defaultFieldOrders) {
    try {
      counts.defaultFieldOrders = await copyDefaultFieldOrders(sourceSchoolId, targetSchoolId)
    } catch (err: any) {
      errors.push(`Default field orders: ${err.message || err}`)
    }
  }

  if (options.customFields) {
    try {
      counts.customFields = await copyCustomFields(sourceSchoolId, targetSchoolId)
    } catch (err: any) {
      errors.push(`Custom fields: ${err.message || err}`)
    }
  }

  if (options.markingPeriods) {
    try {
      counts.markingPeriods = await copyMarkingPeriods(sourceSchoolId, targetSchoolId)
    } catch (err: any) {
      errors.push(`Marking periods: ${err.message || err}`)
    }
  }

  return { counts, errors }
}

async function copyGradeLevelsAndSections(
  sourceSchoolId: string,
  targetSchoolId: string
): Promise<{ gradeLevels: number; sections: number }> {
  const { data: sourceGrades, error: gradesError } = await supabase
    .from('grade_levels')
    .select('*')
    .eq('school_id', sourceSchoolId)
    .order('order_index', { ascending: true })

  if (gradesError) throw new Error(gradesError.message)
  if (!sourceGrades || sourceGrades.length === 0) return { gradeLevels: 0, sections: 0 }

  // Pass 1: create grade levels without group_id (self-referencing FK — remapped after).
  const idMap = new Map<string, string>()
  for (const grade of sourceGrades) {
    const created = await createGradeLevel({
      school_id: targetSchoolId,
      name: grade.name,
      order_index: grade.order_index,
      base_fee: grade.base_fee,
    })
    idMap.set(grade.id, created.id)
  }

  // Pass 2: remap group_id (grade-level grouping) to the newly created ids.
  for (const grade of sourceGrades) {
    if (grade.group_id && idMap.has(grade.group_id)) {
      await supabase
        .from('grade_levels')
        .update({ group_id: idMap.get(grade.group_id) })
        .eq('id', idMap.get(grade.id))
    }
  }

  // Sections: empty shells (name/capacity only — no live enrollment/strength copied).
  const { data: sourceSections, error: sectionsError } = await supabase
    .from('sections')
    .select('*')
    .in('grade_level_id', sourceGrades.map((g) => g.id))

  if (sectionsError) throw new Error(sectionsError.message)

  let sectionCount = 0
  for (const section of sourceSections || []) {
    const newGradeLevelId = idMap.get(section.grade_level_id)
    if (!newGradeLevelId) continue
    await createSection({
      school_id: targetSchoolId,
      grade_level_id: newGradeLevelId,
      name: section.name,
      capacity: section.capacity,
    })
    sectionCount++
  }

  return { gradeLevels: idMap.size, sections: sectionCount }
}

async function copyPeriods(sourceSchoolId: string, targetSchoolId: string): Promise<number> {
  const sourcePeriods = await periodsService.getPeriods(sourceSchoolId)
  for (const period of sourcePeriods) {
    await periodsService.createPeriod(targetSchoolId, targetSchoolId, {
      title: period.title,
      short_name: period.short_name,
      sort_order: period.sort_order,
      start_time: period.start_time,
      end_time: period.end_time,
      length_minutes: period.length_minutes,
      block: period.block,
    })
  }
  return sourcePeriods.length
}

async function copyGradingScales(sourceSchoolId: string, targetSchoolId: string): Promise<number> {
  const sourceScales = await gradingScalesService.getScales(sourceSchoolId)
  for (const scale of sourceScales) {
    await gradingScalesService.createScale(targetSchoolId, {
      title: scale.title,
      type: scale.type,
      comment: scale.comment ?? undefined,
      is_default: scale.is_default,
      sort_order: scale.sort_order,
      hhr_gpa_value: scale.hhr_gpa_value,
      hr_gpa_value: scale.hr_gpa_value,
      hr_subject_gpa_value: scale.hr_subject_gpa_value,
      grades: (scale.grades || []).map((g) => ({
        title: g.title,
        gpa_value: g.gpa_value,
        break_off: g.break_off,
        comment: g.comment ?? undefined,
        sort_order: g.sort_order,
      })),
    })
  }
  return sourceScales.length
}

async function copyDefaultFieldOrders(sourceSchoolId: string, targetSchoolId: string): Promise<number> {
  let total = 0
  for (const entityType of FIELD_ORDER_ENTITY_TYPES) {
    const rows = await DefaultFieldOrderService.getFieldOrders(sourceSchoolId, entityType)
    if (rows.length === 0) continue

    const byCategory = new Map<string, typeof rows>()
    for (const row of rows) {
      const list = byCategory.get(row.category_id) || []
      list.push(row)
      byCategory.set(row.category_id, list)
    }

    for (const [categoryId, fields] of byCategory) {
      await DefaultFieldOrderService.saveFieldOrders(
        targetSchoolId,
        entityType,
        categoryId,
        fields.map((f) => ({ field_label: f.field_label, sort_order: f.sort_order }))
      )
      for (const field of fields) {
        if (field.required !== null && field.required !== undefined) {
          await DefaultFieldOrderService.upsertFieldRequired(
            targetSchoolId,
            entityType,
            categoryId,
            field.field_label,
            field.required,
            field.sort_order
          )
        }
      }
      total += fields.length
    }
  }
  return total
}

async function copyCustomFields(sourceSchoolId: string, targetSchoolId: string): Promise<number> {
  const { data: sourceFields, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('school_id', sourceSchoolId)
    .in('entity_type', CUSTOM_FIELD_ENTITY_TYPES)

  if (error) throw new Error(error.message)
  if (!sourceFields || sourceFields.length === 0) return 0

  for (const field of sourceFields) {
    await customFieldsService.createFieldDefinition(targetSchoolId, {
      entity_type: field.entity_type,
      category_id: field.category_id,
      category_name: field.category_name,
      field_key: field.field_key,
      label: field.label,
      type: field.type,
      options: field.options || [],
      required: field.required,
      sort_order: field.sort_order,
      category_order: field.category_order,
      // Source's own scope/target-campus-list is meaningless for a different school
      // tree — the copy always starts scoped to just the target school itself.
      campus_scope: 'this_campus',
      applicable_school_ids: [],
    })
  }
  return sourceFields.length
}

async function copyMarkingPeriods(sourceSchoolId: string, targetSchoolId: string): Promise<number> {
  const sourcePeriods = await markingPeriodsService.getAll(sourceSchoolId)
  if (sourcePeriods.length === 0) return 0

  const idMap = new Map<string, string>()
  let count = 0

  for (const mpType of MARKING_PERIOD_TYPE_ORDER) {
    const periodsOfType = sourcePeriods.filter((mp) => mp.mp_type === mpType)
    for (const mp of periodsOfType) {
      const newParentId = mp.parent_id ? idMap.get(mp.parent_id) : undefined
      const created = await markingPeriodsService.create(targetSchoolId, targetSchoolId, {
        mp_type: mp.mp_type,
        parent_id: newParentId || null,
        title: mp.title,
        short_name: mp.short_name,
        sort_order: mp.sort_order,
        does_grades: mp.does_grades,
        does_comments: mp.does_comments,
        // Dates are school-year-specific — left blank so the admin sets them
        // for the new school rather than inheriting the source's academic year.
        start_date: null,
        end_date: null,
        post_start_date: null,
        post_end_date: null,
      })
      idMap.set(mp.id, created.id)
      count++
    }
  }

  return count
}
