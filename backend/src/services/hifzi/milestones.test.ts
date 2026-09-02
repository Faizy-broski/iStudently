jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('./notifications.service', () => ({ hifziNotificationsService: { notifyMilestone: jest.fn() } }))
jest.mock('./ministry-syllabus.service', () => ({ hifziMinistrySyllabusService: { getSyllabusTarget: jest.fn().mockResolvedValue(null) } }))

import { supabase } from '../../config/supabase'
import { hifziNotificationsService } from './notifications.service'
import { hifziMilestonesService } from './milestones.service'

// ============================================================================
// Focused, not exhaustive — the cascade DECISION logic (which units complete,
// which cascade) is already 100%-branch-tested in milestone-cascade.test.ts.
// This file checks that the DB-facing wrapper plumbs real query results into
// that logic correctly for a few representative shapes, using the same
// filter-aware mock convention as gradebook-bridge.test.ts (concurrent
// Promise.all calls hit the same tables in unpredictable order).
// ============================================================================

type Filters = Record<string, any>
type Handler = (filters: Filters) => { data: any; error?: any }

function chainable(resolve: Handler) {
  const filters: Filters = {}
  const obj: any = {}
  for (const m of ['select', 'update', 'insert', 'upsert']) obj[m] = jest.fn(() => obj)
  obj.eq = jest.fn((k: string, v: any) => { filters[k] = v; return obj })
  obj.gte = jest.fn((k: string, v: any) => { filters[`${k}__gte`] = v; return obj })
  obj.lte = jest.fn((k: string, v: any) => { filters[`${k}__lte`] = v; return obj })
  obj.in = jest.fn((k: string, v: any) => { filters[`${k}__in`] = v; return obj })
  obj.limit = jest.fn(() => obj)
  obj.order = jest.fn(() => obj)
  obj.single = jest.fn(() => Promise.resolve(resolve(filters)))
  obj.maybeSingle = jest.fn(() => Promise.resolve(resolve(filters)))
  obj.then = (res: any, rej: any) => Promise.resolve(resolve(filters)).then(res, rej)
  return obj
}

const fromMock = supabase.from as jest.Mock
const rpcMock = supabase.rpc as jest.Mock
const notifyMilestoneMock = hifziNotificationsService.notifyMilestone as jest.Mock

let handlers: Record<string, Handler> = {}
let rpcHandler: (args: any) => number = () => 0

beforeEach(() => {
  handlers = {}
  rpcHandler = () => 0
  fromMock.mockReset()
  rpcMock.mockReset()
  notifyMilestoneMock.mockReset()
  notifyMilestoneMock.mockResolvedValue(undefined)
  fromMock.mockImplementation((table: string) => {
    const handler = handlers[table]
    if (!handler) throw new Error(`Unexpected supabase.from("${table}") — no handler registered for this test`)
    return chainable(handler)
  })
  rpcMock.mockImplementation((_fn: string, args: any) => Promise.resolve({ data: rpcHandler(args), error: null }))
})

// A tiny fixture: one riwayah, ayat 1-3 all in thumn 1 / hizb 1, ayah 4 in
// thumn 2 / hizb 1 — so thumn 1 alone does NOT complete hizb 1 (thumn 2 also required).
function baseHandlers(overrides: Partial<Record<string, Handler>> = {}) {
  return {
    quran_ayahs: (f: Filters) => {
      if (f['id'] === 'start-ayah') return { data: { riwayah_id: 'riwayah-1', global_ayah_index: 1 } }
      if (f['id'] === 'end-ayah') return { data: { global_ayah_index: 3 } }
      // resolveTouchedThumns' range query
      if (f['riwayah_id'] && f['global_ayah_index__gte'] !== undefined) {
        return { data: [{ thumn_number: 1, hizb_number: 1 }] }
      }
      // fetchSiblingsByParent('hizb_number', [1], 'thumn_number')
      if (f['hizb_number__in']) return { data: [{ hizb_number: 1, thumn_number: 1 }, { hizb_number: 1, thumn_number: 2 }] }
      return { data: [] }
    },
    // Looked up two ways: by id (resolveTouchedThumns wants the code) and by
    // code (QuranReferenceService.getRiwayahIdByCode, called internally by
    // every resolveRange/countAyat, wants the id) — both hit this table.
    quran_riwayat: (f: Filters) => (f['id'] ? { data: { code: 'hafs' } } : { data: { id: 'riwayah-1' } }),
    hifzi_milestones_log: (f: Filters) => {
      if (f['unit_number__in']) return { data: [] } // nothing logged yet
      // the final upsert().select() call has no .eq() filters queued — return the "inserted" rows
      return { data: [{ id: 'ms-1', milestone_type: 'thumn', unit_number: 1 }] }
    },
    students: () => ({ data: { profile: { first_name: 'Ali', last_name: 'Test' } } }),
    parent_student_links: () => ({ data: [{ parent: { profile_id: 'guardian-1' } }] }),
    academic_years: () => ({ data: null }), // no current year -> syllabus_grade check short-circuits
    ...overrides,
  }
}

