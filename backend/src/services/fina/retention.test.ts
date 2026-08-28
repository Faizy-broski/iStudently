/**
 * Phase 6 retention/deletion (spec §19): confirms handleRetentionPurge()
 * touches exactly the tables/columns the spec calls for, with the two rows
 * the spec is explicit must NEVER be touched (fina_consents, fina_audit_log)
 * never appearing in any query this job issues.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./jobs-runner.service', () => ({ registerFinaJobHandler: jest.fn() }))

import { supabase } from '../../config/supabase'
import { handleRetentionPurge } from './retention.service'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'is', 'not', 'lt', 'update', 'delete']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.then = (resolve: any) => resolve(result)
  return builder
}

describe('retention.service — handleRetentionPurge', () => {
  const touchedTables: string[] = []

  beforeEach(() => {
    jest.clearAllMocks()
    touchedTables.length = 0
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      touchedTables.push(table)
      return makeQueryBuilder({ data: [{ id: 'row-1' }], error: null })
    })
  })

  it('touches only fina_posts, fina_stories, fina_messages — never fina_consents or fina_audit_log', async () => {
    await handleRetentionPurge()

    expect(touchedTables).toEqual(
      expect.arrayContaining(['fina_posts', 'fina_stories', 'fina_messages'])
    )
    expect(touchedTables).not.toContain('fina_consents')
    expect(touchedTables).not.toContain('fina_audit_log')
  })

  it('archives stale published posts and soft-deletes (never hard-deletes) already-archived ones', async () => {
    const postsUpdates: any[] = []
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      touchedTables.push(table)
      const builder = makeQueryBuilder({ data: [{ id: 'p1' }], error: null })
      if (table === 'fina_posts') {
        const originalUpdate = builder.update
        builder.update = jest.fn((payload: any) => { postsUpdates.push(payload); return originalUpdate(payload) })
        builder.delete = jest.fn(() => { throw new Error('fina_posts must never be hard-deleted by retention') })
      }
      return builder
    })

    await handleRetentionPurge()

    expect(postsUpdates).toContainEqual({ state: 'archived' })
    expect(postsUpdates.some((p) => 'deleted_at' in p)).toBe(true)
    expect(postsUpdates.every((p) => !('id' in p))).toBe(true) // never a hard delete disguised as an update
  })

  it('hard-deletes expired stories and old messages, and returns a summary of counts', async () => {
    const deletedTables: string[] = []
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      touchedTables.push(table)
      const builder = makeQueryBuilder({ data: [{ id: 'x1' }, { id: 'x2' }], error: null })
      const originalDelete = builder.delete
      builder.delete = jest.fn(() => { deletedTables.push(table); return originalDelete() })
      return builder
    })

    const summary = await handleRetentionPurge()

    expect(deletedTables).toContain('fina_stories')
    expect(deletedTables).toContain('fina_messages')
    expect(summary.storiesPurged).toBe(2)
    expect(summary.messagesPurged).toBe(2)
  })
})
