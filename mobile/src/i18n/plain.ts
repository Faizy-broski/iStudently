import i18n from '@/i18n'

/**
 * A web message that uses next-intl rich tags (`<b>…</b>`, t.rich) as plain text: tags are
 * dropped and simple `{name}` values filled in. ICU would otherwise reject the unknown tags.
 * A self-closing tag (`<host/>`) is replaced by `values.host` when given.
 */
export function plainMessage(key: string, values: Record<string, string | number> = {}) {
  const raw = i18n.getResource(i18n.language, 'translation', key) ?? i18n.getResource('en', 'translation', key)
  if (typeof raw !== 'string') return key
  return raw
    .replace(/<([a-z_]+)\s*\/>/gi, (m, k) => (k in values ? String(values[k]) : ''))
    .replace(/<\/?[a-z_]+>/gi, '').replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m))
}
