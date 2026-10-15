jest.mock('../../config/supabase', () => ({ supabase: {} }))

import { assertOwnAttachments } from './records.service'

const SCHOOL = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const own = `${SCHOOL}/vault/33333333-3333-4333-8333-333333333333.pdf`
const foreign = `${OTHER}/vault/44444444-4444-4444-8444-444444444444.png`

describe('assertOwnAttachments', () => {
  it('accepts keys minted for the same school, and none at all', () => {
    expect(assertOwnAttachments(SCHOOL, [own])).toEqual([own])
    expect(assertOwnAttachments(SCHOOL, undefined)).toEqual([])
    expect(assertOwnAttachments(SCHOOL, [])).toEqual([])
  })

  it("rejects another school's key, paths outside vault/, and non-lists", () => {
    expect(() => assertOwnAttachments(SCHOOL, [foreign])).toThrow(/^Invalid attachments/)
    expect(() => assertOwnAttachments(SCHOOL, [`${SCHOOL}/fina/33333333-3333-4333-8333-333333333333.pdf`])).toThrow(/^Invalid attachments/)
    expect(() => assertOwnAttachments(SCHOOL, [`${SCHOOL}/vault/../${OTHER}/vault/x.pdf`])).toThrow(/^Invalid attachments/)
    expect(() => assertOwnAttachments(SCHOOL, own)).toThrow(/^Invalid attachments/)
    expect(() => assertOwnAttachments(SCHOOL, [42])).toThrow(/^Invalid attachments/)
  })

  it('keeps keys the record already had on update', () => {
    expect(assertOwnAttachments(SCHOOL, [foreign, own], [foreign])).toEqual([foreign, own])
  })
})
