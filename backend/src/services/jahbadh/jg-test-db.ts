// In-memory Supabase fake for the Jahbadh service tests (test-only; jest.mock('../../config/supabase')).
type Row = Record<string, any>

export const db: Record<string, Row[]> = {}
let nextId = 1

export function resetDb() {
  for (const k of Object.keys(db)) delete db[k]
}

/** `academic_year.is_current` style keys read nested objects (embedded selects). */
const get = (r: Row, k: string) => k.split('.').reduce<any>((o, p) => (o == null ? o : o[p]), r)

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'insert' | 'upsert' | 'delete' | 'update' = 'select'
  let payload: Row[] = []
  let patch: Row = {}
  let conflict: string[] = []
  let single = false
  let range: [number, number] | null = null
  const rows = () => (db[table] ??= [])
  // Generated column of jg_monthly_marks (COALESCE(component_id, subitem_id)).
  const gen = (r: Row) => (table === 'jg_monthly_marks' ? { ...r, target_id: r.component_id ?? r.subitem_id } : r)
  const q: any = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => get(r, k) === v), q),
    gte: (k: string, v: any) => (filters.push((r) => r[k] >= v), q),
    lte: (k: string, v: any) => (filters.push((r) => r[k] <= v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    not: () => q,
    or: () => q,
    order: () => q,
    limit: () => q,
    range: (a: number, b: number) => ((range = [a, b]), q),
    maybeSingle: () => ((single = true), q),
    single: () => ((single = true), q),
    insert: (p: Row | Row[]) => ((op = 'insert'), (payload = (Array.isArray(p) ? p : [p]).map(gen)), q),
    upsert: (p: Row | Row[], o?: { onConflict?: string }) => ((op = 'upsert'), (payload = (Array.isArray(p) ? p : [p]).map(gen)), (conflict = o?.onConflict?.split(',') ?? ['id']), q),
    delete: () => ((op = 'delete'), q),
    update: (p: Row) => ((op = 'update'), (patch = p), q),
    then: (resolve: (v: unknown) => void) => {
      const match = (r: Row) => filters.every((f) => f(r))
      if (op === 'insert') {
        const added = payload.map((p) => ({ id: `id${nextId++}`, ...p }))
        rows().push(...added)
        return resolve({ data: single ? added[0] : added, error: null })
      }
      if (op === 'upsert') {
        for (const p of payload) {
          const found = rows().find((r) => conflict.every((k) => r[k] === p[k]))
          if (found) Object.assign(found, p)
          else rows().push({ id: `id${nextId++}`, ...p })
        }
        return resolve({ data: null, error: null })
      }
      if (op === 'delete') {
        db[table] = rows().filter((r) => !match(r))
        return resolve({ data: null, error: null })
      }
      if (op === 'update') {
        rows().filter(match).forEach((r) => Object.assign(r, patch))
        return resolve({ data: null, error: null })
      }
      let data = rows().filter(match)
      if (range) data = data.slice(range[0], range[1] + 1)
      return resolve({ data: single ? data[0] ?? null : data, error: null })
    },
  }
  return q
}

export const supabaseMock = { supabase: { from: (t: string) => query(t) } }
