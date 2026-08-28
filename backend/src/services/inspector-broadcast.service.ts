import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { listAssignedSchoolIds, assertCanAccessSchoolFeed } from '../utils/inspector-access'
import type { InspectorBroadcast } from '../types/inspector-community.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

export interface CreateBroadcastDTO {
  subject_id?: string | null
  title: string
  body: string
  target_school_ids: string[]
}

export async function createBroadcast(caller: CallerContext, dto: CreateBroadcastDTO): Promise<InspectorBroadcast> {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (!dto.title?.trim() || !dto.body?.trim()) throw new Error('title and body are required')
  if (!dto.target_school_ids || dto.target_school_ids.length === 0) {
    throw new Error('target_school_ids must include at least one campus')
  }

  if (caller.role === 'inspector') {
    const assigned = await listAssignedSchoolIds(caller.profileId)
    const invalid = dto.target_school_ids.filter((id) => !assigned.includes(id))
    if (invalid.length > 0) {
      throw new Error('Can only broadcast to campuses you are assigned to')
    }
  }

  const { data, error } = await supabase
    .from('inspector_broadcasts')
    .insert({
      inspector_profile_id: caller.profileId,
      subject_id: dto.subject_id || null,
      title: dto.title.trim(),
      body: dto.body.trim(),
      target_school_ids: dto.target_school_ids,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create broadcast: ${error.message}`)

  for (const schoolId of dto.target_school_ids) {
    pushNotificationsService.sendToRole(schoolId, 'teacher', {
      title: `New broadcast: ${dto.title.trim()}`,
      body: dto.body.trim().slice(0, 120),
      url: '/teacher/inspections/community',
      tag: 'inspector-broadcast',
    }).catch((err) => console.error('Failed to send broadcast notification:', err))
  }

  return data as InspectorBroadcast
}

export async function listBroadcastsForSchool(caller: CallerContext, schoolId: string) {
  const hasAccess = await assertCanAccessSchoolFeed(caller, schoolId)
  if (!hasAccess) throw new Error('Access denied: cannot view this campus\'s broadcasts')

  const { data, error } = await supabase
    .from('inspector_broadcasts')
    .select('*, inspector:profiles!inspector_broadcasts_inspector_profile_id_fkey(id, first_name, last_name), subject:subjects(id, name)')
    .contains('target_school_ids', [schoolId])
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list broadcasts: ${error.message}`)
  return data || []
}

export async function listMyBroadcasts(inspectorProfileId: string) {
  const { data, error } = await supabase
    .from('inspector_broadcasts')
    .select('*, subject:subjects(id, name)')
    .eq('inspector_profile_id', inspectorProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list broadcasts: ${error.message}`)
  return data || []
}

export async function deleteBroadcast(caller: CallerContext, id: string): Promise<void> {
  if (caller.role !== 'super_admin') {
    const { data, error } = await supabase.from('inspector_broadcasts').select('inspector_profile_id').eq('id', id).single()
    if (error || !data) throw new Error('Broadcast not found')
    if (data.inspector_profile_id !== caller.profileId) throw new Error('Access denied: not your broadcast')
  }

  const { error } = await supabase.from('inspector_broadcasts').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete broadcast: ${error.message}`)
}
