import { supabase } from '../config/supabase'
import { createGradeLevel, createSection, updateGradeLevel, updateSection } from './academics.service'
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

/** Result of a category copier: how many items succeeded, plus any per-item failures. */
interface CategoryResult {
  count: number
  itemErrors: string[]
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
      const { gradeLevels, sections, itemErrors } = await copyGradeLevelsAndSections(sourceSchoolId, targetSchoolId)
      counts.gradeLevels = gradeLevels
      counts.sections = sections
      if (itemErrors.length > 0) errors.push(`Grade levels: ${itemErrors.length} failed — ${itemErrors.join('; ')}`)
    } catch (err: any) {
      errors.push(`Grade levels: ${err.message || err}`)
    }
  }

  if (options.periods) {
    try {
      const { count, itemErrors } = await copyPeriods(sourceSchoolId, targetSchoolId)
      counts.periods = count
      if (itemErrors.length > 0) errors.push(`Periods: ${itemErrors.length} failed — ${itemErrors.join('; ')}`)
    } catch (err: any) {
      errors.push(`Periods: ${err.message || err}`)
    }
  }

  if (options.gradingScales) {
    try {
      const { count, itemErrors } = await copyGradingScales(sourceSchoolId, targetSchoolId)
      counts.gradingScales = count
      if (itemErrors.length > 0) errors.push(`Grading scales: ${itemErrors.length} failed — ${itemErrors.join('; ')}`)
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
      const { count, itemErrors } = await copyCustomFields(sourceSchoolId, targetSchoolId)
      counts.customFields = count
      if (itemErrors.length > 0) errors.push(`Custom fields: ${itemErrors.length} failed — ${itemErrors.join('; ')}`)
    } catch (err: any) {
      errors.push(`Custom fields: ${err.message || err}`)
    }
  }

  if (options.markingPeriods) {
    try {
      const { count, itemErrors } = await copyMarkingPeriods(sourceSchoolId, targetSchoolId)
      counts.markingPeriods = count
      if (itemErrors.length > 0) errors.push(`Marking periods: ${itemErrors.length} failed — ${itemErrors.join('; ')}`)
    } catch (err: any) {
      errors.push(`Marking periods: ${err.message || err}`)
    }
  }

  return { counts, errors }
}

