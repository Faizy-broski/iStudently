import { supabase } from '../config/supabase'

export interface ReadingLog {
  id: string
  student_id: string
  school_id: string
  book_id: string | null
  book_title: string
  book_author: string | null
  session_date: string
  pages_read: number | null
  notes: string | null
  audio_file_path: string | null
  created_at: string
  updated_at: string
  student?: { first_name: string; last_name: string; profile_image: string | null }
  audio_url?: string | null
}

export interface CreateReadingLogDTO {
  student_id: string
  school_id: string
  book_id?: string | null
  book_title: string
  book_author?: string | null
  session_date?: string | null
  pages_read?: number | null
  notes?: string | null
  audio_file_path?: string | null
}

const BUCKET = 'media-recordings'
const AUDIO_EXPIRY_DAYS = 14

function getPublicAudioUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function isAudioExpired(createdAt: string): boolean {
  const created = new Date(createdAt)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - AUDIO_EXPIRY_DAYS)
  return created < cutoff
}

function attachAudioUrl(log: ReadingLog): ReadingLog {
  if (!log.audio_file_path || isAudioExpired(log.created_at)) {
    return { ...log, audio_url: null }
  }
  return { ...log, audio_url: getPublicAudioUrl(log.audio_file_path) }
}

export const readingLogsService = {
  async create(dto: CreateReadingLogDTO): Promise<ReadingLog> {
    const { data, error } = await supabase
      .from('student_reading_logs')
      .insert({
        student_id: dto.student_id,
        school_id: dto.school_id,
        book_id: dto.book_id ?? null,
        book_title: dto.book_title,
        book_author: dto.book_author ?? null,
        session_date: dto.session_date ?? new Date().toISOString().split('T')[0],
        pages_read: dto.pages_read ?? null,
        notes: dto.notes ?? null,
        audio_file_path: dto.audio_file_path ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    return attachAudioUrl(data as ReadingLog)
  },

  async setAudioPath(logId: string, studentId: string, path: string): Promise<void> {
    const { error } = await supabase
      .from('student_reading_logs')
      .update({ audio_file_path: path, updated_at: new Date().toISOString() })
      .eq('id', logId)
      .eq('student_id', studentId)

    if (error) throw error
  },

  async getStudentLogs(studentId: string, schoolId: string): Promise<ReadingLog[]> {
    const { data, error } = await supabase
      .from('student_reading_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(attachAudioUrl)
  },

  async getSchoolLogs(schoolId: string, studentId?: string): Promise<ReadingLog[]> {
    let query = supabase
      .from('student_reading_logs')
      .select(`
        *,
        student:profiles!student_reading_logs_student_id_fkey(
          first_name, last_name, profile_image
        )
      `)
      .eq('school_id', schoolId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (studentId) query = query.eq('student_id', studentId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(attachAudioUrl)
  },

  async cleanup14DayAudio(): Promise<{ cleaned: number; errors: number }> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - AUDIO_EXPIRY_DAYS)

    const { data: oldLogs, error } = await supabase
      .from('student_reading_logs')
      .select('id, audio_file_path')
      .lt('created_at', cutoff.toISOString())
      .not('audio_file_path', 'is', null)

    if (error) {
      console.error('[ReadingLogs] Cleanup query error:', error.message)
      return { cleaned: 0, errors: 1 }
    }

    let cleaned = 0
    let errors = 0

    for (const log of oldLogs ?? []) {
      try {
        const { error: storageErr } = await supabase.storage
          .from(BUCKET)
          .remove([log.audio_file_path!])

        if (storageErr) {
          console.error(`[ReadingLogs] Storage delete error for log ${log.id}:`, storageErr.message)
          errors++
          continue
        }

        const { error: dbErr } = await supabase
          .from('student_reading_logs')
          .update({ audio_file_path: null, updated_at: new Date().toISOString() })
          .eq('id', log.id)

        if (dbErr) {
          console.error(`[ReadingLogs] DB update error for log ${log.id}:`, dbErr.message)
          errors++
        } else {
          cleaned++
        }
      } catch (e: any) {
        console.error(`[ReadingLogs] Cleanup exception for log ${log.id}:`, e.message)
        errors++
      }
    }

    return { cleaned, errors }
  },
}
