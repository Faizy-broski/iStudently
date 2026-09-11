const fs = require('fs');

const frontendDir = 'd:/thesocialnexus/studently/frontend/src/lib/api/';

const teacherApi = `
export interface GroupAssignTeachersParams {
  teacher_ids: string[]
  is_active?: boolean
  custom_field_updates?: { category_id: string; field_key: string; value: any }[]
  campus_id?: string
}
export async function groupAssignTeachers(params: GroupAssignTeachersParams) {
  return apiRequest<{ updated: number; errors: any[] }>('/teachers/group-assign', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}
`;
fs.appendFileSync(frontendDir + 'teachers.ts', teacherApi);

const staffApi = `
export interface GroupAssignStaffParams {
  staff_ids: string[]
  is_active?: boolean
  custom_field_updates?: { category_id: string; field_key: string; value: any }[]
  campus_id?: string
}
export async function groupAssignStaff(params: GroupAssignStaffParams) {
  return apiRequest<{ updated: number; errors: any[] }>('/staff/group-assign', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}
`;
fs.appendFileSync(frontendDir + 'staff.ts', staffApi);

const parentApi = `
export interface GroupAssignParentsParams {
  parent_ids: string[]
  is_active?: boolean
  custom_field_updates?: { category_id: string; field_key: string; value: any }[]
  campus_id?: string
}
export async function groupAssignParents(params: GroupAssignParentsParams) {
  return apiRequest<{ updated: number; errors: any[] }>('/parents/group-assign', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}
`;
fs.appendFileSync(frontendDir + 'parents.ts', parentApi);
