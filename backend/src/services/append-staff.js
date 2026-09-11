const fs = require('fs');
const code = `
export const groupAssignStaff = async (
  schoolId: string,
  params: {
    staff_ids: string[]
    is_active?: boolean
    custom_field_updates?: { category_id: string; field_key: string; value: any }[]
  }
): Promise<{ updated: number; errors: { staff_id: string; error: string }[] }> => {
  const errors: { staff_id: string; error: string }[] = []
  const customFieldUpdates = params.custom_field_updates || []

  const { data: rows, error: fetchErr } = await supabase
    .from('staff')
    .select('id, profile_id, custom_fields')
    .eq('school_id', schoolId)
    .in('id', params.staff_ids)

  if (fetchErr) throw new Error(\`Failed to resolve staff for group assign: \${fetchErr.message}\`)

  const validRows = rows || []
  const validIds = new Set(validRows.map((r: any) => r.id))
  for (const id of params.staff_ids) {
    if (!validIds.has(id)) {
      errors.push({ staff_id: id, error: 'Staff not found or does not belong to this school' })
    }
  }

  if (validRows.length === 0) return { updated: 0, errors }

  if (params.is_active !== undefined) {
    const profileIds = validRows.map((r: any) => r.profile_id).filter(Boolean)
    if (profileIds.length > 0) {
      const { error: statusErr } = await supabase
        .from('profiles')
        .update({ is_active: params.is_active })
        .in('id', profileIds)
      if (statusErr) throw new Error(\`Failed to update active status: \${statusErr.message}\`)
    }
  }

  let updated = 0

  if (customFieldUpdates.length === 0) {
    updated = validRows.length
  } else {
    for (const row of validRows) {
      const currentCustomFields = row.custom_fields || {}
      const newCustomFields = { ...currentCustomFields }
      
      for (const update of customFieldUpdates) {
        if (!newCustomFields[update.category_id]) newCustomFields[update.category_id] = {}
        newCustomFields[update.category_id][update.field_key] = update.value
      }

      const { error: updateErr } = await supabase
        .from('staff')
        .update({ custom_fields: newCustomFields })
        .eq('id', row.id)
      
      if (updateErr) {
        errors.push({ staff_id: row.id, error: \`Update failed: \${updateErr.message}\` })
      } else {
        updated++
      }
    }
  }

  return { updated, errors }
}
`;
fs.appendFileSync('d:/thesocialnexus/studently/backend/src/services/staff.service.ts', code);
