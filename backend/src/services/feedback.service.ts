import { supabase } from '../config/supabase'

export interface FeedbackReport {
  id: string
  school_id: string | null
  campus_id: string | null
  submitted_by: string | null
  submitter_role: string | null
  submitter_name: string | null
  submitter_email: string | null
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
  updated_at: string
}

export interface CreateFeedbackDTO {
  school_id?: string | null
  campus_id?: string | null
  submitted_by?: string | null
  submitter_role?: string | null
  submitter_name?: string | null
  submitter_email?: string | null
  title: string
  description: string
}

export async function createFeedback(dto: CreateFeedbackDTO): Promise<FeedbackReport> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .insert({
      school_id:       dto.school_id ?? null,
      campus_id:       dto.campus_id ?? null,
      submitted_by:    dto.submitted_by ?? null,
      submitter_role:  dto.submitter_role ?? null,
      submitter_name:  dto.submitter_name ?? null,
      submitter_email: dto.submitter_email ?? null,
      title:           dto.title,
      description:     dto.description,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getFeedbackReports(filters?: { status?: string }): Promise<FeedbackReport[]> {
  let query = supabase
    .from('feedback_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updateFeedbackStatus(
  id: string,
  status: 'open' | 'in_progress' | 'resolved'
): Promise<FeedbackReport> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Feedback report not found')
  return data
}

export async function getOpenCount(): Promise<number> {
  const { count, error } = await supabase
    .from('feedback_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  if (error) throw error
  return count || 0
}
