import { supabase } from '../config/supabase'
import { getEffectiveSchoolId, getAllCampusIds } from '../utils/school-helpers'

export interface ReadingText {
  id: string
  school_id: string
  title: string
  language: 'en' | 'ar'
  content: string
  word_count: number
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
  quiz_questions?: Omit<QuizQuestion, 'id' | 'text_id'>[]
}

export interface SubmitLogDto {
  text_id: string
  target_wpm: number
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  comprehension_bonus: boolean
  grading_mode: 'voice' | 'manual'
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
  async getTexts(schoolId: string): Promise<ReadingText[]> {
    // Resolve to root school, then include all campus IDs so texts from
    // any admin in the school network are visible to all users.
    const rootId = await getEffectiveSchoolId(schoolId)
    const allIds = await getAllCampusIds(rootId)

    const { data, error } = await supabase
      .from('reading_texts')
      .select('*')
      .in('school_id', allIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as ReadingText[]
  }

  async getText(id: string): Promise<ReadingText | null> {
    const { data: text, error } = await supabase
      .from('reading_texts')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    if (error) return null

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
      }])
    if (error) throw error
    return { points_earned: pointsEarned }
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
