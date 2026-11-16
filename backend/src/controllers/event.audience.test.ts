// Events: students, parents and teachers read as their own token role; a client-sent user_role only
// applies to admins. /events/:id hides events outside the caller's audience.
jest.mock('../config/supabase', () => ({ supabase: { from: jest.fn() } }))

import { eventAudience, eventVisibleTo } from './event.controller'

describe('eventAudience', () => {
  it('ignores the client user_role for parents, students and teachers', () => {
    expect(eventAudience('parent', 'admin')).toBe('parent')
    expect(eventAudience('student', 'teacher')).toBe('student')
    expect(eventAudience('teacher', 'admin')).toBe('teacher')
    expect(eventAudience('parent', undefined)).toBe('parent')
  })
  it('lets admins preview as another audience, but only a known one', () => {
    expect(eventAudience('admin', 'parent')).toBe('parent')
    expect(eventAudience('super_admin', 'teacher')).toBe('teacher')
    expect(eventAudience('admin', 'hacker')).toBeUndefined()
    expect(eventAudience('admin', undefined)).toBeUndefined()
  })
  it('does not let other staff roles pick an audience', () => {
    expect(eventAudience('librarian', 'admin')).toBeUndefined()
    expect(eventAudience('staff', 'admin')).toBeUndefined()
  })
})

describe('eventVisibleTo', () => {
  const ev = { visible_to_roles: ['teacher', 'admin'] }
  it('hides an event from a parent or student outside its audience', () => {
    expect(eventVisibleTo('parent', ev)).toBe(false)
    expect(eventVisibleTo('student', ev)).toBe(false)
    expect(eventVisibleTo('teacher', ev)).toBe(true)
  })
  it('hides an event with no audience list from parents', () => {
    expect(eventVisibleTo('parent', { visible_to_roles: null })).toBe(false)
  })
  it('leaves admins and other staff roles unchanged', () => {
    expect(eventVisibleTo('admin', ev)).toBe(true)
    expect(eventVisibleTo('librarian', ev)).toBe(true)
  })
})
