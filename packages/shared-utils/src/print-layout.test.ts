import { describe, expect, it } from 'vitest'

import { buildAutoHeaderHtml, resolvePdfTokens } from './print-layout'

describe('print layout', () => {
  const school = { name: 'Al <Noor>', address: '1 Main St', city: 'Tripoli', phone: '123', contact_email: 'a@b.ly', logo_url: null }
  it('header escapes the school name', () => {
    expect(buildAutoHeaderHtml(school)).toContain('Al &lt;Noor&gt;')
  })
  it('resolves school tokens', () => {
    expect(resolvePdfTokens('{school_name}|{school_address}|{school_phone}|{school_email}', school)).toBe('Al <Noor>|1 Main St, Tripoli|123|a@b.ly')
  })
})
