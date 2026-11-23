// Library hardening: only whitelisted book columns, validated lost/return amounts, librarians cannot message.
const tables: Record<string, any[]> = {}
const writes: { table: string; op: string; payload: any }[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      const rows = () => tables[table] ?? []
      for (const m of ['select', 'eq', 'neq', 'in', 'not', 'order', 'limit', 'gte', 'lte', 'or']) b[m] = () => b
      b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null })
      b.single = async () => ({ data: rows()[0] ?? null, error: null })
      b.insert = (p: any) => { writes.push({ table, op: 'insert', payload: p }); return b }
      b.update = (p: any) => { writes.push({ table, op: 'update', payload: p }); return b }
      b.then = (resolve: any) => resolve({ data: rows(), error: null })
      return b
    },
    rpc: async () => ({ data: [], error: null }),
  },
}))
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: async () => true }))
jest.mock('../utils/school-helpers', () => ({ getAllCampusIds: async () => [], isCampus: async () => false }))
jest.mock('./message-substitution.service', () => ({ substituteMessageTokens: (x: string) => x, resolveRecipientSubstitutionData: async () => ({}) }))

import { libraryService } from './library.service'
import { MessagingAccessError, MessagingService } from './messaging.service'
import { normalizeLibraryPolicy } from '../utils/library-policy'

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  writes.length = 0
})

describe('createBook / updateBook', () => {
  it('ignores school_id and copy counters sent by the client', async () => {
    tables.library_books = [{ id: 'b1' }]
    await libraryService.createBook({ title: 'T', author: 'A', school_id: 'evil', total_copies: 99, available_copies: 99 } as any, 'campus1')
    const ins = writes.find((w) => w.table === 'library_books' && w.op === 'insert')!
    expect(ins.payload.school_id).toBe('campus1')
    expect(ins.payload.total_copies).toBe(0)
    expect(ins.payload.available_copies).toBe(0)
  })
  it('updateBook only writes whitelisted columns', async () => {
    tables.library_books = [{ id: 'b1' }]
    await libraryService.updateBook('b1', { title: 'New', school_id: 'evil', total_copies: 50 } as any, 'campus1')
    const up = writes.find((w) => w.table === 'library_books' && w.op === 'update')!
    expect(up.payload).toEqual({ title: 'New' })
  })
  it('rejects a category from another school', async () => {
    tables.library_categories = []
    await expect(libraryService.createBook({ title: 'T', author: 'A', category_id: 'foreign' } as any, 'campus1')).rejects.toThrow('Category not found')
  })
})

describe('markBookLost / returnBook validation', () => {
  it.each([-1, NaN, Infinity, 1e9])('markBookLost rejects processing fee %p', async (fee) => {
    await expect(libraryService.markBookLost('l1', 'campus1', fee as number)).rejects.toThrow('processing_fee')
  })
  it('markBookLost refuses a loan that was already returned', async () => {
    tables.library_loans = [{ id: 'l1', status: 'returned', library_book_copies: { price: 5, book_id: 'b1' } }]
    await expect(libraryService.markBookLost('l1', 'campus1', 5)).rejects.toThrow('already been returned')
    expect(writes.length).toBe(0)
  })
  it.each([-5, NaN, 1e9])('returnBook rejects collected_amount %p', async (amt) => {
    await expect(libraryService.returnBook('l1', 'campus1', amt as number)).rejects.toThrow('collected_amount')
  })
  it('returnBook refuses a lost loan', async () => {
    tables.library_loans = [{ id: 'l1', status: 'lost', due_date: new Date().toISOString() }]
    await expect(libraryService.returnBook('l1', 'campus1', 0)).rejects.toThrow('lost')
  })
})

describe('librarian messaging is blocked', () => {
  it('sendMessage refuses a librarian sender', async () => {
    await expect(new MessagingService().sendMessage({ schoolId: 's1', senderProfileId: 'lib1', senderRole: 'librarian', subject: 'x', body: 'y', recipientProfileIds: ['p2'] } as any)).rejects.toBeInstanceOf(MessagingAccessError)
  })
  it('listRecipients returns nothing for a librarian', async () => {
    const r = await new MessagingService().listRecipients('s1', 'librarian', 'staff')
    expect(r.data).toEqual([])
    expect(r.pagination.total).toBe(0)
  })
})

describe('normalizeLibraryPolicy', () => {
  it('reads both max_books keys and falls back to defaults', () => {
    expect(normalizeLibraryPolicy({ max_books: 5, fine_per_day: 1 })).toEqual({ fine_per_day: 1, max_books_per_student: 5, loan_duration_days: 14 })
    expect(normalizeLibraryPolicy(undefined)).toEqual({ fine_per_day: 0.5, max_books_per_student: 3, loan_duration_days: 14 })
    expect(normalizeLibraryPolicy({ fine_per_day: 0, loan_duration_days: 7 }).fine_per_day).toBe(0)
  })
})
