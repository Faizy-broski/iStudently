import { apiRequest } from './index'

export interface PhysicsLab {
  id: string
  school_id: string
  sim_key: string
  subject_id: string | null
  grade_id: string | null
  custom_note: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreatePhysicsLabDto {
  sim_key: string
  school_id?: string
  subject_id?: string | null
  grade_id?: string | null
  custom_note?: string | null
  is_active?: boolean
}

export interface UpdatePhysicsLabDto {
  subject_id?: string | null
  grade_id?: string | null
  custom_note?: string | null
  is_active?: boolean
}

export interface PhysicsLabSubmission {
  id: string
  lab_id: string
  student_id: string
  findings_text: string
  time_spent_s: number | null
  submitted_at: string
  profiles?: { first_name: string; last_name: string }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getPhysicsLabs(params?: { school_id?: string }) {
  const qs = params?.school_id ? `?school_id=${params.school_id}` : ''
  return apiRequest<PhysicsLab[]>(`/physics-labs${qs}`)
}

export async function assignLab(dto: CreatePhysicsLabDto) {
  return apiRequest<PhysicsLab>('/physics-labs', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateLab(id: string, dto: UpdatePhysicsLabDto, schoolId?: string) {
  const qs = schoolId ? `?school_id=${schoolId}` : ''
  return apiRequest<PhysicsLab>(`/physics-labs/${id}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function unassignLab(id: string, schoolId?: string) {
  const qs = schoolId ? `?school_id=${schoolId}` : ''
  return apiRequest<void>(`/physics-labs/${id}${qs}`, { method: 'DELETE' })
}

export async function getLabSubmissions(labId: string, schoolId?: string) {
  const qs = schoolId ? `?school_id=${schoolId}` : ''
  return apiRequest<PhysicsLabSubmission[]>(`/physics-labs/${labId}/submissions${qs}`)
}

// ── Student-facing ────────────────────────────────────────────────────────────

export async function getStudentLabs(params?: { grade_id?: string }) {
  const qs = params?.grade_id ? `?grade_id=${params.grade_id}` : ''
  return apiRequest<PhysicsLab[]>(`/physics-labs/for-student${qs}`)
}

export async function submitFindings(dto: {
  lab_id: string
  findings_text: string
  time_spent_s?: number
}) {
  return apiRequest<PhysicsLabSubmission>('/physics-labs/submissions', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}
