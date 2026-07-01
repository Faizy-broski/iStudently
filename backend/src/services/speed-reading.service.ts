import { supabase } from '../config/supabase'
import { getEffectiveSchoolId, getAllCampusIds } from '../utils/school-helpers'

export interface ReadingText {
  id: string
  school_id: string
  title: string
  language: 'en' | 'ar'
  content: string
  word_count: number
  grade_level_id?: string | null
  grade_level_name?: string | null
  created_by?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  quiz_questions?: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  text_id: string
  question: string
  option_a: string
  option_b: string
  option_c?: string | null
  option_d?: string | null
  correct_ans: 'a' | 'b' | 'c' | 'd'
}

export interface CreateTextDto {
  title: string
  language: 'en' | 'ar'
  content: string
  grade_level_id?: string | null
  quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[]
}

export interface WordResult {
  word: string
  status: 'correct' | 'incorrect' | 'unread'
}

export interface SubmitLogDto {
  text_id: string
  target_wpm: number
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  comprehension_bonus: boolean
  grading_mode: 'voice' | 'manual'
  audio_url?: string
  word_results?: WordResult[]
}

export interface SessionLog {
  id: string
  school_id: string
  student_id: string
  text_id: string
  target_wpm: number
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  points_earned: number
  comprehension_bonus: boolean
  grading_mode: string
  audio_url: string | null
  word_results: WordResult[] | null
  created_at: string
  // Joined fields
  text_title?: string
  text_content?: string
  text_language?: string
  student_name?: string
}

export interface LeaderboardEntry {
  student_id: string
  first_name: string
  last_name: string
  profile_photo_url?: string | null
  total_points: number
  best_wpm: number
  sessions: number
}

function computeWordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length
}

function computePoints(correctWords: number, targetWpm: number, comprehensionBonus: boolean): number {
  const multiplier = targetWpm < 80 ? 1 : targetWpm < 120 ? 1.5 : 2
  const base = Math.round(correctWords * multiplier)
  return comprehensionBonus ? base * 2 : base
}

class SpeedReadingService {
  async getTexts(schoolId: string, gradeLevelId?: string, campusId?: string): Promise<ReadingText[]> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    let query = supabase
      .from('reading_texts')
      .select('*, grade_levels(name), reading_text_quizzes(id, question, option_a, option_b, option_c, option_d, correct_ans)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (campusId && campusId !== rootId) {
      // Admin view: show texts for this campus + root-level texts (backward compat)
      query = query.in('school_id', [campusId, rootId])
    } else {
      // Student/shared view or root-level admin: all campuses in the school network
      query = query.in('school_id', allIds)
    }

    if (gradeLevelId) query = query.eq('grade_level_id', gradeLevelId)

    const { data, error } = await query
    if (error) throw error

