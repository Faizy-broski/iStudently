import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { logAuditFromCaller } from './audit-logger.service'

/** Subject/interest-scoped groups (spec §7.5) — teacher-moderated,
 * self-service join/leave for guardians/students/other teachers. Real
 * membership check replaces the Phase 2 placeholder that treated every
 * 'group'-audience post/event as visible to nobody outside staff. */

// super_admin excluded — spec §12: SYSADMIN has zero content access, and
// groups (membership, moderation) are content, not "operational" data.
const STAFF_ROLES = ['teacher', 'admin', 'media_officer']

export async function createGroup(caller: CallerContext, input: { name: string; type?: string; sectionId?: string }) {
  if (!STAFF_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  if (!input.name?.trim()) throw new Error('A group name is required')

  const { data: created, error } = await supabase
    .from('fina_groups')
    .insert({ school_id: caller.schoolId, name: input.name.trim(), type: input.type ?? 'subject', section_id: input.sectionId ?? null, moderator_id: caller.profileId })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to create group: ${error?.message}`)

  const { error: memberError } = await supabase.from('fina_group_members').insert({ group_id: created.id, user_id: caller.profileId, role: 'moderator' })
  if (memberError) console.error('Failed to add group moderator as member:', memberError)

  await logAuditFromCaller(caller, 'group.created', { subjectType: 'group', subjectId: created.id })
  return created
}

export async function listGroups(caller: CallerContext) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data, error } = await supabase.from('fina_groups').select('*').eq('school_id', caller.schoolId).order('name', { ascending: true })
  if (error) throw new Error(`Failed to load groups: ${error.message}`)

  const { data: myMemberships } = await supabase.from('fina_group_members').select('group_id').eq('user_id', caller.profileId)
  const myGroupIds = new Set((myMemberships || []).map((m) => m.group_id))

  return (data || []).map((g) => ({ ...g, isMember: myGroupIds.has(g.id) }))
}

export async function joinGroup(caller: CallerContext, groupId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data: group } = await supabase.from('fina_groups').select('id, school_id').eq('id', groupId).maybeSingle()
  if (!group) throw new Error('Group not found')
  if (group.school_id !== caller.schoolId) throw new Error('Access denied')

  const { error } = await supabase.from('fina_group_members').upsert({ group_id: groupId, user_id: caller.profileId, role: 'member' }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
  if (error) throw new Error(`Failed to join group: ${error.message}`)
}

export async function leaveGroup(caller: CallerContext, groupId: string) {
  const { data: group } = await supabase.from('fina_groups').select('moderator_id').eq('id', groupId).maybeSingle()
  if (group?.moderator_id === caller.profileId) throw new Error('The moderator cannot leave their own group')

  const { error } = await supabase.from('fina_group_members').delete().eq('group_id', groupId).eq('user_id', caller.profileId)
  if (error) throw new Error(`Failed to leave group: ${error.message}`)
}

export async function listGroupMembers(caller: CallerContext, groupId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data: group } = await supabase.from('fina_groups').select('id, school_id').eq('id', groupId).maybeSingle()
  if (!group) throw new Error('Group not found')
  if (group.school_id !== caller.schoolId) throw new Error('Access denied')

  const { data, error } = await supabase
    .from('fina_group_members')
    .select('user_id, role, joined_at, profile:profiles(first_name, last_name, role)')
    .eq('group_id', groupId)
  if (error) throw new Error(`Failed to load group members: ${error.message}`)
  return data || []
}

/** Whether the caller is a member of a specific group — used by
 * wall.service.ts's audience matching for 'group'-type posts/events. */
export async function isGroupMember(profileId: string, groupId: string): Promise<boolean> {
  const { data } = await supabase.from('fina_group_members').select('group_id').eq('group_id', groupId).eq('user_id', profileId).maybeSingle()
  return !!data
}
