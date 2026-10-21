import type { Me } from '@studently/api-client'
import { describe, expect, it } from 'vitest'

import { resolveDestination } from './destination'

const me = (role: string, gates: Partial<Me['gates']> = {}): Me =>
  ({
    profile: { id: 'p1', role },
    gates: { force_password_change: false, two_fa: { state: 'ok' }, agreement: null, ...gates },
  }) as unknown as Me

describe('resolveDestination (release build: super admin only)', () => {
  it('sends unreleased roles to "Coming soon" before any sign-in step', () => {
    expect(resolveDestination(me('teacher', { force_password_change: true }))).toEqual({ kind: 'coming_soon' })
    expect(resolveDestination(me('parent'))).toEqual({ kind: 'coming_soon' })
  })
  it('enforces sign-in steps in the web order for released roles', () => {
    expect(resolveDestination(me('super_admin', { force_password_change: true, two_fa: { state: 'setup_required' } } as never))).toEqual({ kind: 'gate', gate: 'force_password_change' })
    expect(resolveDestination(me('super_admin', { two_fa: { state: 'setup_required' } } as never))).toEqual({ kind: 'gate', gate: 'two_fa_setup' })
    expect(resolveDestination(me('super_admin', { two_fa: { state: 'verify_required' } } as never))).toEqual({ kind: 'gate', gate: 'two_fa_verify' })
    expect(resolveDestination(me('super_admin', { agreement: { must_accept: true } } as never))).toEqual({ kind: 'gate', gate: 'agreement' })
  })
  it('opens the role home once every step has passed', () => {
    expect(resolveDestination(me('super_admin'))).toEqual({ kind: 'home', href: '/superadmin' })
  })
})