describe('checkAndRecordMilestones', () => {
  it('returns [] when the range spans no resolvable ayat (bad ids)', async () => {
    handlers = { quran_ayahs: () => ({ data: null, error: { message: 'not found' } }) }
    const result = await hifziMilestonesService.checkAndRecordMilestones('student-1', 'school-1', { startAyahId: 'start-ayah', endAyahId: 'end-ayah' })
    expect(result).toEqual([])
    expect(notifyMilestoneMock).not.toHaveBeenCalled()
  })

  it('records a thumn milestone and notifies guardians when the thumn is fully memorized, but does not cascade to hizb when a sibling thumn is incomplete', async () => {
    handlers = baseHandlers()
    // thumn 1 (ayahs 1-3, this fixture's whole "range") is fully memorized; thumn 2 (sibling in hizb 1) is not.
    rpcHandler = () => 3
    // countAyat for thumn 1 resolves via resolveRange -> quran_ayahs eq(thumn_number,1) — reuse the range-query branch:
    handlers.quran_ayahs = (f: Filters) => {
      if (f['id'] === 'start-ayah') return { data: { riwayah_id: 'riwayah-1', global_ayah_index: 1 } }
      if (f['id'] === 'end-ayah') return { data: { global_ayah_index: 3 } }
      if (f['id'] === 'a1') return { data: { global_ayah_index: 1 } } // countAyat's endpoint re-lookups
      if (f['id'] === 'a3') return { data: { global_ayah_index: 3 } }
      if (f['thumn_number'] !== undefined) return { data: [{ id: 'a1', global_ayah_index: 1 }, { id: 'a3', global_ayah_index: 3 }] } // resolveRange(thumn=1)
      // Session range and thumn 1's own range coincide in this fixture (both
      // ayat 1-3) — the SAME filter shape backs two different callers here:
      // resolveTouchedThumns reads `.data` (per-ayah thumn/hizb rows, deduped
      // by thumn_number so one row suffices), countAyat's head-count query
      // reads `.count` — returning both satisfies each without needing to
      // structurally disambiguate an otherwise-identical query.
      if (f['riwayah_id'] && f['global_ayah_index__gte'] !== undefined) return { data: [{ thumn_number: 1, hizb_number: 1 }], count: 3 } as any
      if (f['hizb_number__in']) return { data: [{ hizb_number: 1, thumn_number: 1 }, { hizb_number: 1, thumn_number: 2 }] }
      return { data: [] }
    }

    const result = await hifziMilestonesService.checkAndRecordMilestones('student-1', 'school-1', { startAyahId: 'start-ayah', endAyahId: 'end-ayah' })

    expect(result).toEqual([{ id: 'ms-1', milestoneType: 'thumn', unitNumber: 1 }])
    expect(notifyMilestoneMock).toHaveBeenCalledTimes(1)
    expect(notifyMilestoneMock).toHaveBeenCalledWith('school-1', 'guardian-1', 'Ali Test', expect.stringContaining('الثُمن'), 'ms-1')
  })

  it('records nothing when the touched thumn is not yet fully memorized', async () => {
    handlers = baseHandlers()
    rpcHandler = () => 1 // only 1 of 3 ayat memorized
    handlers.quran_ayahs = (f: Filters) => {
      if (f['id'] === 'start-ayah') return { data: { riwayah_id: 'riwayah-1', global_ayah_index: 1 } }
      if (f['id'] === 'end-ayah') return { data: { global_ayah_index: 3 } }
      if (f['thumn_number'] !== undefined) return { data: [{ id: 'a1', global_ayah_index: 1 }, { id: 'a3', global_ayah_index: 3 }] }
      if (f['riwayah_id'] && f['global_ayah_index__gte'] !== undefined) return { data: [{ thumn_number: 1, hizb_number: 1 }] }
      return { data: [] }
    }

    const result = await hifziMilestonesService.checkAndRecordMilestones('student-1', 'school-1', { startAyahId: 'start-ayah', endAyahId: 'end-ayah' })

    expect(result).toEqual([])
    expect(notifyMilestoneMock).not.toHaveBeenCalled()
  })
})

describe('listMilestonesForStudent', () => {
  it('returns the recorded milestones for a student', async () => {
    handlers = {
      hifzi_milestones_log: () => ({ data: [{ id: 'm1', milestone_type: 'thumn', unit_number: 5 }] }),
    }
    const result = await hifziMilestonesService.listMilestonesForStudent('student-1')
    expect(result).toEqual([{ id: 'm1', milestoneType: 'thumn', unitNumber: 5 }])
  })
})
