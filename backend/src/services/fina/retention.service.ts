import cron from 'node-cron'
import { supabase } from '../../config/supabase'
import { registerFinaJobHandler } from './jobs-runner.service'
import { enqueueFinaJob } from '../../utils/fina-jobs'

/**
 * Retention/deletion (spec §19) — a single nightly `retention_purge` job
 * (standalone node-cron trigger, same reasoning as
 * audit-chain-verify.service.ts: decoupled from the platform's existing
 * cron.service.ts singleton) walking every table with a defined lifespan:
 *
 *   Posts & media  — 3 school years published -> 'archived', then a further
 *                     year -> soft-deleted (deleted_at set; fina_posts.
 *                     deleted_at is documented as "soft delete only, per
 *                     spec" in its own migration, so this never issues a
 *                     hard DELETE on a post row).
 *   Stories        — already flip to archived_at at 24h
 *                     (stories.service.ts's expire_stories job); this job
 *                     hard-deletes the fina_stories row a further year
 *                     after that. Deliberately does NOT touch the
 *                     underlying fina_media row/storage object — that
 *                     asset is governed independently by the posts/media
 *                     rule above (and may still be referenced elsewhere),
 *                     so an orphaned unused media row is an acceptable,
 *                     reversible cost versus risking an unrecoverable
 *                     storage delete this job can't verify is safe.
 *   Messages       — individual fina_messages rows older than 2 years are
 *                     hard-deleted (ON DELETE CASCADE from fina_threads
 *                     doesn't apply here — this deletes messages, not
 *                     threads, so a thread with some recent traffic keeps
 *                     existing with just its oldest messages gone).
 *   Consents/audit — never touched here. fina_audit_log is trigger-enforced
 *                     append-only regardless (239_create_fina_audit_log.sql);
 *                     fina_consents has no code path here at all, matching
 *                     the spec's explicit "never deleted (legal proof)".
 *
 * Backups (90-day rotation) and encryption-at-rest are infrastructure/ops
 * concerns outside this application's code — tracked in the §22 security
 * checklist, not implemented here.
 */

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000

function yearsAgoIso(years: number): string {
  return new Date(Date.now() - years * MS_PER_YEAR).toISOString()
}

function envYears(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

interface RetentionSummary {
  postsArchived: number
  postsDeleted: number
  storiesPurged: number
  messagesPurged: number
}

async function archiveStalePosts(): Promise<number> {
  const archiveYears = envYears('FINA_RETENTION_POSTS_YEARS', 3)
  const { data, error } = await supabase
    .from('fina_posts')
    .update({ state: 'archived' })
    .eq('state', 'published')
    .lt('published_at', yearsAgoIso(archiveYears))
    .select('id')
  if (error) throw new Error(`Failed to archive stale posts: ${error.message}`)
  return (data || []).length
}

async function softDeleteArchivedPosts(): Promise<number> {
  const archiveYears = envYears('FINA_RETENTION_POSTS_YEARS', 3)
  const deleteYears = envYears('FINA_RETENTION_POSTS_DELETE_YEARS', archiveYears + 1)
  const { data, error } = await supabase
    .from('fina_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('state', 'archived')
    .is('deleted_at', null)
    .lt('published_at', yearsAgoIso(deleteYears))
    .select('id')
  if (error) throw new Error(`Failed to soft-delete archived posts: ${error.message}`)
  return (data || []).length
}

async function purgeExpiredStories(): Promise<number> {
  const storiesArchiveYears = envYears('FINA_RETENTION_STORIES_ARCHIVE_YEARS', 1)
  const { data, error } = await supabase
    .from('fina_stories')
    .delete()
    .not('archived_at', 'is', null)
    .lt('archived_at', yearsAgoIso(storiesArchiveYears))
    .select('id')
  if (error) throw new Error(`Failed to purge expired stories: ${error.message}`)
  return (data || []).length
}

async function purgeOldMessages(): Promise<number> {
  const messagesYears = envYears('FINA_RETENTION_MESSAGES_YEARS', 2)
  const { data, error } = await supabase
    .from('fina_messages')
    .delete()
    .lt('created_at', yearsAgoIso(messagesYears))
    .select('id')
  if (error) throw new Error(`Failed to purge old messages: ${error.message}`)
  return (data || []).length
}

export async function handleRetentionPurge(): Promise<RetentionSummary> {
  const postsArchived = await archiveStalePosts()
  const postsDeleted = await softDeleteArchivedPosts()
  const storiesPurged = await purgeExpiredStories()
  const messagesPurged = await purgeOldMessages()

  const summary = { postsArchived, postsDeleted, storiesPurged, messagesPurged }
  console.log('[fina] Nightly retention_purge complete:', summary)
  return summary
}

registerFinaJobHandler('retention_purge', async () => { await handleRetentionPurge() })

export function startRetentionPurgeCron(): void {
  cron.schedule('0 3 * * *', () => {
    enqueueFinaJob('retention_purge', {}, 5).catch((err) => console.error('Failed to enqueue nightly retention_purge job:', err))
  })
}
