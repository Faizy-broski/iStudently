import { supabase } from '../config/supabase'
import { assertOwner, assertSameSchool, getRoomOrThrow } from './jitsi-room.service'

// ============================================================================
// TYPES
// ============================================================================

export type PollQuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'rating'
export type PollStatus = 'draft' | 'open' | 'closed'

export interface JitsiRoomPoll {
  id: string
  room_id: string
  school_id: string
  campus_id: string
  question_text: string
  question_type: PollQuestionType
  options: unknown[]
  status: PollStatus
  launched_at?: string | null
  closed_at?: string | null
  created_by?: string | null
  created_at: string
}

export interface CreatePollDTO {
  question_text: string
  question_type?: PollQuestionType
  options?: unknown[]
  created_by?: string
}

export interface SubmitResponseDTO {
  selected_options?: unknown[]
  answer_text?: string
  rating_value?: number
}

export interface PollResult {
  poll: JitsiRoomPoll
  total_responses: number
  tally: Array<{ option: string; count: number }>
}

interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

// ============================================================================
// OWNER ACTIONS
// ============================================================================

export const launchPoll = async (
  roomId: string,
  dto: CreatePollDTO,
  caller: CallerContext
): Promise<JitsiRoomPoll> => {
  const room = await getRoomOrThrow(roomId)
  assertOwner(room, caller)

  const { data, error } = await supabase
    .from('jitsi_room_polls')
    .insert({
      room_id: roomId,
      school_id: room.school_id,
      campus_id: room.campus_id,
      question_text: dto.question_text,
      question_type: dto.question_type || 'single_choice',
      options: dto.options || [],
      status: 'open',
      launched_at: new Date().toISOString(),
      created_by: dto.created_by,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to launch poll: ${error.message}`)
  return data as JitsiRoomPoll
}

export const closePoll = async (pollId: string, caller: CallerContext): Promise<JitsiRoomPoll> => {
  const poll = await getPollOrThrow(pollId)
  const room = await getRoomOrThrow(poll.room_id)
  assertOwner(room, caller)

  const { data, error } = await supabase
    .from('jitsi_room_polls')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', pollId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to close poll: ${error.message}`)
  return data as JitsiRoomPoll
}

// ============================================================================
// RESPONDENT ACTIONS
// ============================================================================

export const submitResponse = async (
  pollId: string,
  dto: SubmitResponseDTO,
  caller: CallerContext
): Promise<void> => {
  const poll = await getPollOrThrow(pollId)
  if (poll.status !== 'open') throw new Error('This poll is not accepting responses')

  const room = await getRoomOrThrow(poll.room_id)
  assertSameSchool(room, caller)

  const { error } = await supabase
    .from('jitsi_room_poll_responses')
    .upsert(
      {
        poll_id: pollId,
        room_id: poll.room_id,
        respondent_profile_id: caller.profileId,
        selected_options: dto.selected_options || [],
        answer_text: dto.answer_text,
        rating_value: dto.rating_value,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'poll_id,respondent_profile_id' }
    )

  if (error) throw new Error(`Failed to submit response: ${error.message}`)
}

// ============================================================================
// READS
// ============================================================================

async function getPollOrThrow(pollId: string): Promise<JitsiRoomPoll> {
  const { data, error } = await supabase
    .from('jitsi_room_polls')
    .select('*')
    .eq('id', pollId)
    .single()
  if (error || !data) throw new Error('Poll not found')
  return data as JitsiRoomPoll
}

export const listPollsForRoom = async (roomId: string) => {
  const { data, error } = await supabase
    .from('jitsi_room_polls')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to list polls: ${error.message}`)
  return data || []
}

/** Server-side tally so clients never need to read raw response rows. */
export const getPollResults = async (pollId: string): Promise<PollResult> => {
  const poll = await getPollOrThrow(pollId)

  const { data: responses, error } = await supabase
    .from('jitsi_room_poll_responses')
    .select('selected_options')
    .eq('poll_id', pollId)

  if (error) throw new Error(`Failed to fetch results: ${error.message}`)

  const counts = new Map<string, number>()
  for (const r of responses || []) {
    const opts = Array.isArray((r as any).selected_options) ? (r as any).selected_options : []
    for (const opt of opts) {
      const key = String(opt)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }

  return {
    poll,
    total_responses: (responses || []).length,
    tally: Array.from(counts.entries()).map(([option, count]) => ({ option, count })),
  }
}
