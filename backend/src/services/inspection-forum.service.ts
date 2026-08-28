import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { listAssignedSchoolIds, assertCanAccessSchoolFeed } from '../utils/inspector-access'
import type { ForumThread, ForumPost } from '../types/inspector-community.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

export interface CreateThreadDTO {
  subject_id?: string | null
  title: string
  body: string // first post's body
  target_school_ids?: string[] // ignored for teacher callers — forced to their own campus
}

async function getThreadOrThrow(id: string): Promise<ForumThread> {
  const { data, error } = await supabase.from('forum_threads').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Thread not found')
  return data as ForumThread
}

async function assertCanAccessThread(thread: ForumThread, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  const allowed = await Promise.all(thread.target_school_ids.map((schoolId) => assertCanAccessSchoolFeed(caller, schoolId)))
  if (!allowed.some(Boolean)) throw new Error('Access denied: cannot view this thread')
}

export async function createThread(caller: CallerContext, dto: CreateThreadDTO): Promise<ForumThread> {
  if (!['inspector', 'teacher', 'super_admin'].includes(caller.role)) {
    throw new Error('Access denied')
  }
  if (!dto.title?.trim() || !dto.body?.trim()) throw new Error('title and body are required')

  let targetSchoolIds: string[]
  if (caller.role === 'teacher') {
    // A teacher can only ever start a thread visible on their own campus —
    // any target_school_ids they send is ignored, not merely validated.
    if (!caller.schoolId) throw new Error('Your account has no campus on file')
    targetSchoolIds = [caller.schoolId]
  } else {
    if (!dto.target_school_ids || dto.target_school_ids.length === 0) {
      throw new Error('target_school_ids must include at least one campus')
    }
    if (caller.role === 'inspector') {
      const assigned = await listAssignedSchoolIds(caller.profileId)
      const invalid = dto.target_school_ids.filter((id) => !assigned.includes(id))
      if (invalid.length > 0) throw new Error('Can only start a thread for campuses you are assigned to')
    }
    targetSchoolIds = dto.target_school_ids
  }

  const { data: thread, error } = await supabase
    .from('forum_threads')
    .insert({
      subject_id: dto.subject_id || null,
      title: dto.title.trim(),
      created_by: caller.profileId,
      target_school_ids: targetSchoolIds,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create thread: ${error.message}`)

  const { error: postError } = await supabase
    .from('forum_posts')
    .insert({ thread_id: thread.id, author_profile_id: caller.profileId, body: dto.body.trim() })

  if (postError) {
    // Roll back the now-empty thread rather than leaving a thread with no posts.
    await supabase.from('forum_threads').delete().eq('id', thread.id)
    throw new Error(`Failed to create thread: ${postError.message}`)
  }

  return thread as ForumThread
}

export async function listThreadsForSchool(caller: CallerContext, schoolId: string) {
  const hasAccess = await assertCanAccessSchoolFeed(caller, schoolId)
  if (!hasAccess) throw new Error('Access denied: cannot view this campus\'s forum')

  const { data, error } = await supabase
    .from('forum_threads')
    .select('*, subject:subjects(id, name), creator:profiles!forum_threads_created_by_fkey(id, first_name, last_name)')
    .contains('target_school_ids', [schoolId])
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to list threads: ${error.message}`)
  return data || []
}

export async function getThread(caller: CallerContext, id: string) {
  const thread = await getThreadOrThrow(id)
  await assertCanAccessThread(thread, caller)

  const { data: posts, error } = await supabase
    .from('forum_posts')
    .select('*, author:profiles!forum_posts_author_profile_id_fkey(id, first_name, last_name, role)')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load posts: ${error.message}`)

  const { data: subject } = thread.subject_id
    ? await supabase.from('subjects').select('id, name').eq('id', thread.subject_id).single()
    : { data: null }

  return { ...thread, posts: posts || [], subject }
}

export async function addPost(caller: CallerContext, threadId: string, body: string): Promise<ForumPost> {
  const thread = await getThreadOrThrow(threadId)
  await assertCanAccessThread(thread, caller)
  if (!body?.trim()) throw new Error('body is required')

  const { data, error } = await supabase
    .from('forum_posts')
    .insert({ thread_id: threadId, author_profile_id: caller.profileId, body: body.trim() })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to add post: ${error.message}`)

  await supabase.from('forum_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)

  if (thread.created_by !== caller.profileId) {
    pushNotificationsService.sendToProfile(thread.created_by, {
      title: 'New reply in your forum thread',
      body: `New activity on "${thread.title}"`,
      url: `/inspector/community/${threadId}`,
      tag: 'inspection-forum',
    }).catch((err) => console.error('Failed to send forum-reply notification:', err))
  }

  return data as ForumPost
}
