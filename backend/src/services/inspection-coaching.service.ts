import { supabase } from '../config/supabase'
import { getEvaluationRowOrThrow, assertCanEdit, assertCanView, type CallerContext } from './inspection-evaluation.service'
import type { InspectionCoachingNote, CoachingNoteType, CoachingNoteStatus } from '../types/inspection-coaching.types'

export type { CallerContext }

export async function listNotes(caller: CallerContext, evaluationId: string): Promise<InspectionCoachingNote[]> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanView(evaluation, caller)

  const { data, error } = await supabase
    .from('inspection_coaching_notes')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list coaching notes: ${error.message}`)
  return data || []
}

export interface AddNoteDTO {
  note_type: CoachingNoteType
  content: string
  target_date?: string | null
}

export async function addNote(caller: CallerContext, evaluationId: string, dto: AddNoteDTO): Promise<InspectionCoachingNote> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (!dto.content?.trim()) throw new Error('content is required')
  if (!['strength', 'area_for_growth', 'action_item'].includes(dto.note_type)) {
    throw new Error('Invalid note_type')
  }

  const { data, error } = await supabase
    .from('inspection_coaching_notes')
    .insert({
      evaluation_id: evaluationId,
      note_type: dto.note_type,
      content: dto.content.trim(),
      target_date: dto.target_date || null,
      created_by: caller.profileId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to add coaching note: ${error.message}`)
  return data as InspectionCoachingNote
}

export interface UpdateNoteDTO {
  content?: string
  target_date?: string | null
  status?: CoachingNoteStatus
}

async function getNoteOrThrow(id: string) {
  const { data, error } = await supabase.from('inspection_coaching_notes').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Coaching note not found')
  return data
}

export async function updateNote(caller: CallerContext, id: string, dto: UpdateNoteDTO): Promise<InspectionCoachingNote> {
  const note = await getNoteOrThrow(id)
  const evaluation = await getEvaluationRowOrThrow(note.evaluation_id)
  await assertCanEdit(evaluation, caller)

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (dto.content !== undefined) patch.content = dto.content.trim()
  if (dto.target_date !== undefined) patch.target_date = dto.target_date
  if (dto.status !== undefined) patch.status = dto.status

  const { data, error } = await supabase.from('inspection_coaching_notes').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(`Failed to update coaching note: ${error.message}`)
  return data as InspectionCoachingNote
}

export async function deleteNote(caller: CallerContext, id: string): Promise<void> {
  const note = await getNoteOrThrow(id)
  const evaluation = await getEvaluationRowOrThrow(note.evaluation_id)
  await assertCanEdit(evaluation, caller)

  const { error } = await supabase.from('inspection_coaching_notes').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete coaching note: ${error.message}`)
}