    return (data as any[]).map(row => ({
      ...row,
      grade_level_name: row.grade_levels?.name ?? null,
      grade_levels: undefined,
      quiz_questions: row.reading_text_quizzes ?? [],
      reading_text_quizzes: undefined,
    })) as ReadingText[]
  }

  async getText(id: string): Promise<ReadingText | null> {
    const { data: raw, error } = await supabase
      .from('reading_texts')
      .select('*, grade_levels(name)')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    if (error) return null
    const text = { ...raw, grade_level_name: (raw as any).grade_levels?.name ?? null, grade_levels: undefined }

    const { data: quiz } = await supabase
      .from('reading_text_quizzes')
      .select('*')
      .eq('text_id', id)
      .order('id', { ascending: true })

    return { ...text, quiz_questions: quiz ?? [] } as ReadingText
  }

  async createText(schoolId: string, createdBy: string, dto: CreateTextDto): Promise<ReadingText> {
    const wordCount = computeWordCount(dto.content)

    const { data: text, error } = await supabase
      .from('reading_texts')
      .insert([{
        school_id: schoolId,
        title: dto.title,
        language: dto.language,
        content: dto.content,
        word_count: wordCount,
        grade_level_id: dto.grade_level_id ?? null,
        created_by: createdBy,
        is_active: true,
      }])
      .select()
      .single()
    if (error) throw error

    if (dto.quiz_questions && dto.quiz_questions.length > 0) {
      const rows = dto.quiz_questions.map(q => ({ ...q, text_id: text.id }))
      const { error: qErr } = await supabase.from('reading_text_quizzes').insert(rows)
      if (qErr) throw qErr
    }

    return { ...text, quiz_questions: dto.quiz_questions ?? [] } as ReadingText
  }

  async updateText(id: string, dto: Partial<CreateTextDto>): Promise<ReadingText> {
    const updates: Record<string, any> = {}
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.language !== undefined) updates.language = dto.language
    if (dto.content !== undefined) {
      updates.content = dto.content
      updates.word_count = computeWordCount(dto.content)
    }
    if ('grade_level_id' in dto) updates.grade_level_id = dto.grade_level_id ?? null

    const { data: text, error } = await supabase
      .from('reading_texts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    if (dto.quiz_questions !== undefined) {
      await supabase.from('reading_text_quizzes').delete().eq('text_id', id)
      if (dto.quiz_questions.length > 0) {
        const rows = dto.quiz_questions.map(q => ({ ...q, text_id: id }))
        const { error: qErr } = await supabase.from('reading_text_quizzes').insert(rows)
        if (qErr) throw qErr
      }
    }

    const { data: quiz } = await supabase
      .from('reading_text_quizzes')
      .select('*')
      .eq('text_id', id)
    return { ...text, quiz_questions: quiz ?? [] } as ReadingText
  }

  async deleteText(id: string): Promise<void> {
    const { error } = await supabase
      .from('reading_texts')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw error
  }

  async submitLog(schoolId: string, studentId: string, dto: SubmitLogDto): Promise<{ points_earned: number }> {
    const pointsEarned = computePoints(dto.correct_words, dto.target_wpm, dto.comprehension_bonus)

    const { error } = await supabase
      .from('student_reading_logs')
      .insert([{
        school_id: schoolId,
        student_id: studentId,
        text_id: dto.text_id,
        target_wpm: dto.target_wpm,
        correct_words: dto.correct_words,
        incorrect_words: dto.incorrect_words,
        accuracy_percentage: dto.accuracy_percentage,
        points_earned: pointsEarned,
        comprehension_bonus: dto.comprehension_bonus,
        grading_mode: dto.grading_mode,
        audio_url: dto.audio_url ?? null,
        word_results: dto.word_results ?? null,
      }])
    if (error) throw error
    return { points_earned: pointsEarned }
  }

  async getSessionLog(logId: string, schoolId: string): Promise<SessionLog | null> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const { data, error } = await supabase
      .from('student_reading_logs')
      .select(`
        *,
        reading_text:reading_texts (title, content, language),
        student:profiles!student_reading_logs_student_id_fkey (first_name, last_name)
      `)
      .eq('id', logId)
      .in('school_id', allIds)
      .single()

    if (error || !data) return null

    // Legacy rows may have word_results stored as a double-encoded JSON string
    let wordResults = (data as any).word_results
    if (typeof wordResults === 'string') {
      try { wordResults = JSON.parse(wordResults) } catch { wordResults = null }
    }

    return {
      ...data,
      word_results: wordResults,
      text_title: (data as any).reading_text?.title ?? null,
      text_content: (data as any).reading_text?.content ?? null,
      text_language: (data as any).reading_text?.language ?? null,
      student_name: (data as any).student
        ? `${(data as any).student.first_name} ${(data as any).student.last_name}`.trim()
        : null,
      reading_text: undefined,
      student: undefined,
    } as SessionLog
  }

  async deleteSessionLog(logId: string, schoolId: string): Promise<void> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const { error } = await supabase
      .from('student_reading_logs')
      .delete()
      .eq('id', logId)
      .in('school_id', allIds)
    if (error) throw error
  }

  async listSessionLogs(
    schoolId: string,
    filters: { student_id?: string; text_id?: string; date_from?: string; date_to?: string },
    page = 1,
    limit = 20
  ): Promise<{ data: SessionLog[]; pagination: object }> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)
    const offset = (page - 1) * limit

    let query = supabase
      .from('student_reading_logs')
      .select(
        `id, school_id, student_id, text_id, target_wpm, correct_words, incorrect_words,
         accuracy_percentage, points_earned, comprehension_bonus, grading_mode, audio_url, created_at,
         reading_text:reading_texts (title),
         student:profiles!student_reading_logs_student_id_fkey (first_name, last_name)`,
        { count: 'exact' }
      )
      .in('school_id', allIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters.student_id) query = query.eq('student_id', filters.student_id)
    if (filters.text_id) query = query.eq('text_id', filters.text_id)
    if (filters.date_from) query = query.gte('created_at', filters.date_from)
    if (filters.date_to) query = query.lte('created_at', filters.date_to)

    const { data, error, count } = await query
    if (error) throw error

    const rows: SessionLog[] = (data ?? []).map((row: any) => ({
      ...row,
      word_results: null, // omitted from list for performance
      text_title: row.reading_text?.title ?? null,
      student_name: row.student
        ? `${row.student.first_name} ${row.student.last_name}`.trim()
        : null,
      reading_text: undefined,
      student: undefined,
    }))

    return {
      data: rows,
      pagination: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) },
    }
  }

  async getStudentLogs(
    schoolId: string,
    studentId: string,
    page = 1,
    limit = 20
  ): Promise<{ data: SessionLog[]; pagination: object }> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('student_reading_logs')
      .select(
        `id, school_id, student_id, text_id, target_wpm, correct_words, incorrect_words,
         accuracy_percentage, points_earned, comprehension_bonus, grading_mode, audio_url, created_at,
         reading_text:reading_texts (title)`,
        { count: 'exact' }
      )
      .in('school_id', allIds)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const rows: SessionLog[] = (data ?? []).map((row: any) => ({
      ...row,
      word_results: null,
      text_title: row.reading_text?.title ?? null,
      reading_text: undefined,
    }))

    return {
      data: rows,
      pagination: { total: count ?? 0, page, limit, totalPages: Math.ceil((count ?? 0) / limit) },
    }
  }

  async getLeaderboard(schoolId: string, limit = 20): Promise<LeaderboardEntry[]> {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const { data, error } = await supabase
      .from('student_reading_logs')
      .select(`
        student_id,
        points_earned,
        target_wpm,
        profiles!student_reading_logs_student_id_fkey (
          first_name,
          last_name,
          profile_photo_url
        )
      `)
      .in('school_id', allIds)

    if (error) throw error

    const map = new Map<string, LeaderboardEntry>()
    for (const row of (data ?? [])) {
      const profile: any = row.profiles
      if (!profile) continue
      const existing = map.get(row.student_id)
      if (existing) {
        existing.total_points += row.points_earned
        if (row.target_wpm > existing.best_wpm) existing.best_wpm = row.target_wpm
        existing.sessions += 1
      } else {
        map.set(row.student_id, {
          student_id: row.student_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          profile_photo_url: profile.profile_photo_url ?? null,
          total_points: row.points_earned,
          best_wpm: row.target_wpm,
          sessions: 1,
        })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, limit)
  }

  async getStudentStats(schoolId: string, studentId: string) {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const { data: logs, error } = await supabase
      .from('student_reading_logs')
      .select('*')
      .in('school_id', allIds)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error

    const allLogs = logs ?? []
    const totalPoints = allLogs.reduce((s, r) => s + r.points_earned, 0)
    const bestWpm = allLogs.reduce((max, r) => Math.max(max, r.target_wpm), 0)

    return { total_points: totalPoints, best_wpm: bestWpm, sessions: allLogs.length, recent_logs: allLogs }
  }

  async getDashboardStats(schoolId: string) {
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const [textsResult, logsResult] = await Promise.all([
      supabase.from('reading_texts').select('id', { count: 'exact', head: true }).in('school_id', allIds).eq('is_active', true),
      supabase.from('student_reading_logs').select('id', { count: 'exact', head: true }).in('school_id', allIds),
    ])

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: weekLogs } = await supabase
      .from('student_reading_logs')
      .select('target_wpm')
      .in('school_id', allIds)
      .gte('created_at', weekAgo.toISOString())

    const topWpmThisWeek = (weekLogs ?? []).reduce((max, r) => Math.max(max, r.target_wpm), 0)

    return {
      total_texts: textsResult.count ?? 0,
      total_sessions: logsResult.count ?? 0,
      top_wpm_this_week: topWpmThisWeek,
    }
  }
}

export const speedReadingService = new SpeedReadingService()
