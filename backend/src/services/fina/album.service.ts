import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { getGuardianStudentIds } from './access-policy.service'
import { logAuditFromCaller } from './audit-logger.service'

// super_admin excluded — spec §12: SYSADMIN has no Publish access.
const STAFF_ROLES = ['teacher', 'admin', 'media_officer']

export interface CreateAlbumInput {
  title: string
  activityDate?: string
  sectionId?: string
}

export async function createAlbum(caller: CallerContext, input: CreateAlbumInput) {
  if (!STAFF_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  if (!input.title?.trim()) throw new Error('An album title is required')

  const { data, error } = await supabase
    .from('fina_albums')
    .insert({
      school_id: caller.schoolId,
      title: input.title.trim(),
      activity_date: input.activityDate ?? null,
      section_id: input.sectionId ?? null,
      created_by: caller.profileId,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create album: ${error.message}`)

  await logAuditFromCaller(caller, 'album.created', { subjectType: 'album', subjectId: data.id })
  return data
}

export async function listAlbums(caller: CallerContext) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data, error } = await supabase.from('fina_albums').select('*').eq('school_id', caller.schoolId).order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load albums: ${error.message}`)
  return data || []
}

/**
 * Album detail with the two-tab split spec §16.5 needs ("Photos of my
 * child" / "All photos"). Only 'ready' media is listed — anything still
 * mid-tagging/processing is invisible even to the album's own school,
 * matching every other viewing surface in this module. Each item exposes
 * only id/kind and an isMyChild flag (never raw tag data) — the caller's
 * actual bytes still go through GET /fina/media/:id/:variant, independently
 * re-gated regardless of what this endpoint says.
 */
export async function getAlbumDetail(caller: CallerContext, albumId: string) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data: album, error: albumError } = await supabase.from('fina_albums').select('*').eq('id', albumId).maybeSingle()
  if (albumError || !album) throw new Error('Album not found')
  if (album.school_id !== caller.schoolId) throw new Error('Access denied')

  const { data: mediaRows, error: mediaError } = await supabase
    .from('fina_media')
    .select('id, kind, processing_state')
    .eq('album_id', albumId)
    .eq('processing_state', 'ready')
    .order('uploaded_at', { ascending: true })
  if (mediaError) throw new Error(`Failed to load album media: ${mediaError.message}`)

  const mediaIds = (mediaRows || []).map((m) => m.id)
  let myChildMediaIds = new Set<string>()
  if (caller.role === 'parent' && mediaIds.length > 0) {
    const myStudentIds = await getGuardianStudentIds(caller.profileId)
    if (myStudentIds.length > 0) {
      const { data: myTags } = await supabase.from('fina_face_tags').select('media_id').in('media_id', mediaIds).in('student_id', myStudentIds)
      myChildMediaIds = new Set((myTags || []).map((t) => t.media_id as string))
    }
  }

  return {
    album,
    media: (mediaRows || []).map((m) => ({ id: m.id, kind: m.kind, isMyChild: myChildMediaIds.has(m.id) })),
  }
}
