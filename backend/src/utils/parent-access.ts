import { supabase } from '../config/supabase'

/**
 * Section ids of the children a parent is ACTIVELY linked to (parent_student_links.is_active).
 * Used to keep a parent's reads of section-level data (class diary, resources) to their own
 * children's classes. Throws on a database error so callers can fail closed.
 */
export async function parentChildSectionIds(parentProfileId: string): Promise<string[]> {
  if (!parentProfileId) return []
  const { data, error } = await supabase
    .from('parent_student_links')
    .select('student:students!inner(section_id), parent:parents!inner(profile_id)')
    .eq('is_active', true)
    .eq('parent.profile_id', parentProfileId)
  if (error) throw new Error(`Failed to resolve the parent's children's sections: ${error.message}`)
  const ids = (data ?? [])
    .map((r: any) => (Array.isArray(r.student) ? r.student[0]?.section_id : r.student?.section_id) as string | null | undefined)
    .filter((x): x is string => !!x)
  return [...new Set(ids)]
}
