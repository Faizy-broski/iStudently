import { supabase } from '../config/supabase'

// ─── Custom field definition stored in meta ────────────────────────────────
export interface SignupCustomField {
  id: string          // e.g. "grade_level", "phone", "address"
  label: string
  type: 'text' | 'select' | 'textarea'
  required: boolean
  options?: string[]  // for type === 'select'
  placeholder?: string
}

export interface SignupLinkMeta {
  poster_url?: string | null
  description?: string | null
  custom_fields?: SignupCustomField[]
}

export interface SignupLink {
  id: string
  school_id: string
  campus_id: string | null
  token: string
  role: string
  label: string | null
  max_uses: number | null
  use_count: number
  expires_at: string | null
  is_active: boolean
  meta: SignupLinkMeta
  created_by: string
  created_at: string
  updated_at: string
  // joined
  campus_name?: string | null
  creator_name?: string | null
}

export interface CreateSignupLinkDTO {
  schoolId: string
  campusId: string | null
  role: string
  label: string | null
  maxUses: number | null
  expiresAt: Date | null
  createdBy: string
  meta?: SignupLinkMeta
}

export async function generateSignupLink(dto: CreateSignupLinkDTO): Promise<SignupLink> {
  const { data, error } = await supabase
    .from('signup_links')
    .insert({
      school_id: dto.schoolId,
      campus_id: dto.campusId,
      role: dto.role,
      label: dto.label,
      max_uses: dto.maxUses,
      expires_at: dto.expiresAt?.toISOString() ?? null,
      created_by: dto.createdBy,
      meta: dto.meta ?? {},
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSignupLinks(schoolId: string, campusId?: string): Promise<SignupLink[]> {
  let query = supabase
    .from('signup_links')
    .select(`
      *,
      campus:campus_id ( name ),
      creator:created_by ( first_name, last_name )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (campusId) query = query.eq('campus_id', campusId)

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((row: any) => ({
    ...row,
    meta: row.meta ?? {},
    campus_name: row.campus?.name ?? null,
    creator_name: row.creator
      ? `${row.creator.first_name ?? ''} ${row.creator.last_name ?? ''}`.trim()
      : null,
    campus: undefined,
    creator: undefined,
  }))
}

export async function getSignupLinkByToken(token: string): Promise<SignupLink | null> {
  const { data, error } = await supabase
    .from('signup_links')
    .select(`
      *,
      campus:campus_id ( name ),
      school:school_id ( name, logo_url )
    `)
    .eq('token', token)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    meta: (data as any).meta ?? {},
    campus_name: (data as any).campus?.name ?? null,
    campus: undefined,
  }
}

export interface ValidateTokenResult {
  valid: boolean
  link?: SignupLink & { school?: { name: string; logo_url: string | null } }
  error?: string
}

export async function validateSignupToken(token: string): Promise<ValidateTokenResult> {
  const { data, error } = await supabase
    .from('signup_links')
    .select(`
      *,
      campus:campus_id ( name ),
      school:school_id ( name, logo_url )
    `)
    .eq('token', token)
    .maybeSingle()

  if (error) throw error

  if (!data) return { valid: false, error: 'link_not_found' }
  if (!data.is_active) return { valid: false, error: 'link_inactive' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'link_expired' }
  }
  if (data.max_uses !== null && data.use_count >= data.max_uses) {
    return { valid: false, error: 'link_maxed' }
  }

  return {
    valid: true,
    link: {
      ...data,
      meta: (data as any).meta ?? {},
      campus_name: (data as any).campus?.name ?? null,
      campus: undefined,
    } as any,
  }
}

export async function deactivateSignupLink(id: string, schoolId: string): Promise<void> {
  const { error } = await supabase
    .from('signup_links')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}

export async function activateSignupLink(id: string, schoolId: string): Promise<void> {
  const { error } = await supabase
    .from('signup_links')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}

export async function deleteSignupLink(id: string, schoolId: string): Promise<void> {
  const { error } = await supabase
    .from('signup_links')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}

export async function incrementUseCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_signup_link_use_count', { link_id: id }).throwOnError()

  // Fallback if RPC not available
  if (error) {
    const { data: current } = await supabase
      .from('signup_links')
      .select('use_count')
      .eq('id', id)
      .single()

    await supabase
      .from('signup_links')
      .update({ use_count: (current?.use_count ?? 0) + 1 })
      .eq('id', id)
  }
}
