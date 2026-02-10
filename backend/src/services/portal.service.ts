import { supabase } from '../config/supabase'

// ================================================================
// TYPES
// ================================================================

export interface PortalNote {
  id: string
  school_id: string
  campus_id?: string
  title: string
  content: string
  content_type: 'markdown' | 'html' | 'plain'
  file_url?: string
  file_name?: string
  embed_link?: string
  sort_order: number
  is_pinned: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles: string[]
  created_by?: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface CreateNoteDTO {
  school_id: string
  campus_id: string
  title: string
  content: string
  content_type?: 'markdown' | 'html' | 'plain'
  file_url?: string
  file_name?: string
  embed_link?: string
  sort_order?: number
  is_pinned?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  created_by?: string
}

export interface UpdateNoteDTO {
  title?: string
  content?: string
  content_type?: 'markdown' | 'html' | 'plain'
  file_url?: string
  file_name?: string
  embed_link?: string
  sort_order?: number
  is_pinned?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  is_active?: boolean
}

export interface PortalPoll {
  id: string
  school_id: string
  campus_id: string
  title: string
  description?: string
  sort_order: number
  show_results: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles: string[]
  created_by?: string
  created_at: string
  updated_at: string
  is_active: boolean
  questions?: PollQuestion[]
  has_voted?: boolean
}

export interface PollQuestion {
  id: string
  poll_id: string
  question_text: string
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'rating'
  options: any[]  // JSONB - can be strings or objects like {value, label, icon}
  is_required: boolean
  sort_order: number
  created_at: string
}

export interface CreatePollDTO {
  school_id: string
  campus_id: string
  title: string
  description?: string
  sort_order?: number
  show_results?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  created_by?: string
  questions?: CreateQuestionDTO[]
}

export interface CreateQuestionDTO {
  question_text: string
  question_type?: 'single_choice' | 'multiple_choice' | 'text' | 'rating'
  options?: any[]  // JSONB - can be strings or objects
  is_required?: boolean
  sort_order?: number
}

export interface UpdatePollDTO {
  title?: string
  description?: string
  sort_order?: number
  show_results?: boolean
  visible_from?: string
  visible_until?: string
  visible_to_roles?: string[]
  is_active?: boolean
  questions?: CreateQuestionDTO[]  // Questions to update/add
}

export interface PollResponseDTO {
  question_id: string
  answer_text?: string
  selected_options?: any[]  // JSONB - selected option values
  rating_value?: number
}

// ================================================================
// PORTAL SERVICE
// ================================================================

class PortalService {
  // ----------------------------------------------------------------
  // NOTES
  // ----------------------------------------------------------------

