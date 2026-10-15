// Bulk changes to many people at once (POST /<people>/group-assign), like the web's Group Assign pages.
import type { ApiClient } from '../../client'

export type GroupEntity = 'student' | 'teacher' | 'staff' | 'parent'

export interface GroupAssignChanges {
  is_active?: boolean
  /** Students only */
  grade_level_id?: string
  /** Students only */
  section_id?: string
  /** Students only */
  confidential_family_status?: string
  custom_field_updates?: { category_id: string; field_key: string; value: unknown }[]
}

export interface GroupAssignResult {
  updated: number
  errors: { error: string; [key: string]: unknown }[]
}

const ROUTE: Record<GroupEntity, { path: string; idsKey: string }> = {
  student: { path: '/students/group-assign', idsKey: 'student_ids' },
  teacher: { path: '/teachers/group-assign', idsKey: 'teacher_ids' },
  staff: { path: '/staff/group-assign', idsKey: 'staff_ids' },
  parent: { path: '/parents/group-assign', idsKey: 'parent_ids' },
}

export function adminGroupAssignApi(api: ApiClient) {
  return {
    assign: (entity: GroupEntity, campusId: string | undefined, ids: string[], changes: GroupAssignChanges) =>
      api.post<GroupAssignResult>(ROUTE[entity].path, { [ROUTE[entity].idsKey]: ids, ...changes, campus_id: campusId }),
  }
}
