import { supabase } from '../../config/supabase'
import { assertPublishable } from './consent-gate.service'

/**
 * The auto-filter stage of the moderation state machine (spec §11). Runs the
 * consent hard-stop (delegated to consent-gate.service.ts::assertPublishable,
 * §8.3) FIRST, then the data-driven rules in fina_filter_rules — kept as
 * data, not code, so they can be tuned without a deploy, per the spec's
 * explicit instruction. Not overridable by any role, including admin,
 * consistent with "approval cannot be disabled."
 */

export interface AutoFilterResult {
  passed: boolean
  reason?: string
  commercialSuspected?: boolean
}

interface FilterablePost {
  id: string
  title: string | null
  body: string | null
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi)
  return matches ? matches : []
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export async function runAutoFilter(post: FilterablePost): Promise<AutoFilterResult> {
  // 1. The consent hard-stop — never overridable, never skipped.
  try {
    await assertPublishable(post.id)
  } catch (err: any) {
    return { passed: false, reason: err.message }
  }

  const text = `${post.title || ''} ${post.body || ''}`
  const lowerText = text.toLowerCase()

  const { data: rules, error } = await supabase.from('fina_filter_rules').select('*').eq('is_active', true)
  if (error) {
    // Fail closed: a filter-rule lookup failure must never silently let
    // content through unchecked.
    return { passed: false, reason: 'Could not verify content against publishing rules — please try again' }
  }

  for (const rule of rules || []) {
    if (rule.kind === 'banned_word' && lowerText.includes(String(rule.pattern).toLowerCase())) {
      return { passed: false, reason: 'Contains a restricted word or phrase' }
    }
    if (rule.kind === 'phone_regex') {
      let re: RegExp
      try {
        re = new RegExp(rule.pattern)
      } catch {
        continue // a malformed regex row must not crash publishing for everyone else
      }
      if (re.test(text)) return { passed: false, reason: 'Contains what appears to be a phone number' }
    }
    if (rule.kind === 'commercial_keyword' && lowerText.includes(String(rule.pattern).toLowerCase())) {
      return { passed: false, reason: 'Contains commercial or promotional language', commercialSuspected: true }
    }
    if (rule.kind === 'grade_reference' && lowerText.includes(String(rule.pattern).toLowerCase())) {
      return { passed: false, reason: 'References grades or student ranking, which this space must not display' }
    }
  }

  const urls = extractUrls(text)
  if (urls.length > 0) {
    const { data: whitelistRules } = await supabase.from('fina_filter_rules').select('pattern').eq('kind', 'domain_whitelist').eq('is_active', true)
    const allowedDomains = (whitelistRules || []).map((r) => String(r.pattern).toLowerCase())
    for (const url of urls) {
      const host = extractHostname(url)
      const allowed = !!host && allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
      if (!allowed) return { passed: false, reason: 'Contains a link to a site outside the approved educational domains' }
    }
  }

  return { passed: true }
}