  async getNotes(
    schoolId: string,
    campusId: string,
    options: {
      role?: string
      includeInactive?: boolean
      page?: number
      limit?: number
    } = {}
  ) {
    const { role, includeInactive = false, page = 1, limit = 50 } = options
    const offset = (page - 1) * limit

    // First, check if this campus has a parent school (for multi-campus setups)
    // The schoolId might actually be a campus, and notes might be created under the parent school
    const { data: campusInfo } = await supabase
      .from('schools')
      .select('id, parent_school_id')
      .eq('id', campusId)
      .single()
    
    // If campus has a parent, also check for notes created under parent school
    const mainSchoolId = campusInfo?.parent_school_id || schoolId
    
    // Query for notes that match:
    // 1. Created for this specific campus
    // 2. OR created for the main school with this campus_id
    let query = supabase
      .from('portal_notes')
      .select('*', { count: 'exact' })
      .eq('campus_id', campusId)
      .order('is_pinned', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    // Active filter
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    // Role-based visibility
    // This checks if the role is present in the visible_to_roles array
    if (role) {
      // Use filter with cs (contains) which maps to @> in postgres
      // For checking if array contains a single value
      query = query.filter('visible_to_roles', 'cs', `{${role}}`)
      
      // Date-based visibility - combine into a single filter
      const now = new Date().toISOString()
      // visible_from should be null OR in the past
      // visible_until should be null OR in the future
      query = query.or(`visible_from.is.null,visible_from.lte.${now}`)
      query = query.or(`visible_until.is.null,visible_until.gte.${now}`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching notes:', error)
      throw new Error(`Failed to fetch notes: ${error.message}`)
    }

    return {
      notes: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  async getNoteById(noteId: string): Promise<PortalNote | null> {
    const { data, error } = await supabase
      .from('portal_notes')
      .select('*')
      .eq('id', noteId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch note: ${error.message}`)
    }

    return data
  }

  async createNote(dto: CreateNoteDTO): Promise<PortalNote> {
    console.log('📝 Creating note with:', {
      school_id: dto.school_id,
      campus_id: dto.campus_id,
      title: dto.title,
      visible_to_roles: dto.visible_to_roles
    })

    const { data, error } = await supabase
      .from('portal_notes')
      .insert({
        school_id: dto.school_id,
        campus_id: dto.campus_id,
        title: dto.title,
        content: dto.content,
        content_type: dto.content_type || 'markdown',
        file_url: dto.file_url,
        file_name: dto.file_name,
        embed_link: dto.embed_link,
        sort_order: dto.sort_order ?? 0,
        is_pinned: dto.is_pinned ?? false,
        visible_from: dto.visible_from,
        visible_until: dto.visible_until,
        visible_to_roles: dto.visible_to_roles || ['admin', 'teacher', 'student', 'parent'],
        created_by: dto.created_by
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating note:', error)
      throw new Error(`Failed to create note: ${error.message}`)
    }

    console.log('📝 Note created successfully:', { id: data.id, campus_id: data.campus_id, visible_to_roles: data.visible_to_roles })
    return data
  }

  async updateNote(noteId: string, dto: UpdateNoteDTO): Promise<PortalNote> {
    const updateData: any = { ...dto }
    
    // Clean undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    const { data, error } = await supabase
      .from('portal_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update note: ${error.message}`)
    }

    return data
  }

  async deleteNote(noteId: string): Promise<void> {
    const { error } = await supabase
      .from('portal_notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      throw new Error(`Failed to delete note: ${error.message}`)
    }
  }

  // ----------------------------------------------------------------
  // POLLS
  // ----------------------------------------------------------------

  async getPolls(
    schoolId: string,
    campusId: string,
    options: {
      role?: string
      userId?: string
      includeInactive?: boolean
      page?: number
      limit?: number
    } = {}
  ) {
    const { role, userId, includeInactive = false, page = 1, limit = 50 } = options
    const offset = (page - 1) * limit

    // Check if this campus has a parent school (for multi-campus setups)
    // Same logic as getNotes - query by campus_id only to support parent school notes
    const { data: campusInfo } = await supabase
      .from('schools')
      .select('id, parent_school_id')
      .eq('id', campusId)
      .single()
    
    const mainSchoolId = campusInfo?.parent_school_id || schoolId
    
    // Query by campus_id only (not school_id) to support multi-campus setup
    // where polls are created under parent school but assigned to specific campus
    let query = supabase
      .from('portal_polls')
      .select('*', { count: 'exact' })
      .eq('campus_id', campusId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (role) {
      // Use filter with cs (contains) which maps to @> in postgres
      query = query.filter('visible_to_roles', 'cs', `{${role}}`)
      
      const now = new Date().toISOString()
      query = query
        .or(`visible_from.is.null,visible_from.lte.${now}`)
        .or(`visible_until.is.null,visible_until.gte.${now}`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: polls, error, count } = await query

    if (error) {
      console.error('Error fetching polls:', error)
      throw new Error(`Failed to fetch polls: ${error.message}`)
    }

    // Fetch questions for each poll
    const pollIds = (polls || []).map(p => p.id)
    
    if (pollIds.length > 0) {
      const { data: questions } = await supabase
        .from('portal_poll_questions')
        .select('*')
        .in('poll_id', pollIds)
        .order('sort_order', { ascending: true })

      // Attach questions to polls
      const questionsByPoll = (questions || []).reduce((acc, q) => {
        if (!acc[q.poll_id]) acc[q.poll_id] = []
        acc[q.poll_id].push(q)
        return acc
      }, {} as Record<string, PollQuestion[]>)

      polls?.forEach(poll => {
        poll.questions = questionsByPoll[poll.id] || []
      })

      // Check if user has voted
      if (userId) {
        const { data: responses } = await supabase
          .from('portal_poll_responses')
          .select('poll_id')
          .eq('user_id', userId)
          .in('poll_id', pollIds)

        const votedPollIds = new Set((responses || []).map(r => r.poll_id))
        polls?.forEach(poll => {
          poll.has_voted = votedPollIds.has(poll.id)
        })
      }
    }

    return {
      polls: polls || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  async getPollById(pollId: string, userId?: string): Promise<PortalPoll | null> {
    const { data: poll, error } = await supabase
      .from('portal_polls')
      .select('*')
      .eq('id', pollId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch poll: ${error.message}`)
    }

    // Get questions
    const { data: questions } = await supabase
      .from('portal_poll_questions')
      .select('*')
      .eq('poll_id', pollId)
      .order('sort_order', { ascending: true })

    poll.questions = questions || []

    // Check if user has voted
    if (userId) {
      const { data: responses } = await supabase
        .from('portal_poll_responses')
        .select('id')
        .eq('poll_id', pollId)
        .eq('user_id', userId)
        .limit(1)

      poll.has_voted = (responses?.length || 0) > 0
    }

    return poll
  }

  async createPoll(dto: CreatePollDTO): Promise<PortalPoll> {
    // Create the poll
    const { data: poll, error } = await supabase
      .from('portal_polls')
      .insert({
        school_id: dto.school_id,
        campus_id: dto.campus_id,
        title: dto.title,
        description: dto.description,
        sort_order: dto.sort_order ?? 0,
        show_results: dto.show_results ?? true,
        visible_from: dto.visible_from,
        visible_until: dto.visible_until,
        visible_to_roles: dto.visible_to_roles || ['admin', 'teacher', 'student', 'parent'],
        created_by: dto.created_by
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating poll:', error)
      throw new Error(`Failed to create poll: ${error.message}`)
    }

    // Create questions if provided
    if (dto.questions && dto.questions.length > 0) {
      const questionsToInsert = dto.questions.map((q, i) => ({
        poll_id: poll.id,
        question_text: q.question_text,
        question_type: q.question_type || 'single_choice',
        options: q.options || [],
        is_required: q.is_required ?? true,
        sort_order: q.sort_order ?? i
      }))

      const { data: questions, error: qError } = await supabase
        .from('portal_poll_questions')
        .insert(questionsToInsert)
        .select()

      if (qError) {
        console.error('Error creating questions:', qError)
      } else {
        poll.questions = questions
      }
    }

    return poll
  }

  async updatePoll(pollId: string, dto: UpdatePollDTO): Promise<PortalPoll> {
    // Extract questions from dto - they're handled separately
    const { questions, ...pollData } = dto
    
    const updateData: any = { ...pollData }
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    // Update the poll itself (without questions)
    const { data, error } = await supabase
      .from('portal_polls')
      .update(updateData)
      .eq('id', pollId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update poll: ${error.message}`)
    }

    // Handle questions if provided
    if (questions && questions.length > 0) {
      // Delete existing questions for this poll
      await supabase
        .from('portal_poll_questions')
        .delete()
        .eq('poll_id', pollId)

      // Insert new questions
      const questionsToInsert = questions.map((q, i) => ({
        poll_id: pollId,
        question_text: q.question_text,
        question_type: q.question_type || 'single_choice',
        options: q.options || [],
        is_required: q.is_required ?? true,
        sort_order: q.sort_order ?? i
      }))

      const { error: qError } = await supabase
        .from('portal_poll_questions')
        .insert(questionsToInsert)

      if (qError) {
        console.error('Failed to update questions:', qError)
      }
    }

    // Return poll with questions
    return this.getPollById(pollId) as Promise<PortalPoll>
  }

  async deletePoll(pollId: string): Promise<void> {
    // Questions and responses will cascade delete
    const { error } = await supabase
      .from('portal_polls')
      .delete()
      .eq('id', pollId)

    if (error) {
      throw new Error(`Failed to delete poll: ${error.message}`)
    }
  }

  // ----------------------------------------------------------------
  // POLL QUESTIONS
  // ----------------------------------------------------------------

  async addQuestion(pollId: string, dto: CreateQuestionDTO): Promise<PollQuestion> {
    const { data, error } = await supabase
      .from('portal_poll_questions')
      .insert({
        poll_id: pollId,
        question_text: dto.question_text,
        question_type: dto.question_type || 'single_choice',
        options: dto.options || [],
        is_required: dto.is_required ?? true,
        sort_order: dto.sort_order ?? 0
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add question: ${error.message}`)
    }

    return data
  }

  async updateQuestion(questionId: string, dto: Partial<CreateQuestionDTO>): Promise<PollQuestion> {
    const updateData: any = { ...dto }
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    const { data, error } = await supabase
      .from('portal_poll_questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update question: ${error.message}`)
    }

    return data
  }

  async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await supabase
      .from('portal_poll_questions')
      .delete()
      .eq('id', questionId)

    if (error) {
      throw new Error(`Failed to delete question: ${error.message}`)
    }
  }

  // ----------------------------------------------------------------
  // POLL RESPONSES
  // ----------------------------------------------------------------

  async submitResponses(
    pollId: string,
    userId: string,
    responses: PollResponseDTO[]
  ): Promise<void> {
    // Check if user already voted
    const { data: existing } = await supabase
      .from('portal_poll_responses')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .limit(1)

    if (existing && existing.length > 0) {
      throw new Error('You have already responded to this poll')
    }

    // Insert all responses
    const responsesToInsert = responses.map(r => ({
      poll_id: pollId,
      question_id: r.question_id,
      user_id: userId,
      answer_text: r.answer_text,
      selected_options: r.selected_options,
      rating_value: r.rating_value
    }))

    const { error } = await supabase
      .from('portal_poll_responses')
      .insert(responsesToInsert)

    if (error) {
      console.error('Error submitting responses:', error)
      throw new Error(`Failed to submit responses: ${error.message}`)
    }
  }

  async getPollResults(pollId: string) {
    // Get poll with questions
    const poll = await this.getPollById(pollId)
    if (!poll) {
      throw new Error('Poll not found')
    }

    // Get all responses
    const { data: responses, error } = await supabase
      .from('portal_poll_responses')
      .select('*')
      .eq('poll_id', pollId)

    if (error) {
      throw new Error(`Failed to fetch results: ${error.message}`)
    }

    // Count unique respondents
    const uniqueUsers = new Set((responses || []).filter(r => r.user_id).map(r => r.user_id))
    const totalResponses = uniqueUsers.size

    // Aggregate results per question
    const questions = (poll.questions || []).map(question => {
      const questionResponses = (responses || []).filter(r => r.question_id === question.id)

      if (question.question_type === 'text') {
        return {
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          total_responses: questionResponses.length,
          text_responses: questionResponses.map(r => r.answer_text).filter(Boolean)
        }
      }

      if (question.question_type === 'rating') {
        const ratings = questionResponses.map(r => r.rating_value).filter(Boolean) as number[]
        const average = ratings.length > 0 
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
          : 0
        return {
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          total_responses: questionResponses.length,
          average_rating: average,
          rating_distribution: [1, 2, 3, 4, 5].map(r => ({
            rating: r,
            count: ratings.filter(v => v === r).length
          }))
        }
      }

      // Choice questions
      const optionCounts: Record<string, number> = {}
      questionResponses.forEach(r => {
        (r.selected_options || []).forEach((opt: string) => {
          optionCounts[opt] = (optionCounts[opt] || 0) + 1
        })
      })

      return {
        question_id: question.id,
        question_text: question.question_text,
        question_type: question.question_type,
        total_responses: questionResponses.length,
        options: (question.options || []).map(opt => ({
          option: opt,
          count: optionCounts[opt] || 0
        }))
      }
    })

    return {
      poll: {
        id: poll.id,
        title: poll.title
      },
      total_responses: totalResponses,
      questions
    }
  }

  async getUserResponses(pollId: string, userId: string) {
    const { data, error } = await supabase
      .from('portal_poll_responses')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to fetch responses: ${error.message}`)
    }

    return data || []
  }

  async hasUserVoted(pollId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('portal_poll_responses')
      .select('id')
      .eq('poll_id', pollId)
      .eq('user_id', userId)
      .limit(1)

    if (error) return false
    return (data?.length || 0) > 0
  }
}

export const portalService = new PortalService()
