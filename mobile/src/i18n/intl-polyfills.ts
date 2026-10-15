// Hermes on Android has no Intl.PluralRules, which ICU plural/select messages need.
// The non-forced polyfills only install when the engine lacks the API.
import '@formatjs/intl-getcanonicallocales/polyfill.js'
import '@formatjs/intl-locale/polyfill.js'
import '@formatjs/intl-pluralrules/polyfill.js'
import '@formatjs/intl-pluralrules/locale-data/en.js'
import '@formatjs/intl-pluralrules/locale-data/ar.js'
