// Hermes has no Intl.PluralRules (ICU plural/select messages) or Intl.RelativeTimeFormat (lib/format formatRelative).
// The non-forced polyfills only install when the engine lacks the API.
import '@formatjs/intl-getcanonicallocales/polyfill.js'
import '@formatjs/intl-locale/polyfill.js'
import '@formatjs/intl-pluralrules/polyfill.js'
import '@formatjs/intl-pluralrules/locale-data/en.js'
import '@formatjs/intl-pluralrules/locale-data/ar.js'
import '@formatjs/intl-relativetimeformat/polyfill.js'
import '@formatjs/intl-relativetimeformat/locale-data/en.js'
import '@formatjs/intl-relativetimeformat/locale-data/ar.js'
