import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Helper function to make authenticated requests with 401 handling
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = await getAuthToken()
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  })
  
  // Handle 401 - session expired
  if (response.status === 401) {
    await handleSessionExpiry()
    throw new Error('Session expired')
  }
  
  return response
}

export interface ExamType {
  id: string
  school_id: string
  name: string
  description?: string
  weightage: number
}

export interface Exam {
  id: string
  exam_name: string
  exam_date?: string
  exam_type?: ExamType
  section?: any
  subject?: any
  max_marks: number
  passing_marks: number
  is_published: boolean
  is_completed: boolean
}

export interface ExamResult {
  id: string
  student_id: string
  marks_obtained?: number
  is_absent: boolean
  percentage?: number
  grade?: string
  remarks?: string
  student?: any
}

export async function getExamTypes(schoolId: string): Promise<ExamType[]> {
  const response = await authenticatedFetch(`${API_URL}/exams/types?school_id=${schoolId}`)
  const result = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch exam types')
  return result.data
}

export async function getTeacherExams(teacherId: string, filters?: {
  section_id?: string
  subject_id?: string
  is_completed?: boolean
}): Promise<Exam[]> {
  const params = new URLSearchParams({ teacher_id: teacherId })
  if (filters?.section_id) params.append('section_id', filters.section_id)
  if (filters?.subject_id) params.append('subject_id', filters.subject_id)
  if (filters?.is_completed !== undefined) params.append('is_completed', String(filters.is_completed))
  
  const response = await authenticatedFetch(`${API_URL}/exams/teacher?${params}`)
  const result = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch exams')
  return result.data
}

export async function createExam(data: any): Promise<Exam> {
  const response = await authenticatedFetch(`${API_URL}/exams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  const result = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to create exam')
  return result.data
}

export async function getExamResults(examId: string): Promise<ExamResult[]> {
  const response = await authenticatedFetch(`${API_URL}/exams/${examId}/results`)
  const result = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch exam results')
  return result.data
}

export async function recordMarks(data: {
  exam_id: string
  student_id: string
  marks_obtained?: number
  is_absent: boolean
  remarks?: string
  marked_by: string
}): Promise<ExamResult> {
  const response = await authenticatedFetch(`${API_URL}/exams/results/record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  const result = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to record marks')
  return result.data
}
