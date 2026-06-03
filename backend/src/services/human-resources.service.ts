import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export type ILRLevel =
  | 'ILR_Level_1'
  | 'ILR_Level_2'
  | 'ILR_Level_3'
  | 'ILR_Level_4'
  | 'ILR_Level_5'

export interface HRSkill {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface HREducation {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  qualification: string
  institute?: string | null
  start_date?: string | null
  completed_on?: string | null
  created_at: string
  updated_at: string
}

export interface HRCertification {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  institute?: string | null
  granted_on?: string | null
  valid_through?: string | null
  created_at: string
  updated_at: string
}

export interface HRLanguage {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  reading?: ILRLevel | null
  speaking?: ILRLevel | null
  writing?: ILRLevel | null
  created_at: string
  updated_at: string
}

export interface HRQualifications {
  skills: HRSkill[]
  education: HREducation[]
  certifications: HRCertification[]
  languages: HRLanguage[]
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

type TableName = 'hr_skills' | 'hr_education' | 'hr_certifications' | 'hr_languages'

async function listRows<T>(
  table: TableName,
  profileId: string,
  schoolId: string
): Promise<ApiResponse<T[]>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('profile_id', profileId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data: (data || []) as T[], error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

async function insertRow<T>(
  table: TableName,
  row: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) return { data: null, error: error.message }
    return { data: data as T, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

async function updateRow<T>(
  table: TableName,
  id: string,
  row: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as T, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

async function deleteRow(table: TableName, id: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// ALL QUALIFICATIONS (single fetch)
// ============================================================================

export const getQualifications = async (
  profileId: string,
  schoolId: string
): Promise<ApiResponse<HRQualifications>> => {
  const [skills, education, certifications, languages] = await Promise.all([
    listRows<HRSkill>('hr_skills', profileId, schoolId),
    listRows<HREducation>('hr_education', profileId, schoolId),
    listRows<HRCertification>('hr_certifications', profileId, schoolId),
    listRows<HRLanguage>('hr_languages', profileId, schoolId),
  ])

  if (skills.error || education.error || certifications.error || languages.error) {
    return {
      data: null,
      error: skills.error || education.error || certifications.error || languages.error,
    }
  }

  return {
    data: {
      skills: skills.data!,
      education: education.data!,
      certifications: certifications.data!,
      languages: languages.data!,
    },
    error: null,
  }
}

// ============================================================================
// SKILLS
// ============================================================================

export const createSkill = (
  dto: Omit<HRSkill, 'id' | 'created_at' | 'updated_at'>
) => insertRow<HRSkill>('hr_skills', dto)

export const updateSkill = (id: string, dto: Partial<Pick<HRSkill, 'title' | 'description'>>) =>
  updateRow<HRSkill>('hr_skills', id, dto)

export const deleteSkill = (id: string) => deleteRow('hr_skills', id)

// ============================================================================
// EDUCATION
// ============================================================================

export const createEducation = (
  dto: Omit<HREducation, 'id' | 'created_at' | 'updated_at'>
) => insertRow<HREducation>('hr_education', dto)

export const updateEducation = (
  id: string,
  dto: Partial<Pick<HREducation, 'qualification' | 'institute' | 'start_date' | 'completed_on'>>
) => updateRow<HREducation>('hr_education', id, dto)

export const deleteEducation = (id: string) => deleteRow('hr_education', id)

// ============================================================================
// CERTIFICATIONS
// ============================================================================

export const createCertification = (
  dto: Omit<HRCertification, 'id' | 'created_at' | 'updated_at'>
) => insertRow<HRCertification>('hr_certifications', dto)

export const updateCertification = (
  id: string,
  dto: Partial<Pick<HRCertification, 'title' | 'institute' | 'granted_on' | 'valid_through'>>
) => updateRow<HRCertification>('hr_certifications', id, dto)

export const deleteCertification = (id: string) => deleteRow('hr_certifications', id)

// ============================================================================
// LANGUAGES
// ============================================================================

export const createLanguage = (
  dto: Omit<HRLanguage, 'id' | 'created_at' | 'updated_at'>
) => insertRow<HRLanguage>('hr_languages', dto)

export const updateLanguage = (
  id: string,
  dto: Partial<Pick<HRLanguage, 'title' | 'reading' | 'speaking' | 'writing'>>
) => updateRow<HRLanguage>('hr_languages', id, dto)

export const deleteLanguage = (id: string) => deleteRow('hr_languages', id)