async function copyGradeLevelsAndSections(
  sourceSchoolId: string,
  targetSchoolId: string
): Promise<{ gradeLevels: number; sections: number; itemErrors: string[] }> {
  const { data: sourceGrades, error: gradesError } = await supabase
    .from('grade_levels')
    .select('*')
    .eq('school_id', sourceSchoolId)
    .order('order_index', { ascending: true })

  if (gradesError) throw new Error(gradesError.message)
  if (!sourceGrades || sourceGrades.length === 0) return { gradeLevels: 0, sections: 0, itemErrors: [] }

  // grade_levels has two real unique constraints — (school_id, name) and
  // (school_id, order_index) — so match existing target rows by name (the
  // natural identity) and update in place instead of blindly inserting.
  const { data: existingGrades, error: existingGradesError } = await supabase
    .from('grade_levels')
    .select('*')
    .eq('school_id', targetSchoolId)

  if (existingGradesError) throw new Error(existingGradesError.message)
  const existingByName = new Map((existingGrades || []).map((g) => [g.name, g]))

  // Pass 1: create/update grade levels without group_id (self-referencing FK — remapped after).
  const idMap = new Map<string, string>()
  const itemErrors: string[] = []
  for (const grade of sourceGrades) {
    try {
      const existing = existingByName.get(grade.name)
      if (existing) {
        const updated = await updateGradeLevel(existing.id, targetSchoolId, {
          order_index: grade.order_index,
          base_fee: grade.base_fee,
        })
        idMap.set(grade.id, updated.id)
      } else {
        const created = await createGradeLevel({
          school_id: targetSchoolId,
          name: grade.name,
          order_index: grade.order_index,
          base_fee: grade.base_fee,
        })
        idMap.set(grade.id, created.id)
      }
    } catch (err: any) {
      itemErrors.push(`Grade "${grade.name}": ${err.message || err}`)
    }
  }

  // Pass 2: remap group_id (grade-level grouping) to the newly created/updated ids.
  for (const grade of sourceGrades) {
    if (grade.group_id && idMap.has(grade.group_id) && idMap.has(grade.id)) {
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

  const { data: existingSections, error: existingSectionsError } = await supabase
    .from('sections')
    .select('*')
    .eq('school_id', targetSchoolId)

  if (existingSectionsError) throw new Error(existingSectionsError.message)
  // unique_section_per_grade is (school_id, grade_level_id, name) — key by that.
  const existingSectionByKey = new Map(
    (existingSections || []).map((s) => [`${s.grade_level_id}:${s.name}`, s])
  )

  let sectionCount = 0
  for (const section of sourceSections || []) {
    const newGradeLevelId = idMap.get(section.grade_level_id)
    if (!newGradeLevelId) continue
    try {
      const existing = existingSectionByKey.get(`${newGradeLevelId}:${section.name}`)
      if (existing) {
        await updateSection(existing.id, targetSchoolId, { capacity: section.capacity })
      } else {
        await createSection({
          school_id: targetSchoolId,
          grade_level_id: newGradeLevelId,
          name: section.name,
          capacity: section.capacity,
        })
      }
      sectionCount++
    } catch (err: any) {
      itemErrors.push(`Section "${section.name}": ${err.message || err}`)
    }
  }

  return { gradeLevels: idMap.size, sections: sectionCount, itemErrors }
}

async function copyPeriods(sourceSchoolId: string, targetSchoolId: string): Promise<CategoryResult> {
  const sourcePeriods = await periodsService.getPeriods(sourceSchoolId)
  if (sourcePeriods.length === 0) return { count: 0, itemErrors: [] }

  const existingTargetPeriods = await periodsService.getPeriods(targetSchoolId)
  // Real constraint is (campus_id, period_number) — period_number mirrors sort_order.
  const existingBySortOrder = new Map(existingTargetPeriods.map((p) => [p.sort_order, p]))

  let count = 0
  const itemErrors: string[] = []
  for (const period of sourcePeriods) {
    try {
      const existing = existingBySortOrder.get(period.sort_order)
      if (existing) {
        await periodsService.updatePeriod(existing.id, {
          title: period.title,
          short_name: period.short_name,
          sort_order: period.sort_order,
          start_time: period.start_time,
          end_time: period.end_time,
          length_minutes: period.length_minutes,
          block: period.block,
        })
      } else {
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
      count++
    } catch (err: any) {
      itemErrors.push(`"${period.title}": ${err.message || err}`)
    }
  }

  return { count, itemErrors }
}

async function copyGradingScales(sourceSchoolId: string, targetSchoolId: string): Promise<CategoryResult> {
  const sourceScales = await gradingScalesService.getScales(sourceSchoolId)
  if (sourceScales.length === 0) return { count: 0, itemErrors: [] }

  const existingTargetScales = await gradingScalesService.getScales(targetSchoolId)
  // Real constraint is (school_id, title).
  const existingByTitle = new Map(existingTargetScales.map((s) => [s.title, s]))

  let count = 0
  const itemErrors: string[] = []
  for (const scale of sourceScales) {
    try {
      const existing = existingByTitle.get(scale.title)
      const gradeDtos = (scale.grades || []).map((g) => ({
        title: g.title,
        gpa_value: g.gpa_value,
        break_off: g.break_off,
        comment: g.comment ?? undefined,
        sort_order: g.sort_order,
      }))

      if (existing) {
        await gradingScalesService.updateScale(existing.id, {
          type: scale.type,
          comment: scale.comment ?? undefined,
          is_default: scale.is_default,
          sort_order: scale.sort_order,
          hhr_gpa_value: scale.hhr_gpa_value,
          hr_gpa_value: scale.hr_gpa_value,
          hr_subject_gpa_value: scale.hr_subject_gpa_value,
        })
        // grading_scale_grades is unique on (grading_scale_id, title) — replace
        // the existing set with the source's so both stay in sync, matching the
        // "replace" approach already used by generateGrades().
        const { error: deleteError } = await supabase
          .from('grading_scale_grades')
          .delete()
          .eq('grading_scale_id', existing.id)
        if (deleteError) throw new Error(deleteError.message)
        if (gradeDtos.length > 0) {
          await gradingScalesService.bulkCreateGrades(existing.id, targetSchoolId, gradeDtos)
        }
      } else {
        await gradingScalesService.createScale(targetSchoolId, {
          title: scale.title,
          type: scale.type,
          comment: scale.comment ?? undefined,
          is_default: scale.is_default,
          sort_order: scale.sort_order,
          hhr_gpa_value: scale.hhr_gpa_value,
          hr_gpa_value: scale.hr_gpa_value,
          hr_subject_gpa_value: scale.hr_subject_gpa_value,
          grades: gradeDtos,
        })
      }
      count++
    } catch (err: any) {
      itemErrors.push(`"${scale.title}": ${err.message || err}`)
    }
  }

  return { count, itemErrors }
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
      // saveFieldOrders/upsertFieldRequired already upsert internally, so this
      // category is naturally idempotent on repeated copy runs.
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

async function copyCustomFields(sourceSchoolId: string, targetSchoolId: string): Promise<CategoryResult> {
  const { data: sourceFields, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('school_id', sourceSchoolId)
    .in('entity_type', CUSTOM_FIELD_ENTITY_TYPES)

  if (error) throw new Error(error.message)
  if (!sourceFields || sourceFields.length === 0) return { count: 0, itemErrors: [] }

  const { data: existingFields, error: existingError } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('school_id', targetSchoolId)
    .in('entity_type', CUSTOM_FIELD_ENTITY_TYPES)

  if (existingError) throw new Error(existingError.message)
  // Real constraint is (school_id, entity_type, field_key).
  const existingByKey = new Map((existingFields || []).map((f) => [`${f.entity_type}:${f.field_key}`, f]))

  let count = 0
  const itemErrors: string[] = []
  for (const field of sourceFields) {
    try {
      const existing = existingByKey.get(`${field.entity_type}:${field.field_key}`)
      if (existing) {
        await customFieldsService.updateFieldDefinition(existing.id, targetSchoolId, {
          category_id: field.category_id,
          category_name: field.category_name,
          label: field.label,
          type: field.type,
          options: field.options || [],
          required: field.required,
          sort_order: field.sort_order,
          category_order: field.category_order,
        })
      } else {
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
      count++
    } catch (err: any) {
      itemErrors.push(`"${field.label}": ${err.message || err}`)
    }
  }

  return { count, itemErrors }
}

async function copyMarkingPeriods(sourceSchoolId: string, targetSchoolId: string): Promise<CategoryResult> {
  const sourcePeriods = await markingPeriodsService.getAll(sourceSchoolId)
  if (sourcePeriods.length === 0) return { count: 0, itemErrors: [] }

  const existingTargetPeriods = await markingPeriodsService.getAll(targetSchoolId)
  // create() auto-assigns sort_order (ignoring the DTO's value), so title
  // within mp_type is the meaningful identity for matching existing rows.
  const existingByKey = new Map(existingTargetPeriods.map((mp) => [`${mp.mp_type}:${mp.title}`, mp]))

  const idMap = new Map<string, string>()
  let count = 0
  const itemErrors: string[] = []

  for (const mpType of MARKING_PERIOD_TYPE_ORDER) {
    const periodsOfType = sourcePeriods.filter((mp) => mp.mp_type === mpType)
    for (const mp of periodsOfType) {
      try {
        const newParentId = mp.parent_id ? idMap.get(mp.parent_id) : undefined
        const existing = existingByKey.get(`${mp.mp_type}:${mp.title}`)

        if (existing) {
          // Preserve dates the admin may have already set on the target school —
          // only sync the structural/display fields from the source.
          const updated = await markingPeriodsService.update(existing.id, {
            short_name: mp.short_name,
            does_grades: mp.does_grades,
            does_comments: mp.does_comments,
          })
          idMap.set(mp.id, updated.id)
        } else {
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
        }
        count++
      } catch (err: any) {
        itemErrors.push(`"${mp.title}": ${err.message || err}`)
      }
    }
  }

  return { count, itemErrors }
}
