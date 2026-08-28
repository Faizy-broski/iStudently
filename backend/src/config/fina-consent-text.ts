/**
 * The exact, versioned text shown to a guardian at consent-signing time
 * (spec §7.1: consent_text_hash / consent_text_version — "in a dispute you
 * must prove what text was signed, not merely that they signed"). The
 * backend computes consent_text_hash from THIS canonical source at grant
 * time — it never trusts a client-supplied hash — so a dispute can be
 * resolved later by re-hashing this file's history (kept under version
 * control) against the stored consent_text_hash.
 *
 * A version's text is never edited in place once it may have been signed
 * against — bump CURRENT_CONSENT_TEXT_VERSION and add a new key instead.
 *
 * The placeholder Arabic copy below is a Phase 0 stand-in so the data model
 * and hashing pipeline can be built and tested now. The real, reviewed
 * guardian-facing text lands with the consent screen in Phase 1
 * (frontend/src/app/parent/fina/consent/page.tsx) as a new version.
 */
export const CURRENT_CONSENT_TEXT_VERSION = '1.0'

export const CONSENT_TEXTS: Record<string, string> = {
  '1.0':
    'أنت تقرر من يمكنه رؤية صور أبنائك داخل هذا التطبيق. يمكنك تغيير هذا القرار في أي وقت. ' +
    'هذا نص أولي مؤقت لبنية البيانات في المرحلة الأولى، وسيتم استبداله بالنص النهائي المعتمد رسميًا قبل إطلاق شاشة الموافقة للأهالي.',
}

export function getConsentText(version: string): string | null {
  return CONSENT_TEXTS[version] ?? null
}
